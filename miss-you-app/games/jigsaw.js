/* Moonpie jigsaw — a photo tile puzzle for the games world.
 *
 * Plain browser IIFE: no modules, no build step, no dependencies.
 * Exposes window.MoonpieJigsaw = { mount(containerEl), unmount() }.
 *
 * The photo is never canvas-sliced for display. Each tile is the same image
 * used as a CSS background at background-size:(cols*100)%/(rows*100)% with a
 * per-tile background-position, so the puzzle stays sharp at any DPI and
 * costs one image decode for the whole board. A canvas IS used once, up
 * front, to downscale an uploaded photo before it ever becomes a tile.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "moonpie-jigsaw-v1";
  var PIECE_PRESETS = [12, 24, 48, 100];
  var MIN_PIECES = 6;
  var MAX_PIECES = 200;
  var DEFAULT_PIECES = 24;
  var UPLOAD_MAX_EDGE = 1400;      // cap the long edge of an uploaded photo
  var UPLOAD_STORE_CAP = 1200000;  // ~1.15MB of base64 — beyond this we don't persist it

  /* Photographs that actually ship with the app (verified on disk under
   * miss-you-app/assets/worlds/). Any entry that fails to load at runtime is
   * dropped from the picker rather than rendered as broken tiles. Dimensions
   * are the real, measured pixel size of each file (960x720, 4:3) so the
   * piece-count solver works from a true aspect ratio instead of guessing. */
  var IMAGES = [
    { id: "paris", src: "./assets/worlds/paris-1.webp", label: "Paris at Midnight", w: 960, h: 720 },
    { id: "santorini", src: "./assets/worlds/santorini-1.webp", label: "Santorini", w: 960, h: 720 },
    { id: "maldives", src: "./assets/worlds/maldives-1.webp", label: "The Maldives", w: 960, h: 720 },
    { id: "kyoto", src: "./assets/worlds/kyoto-1.webp", label: "Kyoto", w: 960, h: 720 },
    { id: "venice", src: "./assets/worlds/venice-1.webp", label: "Venice", w: 960, h: 720 },
    { id: "amalfi", src: "./assets/worlds/amalfi-1.webp", label: "Amalfi", w: 960, h: 720 },
    { id: "aurora", src: "./assets/worlds/aurora-1.webp", label: "The Aurora", w: 960, h: 720 },
    { id: "kenya", src: "./assets/worlds/kenya-1.webp", label: "Kenya", w: 960, h: 720 }
  ];

  var WIN_LINES = [
    "Every piece back where it belongs. Like us.",
    "You put the whole picture back together.",
    "Solved it. Obviously. Look at you.",
    "That is the view. That is us in it."
  ];

  /* ---------------------------------------------------------------- state */

  var mounted = false;
  var host = null;      // container element we were mounted into
  var root = null;      // our own wrapper inside the container
  var els = null;       // cached child element references
  var listeners = [];   // [el, type, fn, opts] for teardown
  var tickId = null;    // setInterval handle
  var imgStatus = {};   // src -> "ok" | "bad"
  var loadToken = 0;    // invalidates in-flight image probes across remounts
  var pendingObjectUrl = null; // object URL for an upload currently being read

  /* state = {
   *   activeKind: "builtin" | "upload",
   *   activeBuiltinId: string,
   *   uploaded: null | { dataUrl, w, h },   // last uploaded photo, kept even
   *                                          // when a builtin is active so
   *                                          // she can flip back to it
   *   pieces: number,   // requested piece count, 6..200
   *   rows: number, cols: number,   // actual solved grid for this image
   *   order: number[], moves: number, elapsed: number, solved: boolean
   * }
   */
  var state = null;
  var selected = -1;    // board index of the currently selected tile
  var runStart = 0;     // timestamp the current timing run began (0 = not running)
  var peekOn = false;
  var peekHeld = false;
  var peekDownAt = 0;
  var peekWasOn = false;
  var drag = null;      // { from, x, y, moved, overIdx }

  /* ------------------------------------------------------------- utilities */

  function on(el, type, fn, opts) {
    if (!el) return;
    el.addEventListener(type, fn, opts);
    listeners.push([el, type, fn, opts]);
  }

  function offAll() {
    for (var i = 0; i < listeners.length; i++) {
      var L = listeners[i];
      try { L[0].removeEventListener(L[1], L[2], L[3]); } catch (e) { /* detached */ }
    }
    listeners = [];
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function clampInt(v, lo, hi) {
    v = Math.round(Number(v));
    if (!isFinite(v)) v = lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function imageById(id) {
    for (var i = 0; i < IMAGES.length; i++) if (IMAGES[i].id === id) return IMAGES[i];
    return null;
  }

  function okImages() {
    var out = [];
    for (var i = 0; i < IMAGES.length; i++) {
      if (imgStatus[IMAGES[i].src] !== "bad") out.push(IMAGES[i]);
    }
    return out;
  }

  /* current photo, whatever kind is active: { src, w, h, label } */
  function imageInfo() {
    if (state.activeKind === "upload" && state.uploaded) {
      return { src: state.uploaded.dataUrl, w: state.uploaded.w, h: state.uploaded.h, label: "Your photo" };
    }
    var img = imageById(state.activeBuiltinId) || IMAGES[0];
    return { src: img.src, w: img.w, h: img.h, label: img.label };
  }

  /* ---------------------------------------------------------- grid solver
   * Given a target piece count and the image's real aspect ratio, pick
   * rows x cols so rows*cols lands as close to the target as achievable
   * while keeping individual tiles reasonably square. We scan every
   * candidate row count, reject anything that misses the target by more
   * than 15%, and among what's left prefer the squarest tiles.
   */

  function computeGrid(pieces, aspect) {
    pieces = clampInt(pieces, MIN_PIECES, MAX_PIECES);
    aspect = (isFinite(aspect) && aspect > 0) ? aspect : 1;

    var best = null;
    for (var rows = 2; rows <= pieces; rows++) {
      var cols = Math.max(2, Math.round(pieces / rows));
      var product = rows * cols;
      var err = Math.abs(product - pieces) / pieces;
      if (err > 0.15) continue;

      var tileRatio = (aspect * rows) / cols;  // 1 == perfectly square tile
      var squareDev = Math.abs(tileRatio - 1);
      var score = err + 0.25 * squareDev;

      if (!best || score < best.score) {
        best = { rows: rows, cols: cols, product: product, score: score };
      }
    }
    if (!best) {
      // Only reachable for pathological inputs; fall back to a plain square-ish grid.
      var r = Math.max(2, Math.round(Math.sqrt(pieces / aspect)));
      var c = Math.max(2, Math.round(pieces / r));
      best = { rows: r, cols: c, product: r * c };
    }
    return best;
  }

  /* -------------------------------------------------------------- shuffling
   * Swap-based puzzle, so every permutation is reachable and solvable. We only
   * have to guarantee the scramble is a true permutation, is never the identity,
   * and is actually well mixed (most tiles away from home).
   */

  function displacedCount(order) {
    var c = 0;
    for (var i = 0; i < order.length; i++) if (order[i] !== i) c++;
    return c;
  }

  function isWellShuffled(order) {
    var need = Math.max(2, Math.ceil(order.length * 0.6));
    return displacedCount(order) >= need;
  }

  function shuffleOrder(total) {
    var order, attempts = 0;
    do {
      order = [];
      for (var i = 0; i < total; i++) order.push(i);
      for (var j = total - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var t = order[j]; order[j] = order[k]; order[k] = t;
      }
      attempts++;
    } while (attempts < 40 && !isWellShuffled(order));

    // Hard guarantee: never hand back a solved board.
    if (displacedCount(order) === 0 && total > 1) {
      var a = order[0];
      order[0] = order[total - 1];
      order[total - 1] = a;
    }
    return order;
  }

  function isSolved(order) { return displacedCount(order) === 0; }

  /* ------------------------------------------------------------ persistence */

  function defaultState() {
    var img = IMAGES[0];
    var grid = computeGrid(DEFAULT_PIECES, img.w / img.h);
    return {
      activeKind: "builtin",
      activeBuiltinId: img.id,
      uploaded: null,
      pieces: DEFAULT_PIECES,
      rows: grid.rows,
      cols: grid.cols,
      order: shuffleOrder(grid.rows * grid.cols),
      moves: 0,
      elapsed: 0,
      solved: false
    };
  }

  function validUploaded(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.dataUrl !== "string" || raw.dataUrl.indexOf("data:image") !== 0) return null;
    var w = raw.w, h = raw.h;
    if (typeof w !== "number" || typeof h !== "number" || w <= 0 || h <= 0) return null;
    return { dataUrl: raw.dataUrl, w: w, h: h };
  }

  function validState(raw) {
    if (!raw || typeof raw !== "object") return null;

    var uploaded = validUploaded(raw.uploaded);
    var kind = raw.activeKind === "upload" && uploaded ? "upload" : "builtin";
    var builtinId = imageById(raw.activeBuiltinId) ? raw.activeBuiltinId : IMAGES[0].id;
    if (kind === "builtin" && !imageById(builtinId)) return null;

    var rows = raw.rows, cols = raw.cols;
    if (typeof rows !== "number" || typeof cols !== "number" || rows < 2 || cols < 2) return null;
    rows = Math.floor(rows); cols = Math.floor(cols);
    var n = rows * cols;
    if (!Array.isArray(raw.order) || raw.order.length !== n) return null;

    var seen = new Array(n);
    for (var i = 0; i < n; i++) {
      var v = raw.order[i];
      if (typeof v !== "number" || v < 0 || v >= n || v % 1 !== 0 || seen[v]) return null;
      seen[v] = true;
    }

    var pieces = clampInt(raw.pieces, MIN_PIECES, MAX_PIECES);

    return {
      activeKind: kind,
      activeBuiltinId: builtinId,
      uploaded: kind === "upload" ? uploaded : uploaded, // keep it around even if inactive
      pieces: pieces,
      rows: rows,
      cols: cols,
      order: raw.order.slice(),
      moves: (typeof raw.moves === "number" && raw.moves >= 0) ? Math.floor(raw.moves) : 0,
      elapsed: (typeof raw.elapsed === "number" && raw.elapsed >= 0) ? raw.elapsed : 0,
      solved: !!raw.solved
    };
  }

  function load() {
    var raw = null;
    try {
      var s = window.localStorage.getItem(STORAGE_KEY);
      if (s) raw = JSON.parse(s);
    } catch (e) {
      raw = null;
    }
    var ok = null;
    try { ok = validState(raw); } catch (e) { ok = null; }
    if (ok) {
      ok.solved = isSolved(ok.order); // trust the board, not the stored flag
      return ok;
    }
    return defaultState();
  }

  function save() {
    if (!state) return;
    var payload = {
      activeKind: state.activeKind,
      activeBuiltinId: state.activeBuiltinId,
      uploaded: state.uploaded,
      pieces: state.pieces,
      rows: state.rows,
      cols: state.cols,
      order: state.order,
      moves: state.moves,
      elapsed: totalElapsed(),
      solved: state.solved
    };

    // An uploaded photo that got too big to store safely: persist as if a
    // builtin photo were active instead, rather than losing everything or
    // throwing. The live session keeps the real upload either way.
    if (payload.uploaded && payload.uploaded.dataUrl.length > UPLOAD_STORE_CAP) {
      payload.uploaded = null;
      if (payload.activeKind === "upload") {
        payload.activeKind = "builtin";
        payload.activeBuiltinId = imageById(state.activeBuiltinId) ? state.activeBuiltinId : IMAGES[0].id;
      }
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Quota exceeded or private mode: retry once without the photo data
      // before giving up quietly. The puzzle keeps playing either way.
      try {
        payload.uploaded = null;
        if (payload.activeKind === "upload") {
          payload.activeKind = "builtin";
          payload.activeBuiltinId = imageById(state.activeBuiltinId) ? state.activeBuiltinId : IMAGES[0].id;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e2) { /* still no room — the puzzle keeps working in-memory */ }
    }
  }

  /* ------------------------------------------------------------------ timer */

  function totalElapsed() {
    var base = state ? state.elapsed : 0;
    return runStart ? base + (Date.now() - runStart) : base;
  }

  function startTimer() {
    if (runStart || !state || state.solved) return;
    runStart = Date.now();
    if (tickId) clearInterval(tickId);
    tickId = setInterval(paintHud, 1000);
  }

  function stopTimer() {
    if (runStart && state) {
      state.elapsed += Date.now() - runStart;
      runStart = 0;
    }
    if (tickId) { clearInterval(tickId); tickId = null; }
  }

  /* ------------------------------------------------------------ image probe */

  function probeImages() {
    var token = ++loadToken;
    for (var i = 0; i < IMAGES.length; i++) probeOne(IMAGES[i], token);
  }

  function probeOne(entry, token) {
    if (imgStatus[entry.src] === "ok") return;
    var probe = new Image();
    probe.onload = function () {
      if (token !== loadToken || !mounted) return;
      imgStatus[entry.src] = "ok";
      // Defensive: if the real file ever differs from our recorded size,
      // trust the browser and recompute so the solver stays accurate.
      if (probe.naturalWidth && probe.naturalHeight &&
          (probe.naturalWidth !== entry.w || probe.naturalHeight !== entry.h)) {
        entry.w = probe.naturalWidth;
        entry.h = probe.naturalHeight;
        if (state && state.activeKind === "builtin" && state.activeBuiltinId === entry.id) {
          regenerateBoard(true);
        }
      }
    };
    probe.onerror = function () {
      if (token !== loadToken || !mounted) return;
      imgStatus[entry.src] = "bad";
      dropImage(entry);
    };
    probe.src = entry.src;
  }

  function dropImage(entry) {
    if (els && els.picker) {
      var chip = els.picker.querySelector('[data-img="' + entry.id + '"]');
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
    }
    if (state && state.activeKind === "builtin" && state.activeBuiltinId === entry.id) {
      var alt = okImages()[0];
      if (alt) {
        applyBuiltin(alt.id, true);
        setStatus("That photo would not load, so we swapped in " + alt.label + ".");
      }
    }
  }

  /* ------------------------------------------------------------------ build */

  function build() {
    root = el("div", "jig-root");

    var shell = el("div", "jig-shell");

    var head = el("div", "jig-head");
    head.appendChild(el("p", "jig-eyebrow", "Games"));
    head.appendChild(el("h2", "jig-title", "Picture Puzzle"));
    head.appendChild(el("p", "jig-script", "put our view back together"));
    shell.appendChild(head);

    // HUD
    var hud = el("div", "jig-hud");
    els = {};
    els.moves = hudCell(hud, "Moves");
    els.time = hudCell(hud, "Time");
    els.left = hudCell(hud, "To place");
    els.count = hudCell(hud, "Pieces");
    shell.appendChild(hud);

    // headline feature: upload her own photo
    var uploadRow = el("div", "jig-upload-row");
    var uploadLabel = el("label", "jig-upload-btn");
    uploadLabel.appendChild(el("span", "jig-upload-icon", "📷"));
    var uploadText = el("span", "jig-upload-text");
    uploadText.appendChild(el("strong", null, "Upload your photo"));
    uploadText.appendChild(el("small", null, "turn any picture into the puzzle"));
    uploadLabel.appendChild(uploadText);
    els.uploadInput = document.createElement("input");
    els.uploadInput.type = "file";
    els.uploadInput.accept = "image/*";
    els.uploadInput.className = "jig-upload-input jig-sr";
    els.uploadInput.setAttribute("aria-label", "Upload your own photo for the puzzle");
    uploadLabel.appendChild(els.uploadInput);
    uploadRow.appendChild(uploadLabel);
    els.uploadStatus = el("small", "jig-upload-status", "");
    uploadRow.appendChild(els.uploadStatus);
    shell.appendChild(uploadRow);

    // piece count
    var pieceRow = el("div", "jig-row");
    var pieces = el("div", "jig-pieces");
    pieces.setAttribute("role", "group");
    pieces.setAttribute("aria-label", "Piece count");
    els.pieces = pieces;
    for (var p = 0; p < PIECE_PRESETS.length; p++) {
      var pv = PIECE_PRESETS[p];
      var pb = el("button", "jig-size", String(pv));
      pb.type = "button";
      pb.setAttribute("data-pieces", String(pv));
      pb.setAttribute("aria-pressed", "false");
      pieces.appendChild(pb);
    }
    var customWrap = el("span", "jig-pieces-custom");
    els.piecesInput = document.createElement("input");
    els.piecesInput.type = "number";
    els.piecesInput.className = "jig-pieces-input";
    els.piecesInput.min = String(MIN_PIECES);
    els.piecesInput.max = String(MAX_PIECES);
    els.piecesInput.placeholder = "6-200";
    els.piecesInput.setAttribute("aria-label", "Custom piece count, 6 to 200");
    customWrap.appendChild(els.piecesInput);
    els.piecesGo = el("button", "jig-btn jig-pieces-go", "Go");
    els.piecesGo.type = "button";
    customWrap.appendChild(els.piecesGo);
    pieces.appendChild(customWrap);
    pieceRow.appendChild(pieces);
    shell.appendChild(pieceRow);

    // peek + shuffle
    var row = el("div", "jig-row");

    els.peek = el("button", "jig-btn", "Peek");
    els.peek.type = "button";
    els.peek.setAttribute("aria-pressed", "false");
    els.peek.title = "Hold to look at the photo";
    row.appendChild(els.peek);

    els.shuffle = el("button", "jig-btn jig-primary", "Shuffle again");
    els.shuffle.type = "button";
    row.appendChild(els.shuffle);

    shell.appendChild(row);

    // photo picker (built-in photos + the last uploaded one, if any)
    var pickerLabel = el("p", "jig-picker-label", "or pick one of ours");
    shell.appendChild(pickerLabel);

    var picker = el("div", "jig-picker");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Choose a photo");
    els.picker = picker;
    for (var j = 0; j < IMAGES.length; j++) {
      var im = IMAGES[j];
      if (imgStatus[im.src] === "bad") continue;
      var chip = el("button", "jig-pick");
      chip.type = "button";
      chip.setAttribute("data-img", im.id);
      chip.setAttribute("aria-pressed", "false");
      chip.setAttribute("aria-label", im.label);
      chip.title = im.label;
      chip.style.backgroundImage = 'url("' + im.src + '")';
      picker.appendChild(chip);
    }
    shell.appendChild(picker);

    // board + overlays
    var stage = el("div", "jig-stage");
    els.stage = stage;

    var board = el("div", "jig-board");
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", "Puzzle board");
    els.board = board;
    stage.appendChild(board);

    els.peekLayer = el("div", "jig-peek");
    els.peekLayer.setAttribute("aria-hidden", "true");
    stage.appendChild(els.peekLayer);

    var win = el("div", "jig-win");
    win.setAttribute("aria-hidden", "true");
    win.appendChild(el("div", "jig-win-emoji", "🌸"));
    els.winTitle = el("h3", null, "Solved!");
    win.appendChild(els.winTitle);
    els.winLine = el("p", null, "");
    win.appendChild(els.winLine);
    els.again = el("button", "jig-btn jig-primary", "Play again");
    els.again.type = "button";
    win.appendChild(els.again);
    els.win = win;
    stage.appendChild(win);

    shell.appendChild(stage);

    els.status = el("p", "jig-status");
    els.status.setAttribute("role", "status");
    els.status.setAttribute("aria-live", "polite");
    shell.appendChild(els.status);

    root.appendChild(shell);
    return root;
  }

  function hudCell(parent, label) {
    var cell = el("div", "jig-hud-cell");
    cell.appendChild(el("small", null, label));
    var strong = el("strong", null, "0");
    cell.appendChild(strong);
    parent.appendChild(cell);
    return strong;
  }

  /* ------------------------------------------------------------------ paint */

  function paintBoard() {
    var rows = state.rows, cols = state.cols;
    var total = rows * cols;
    var info = imageInfo();
    var board = els.board;

    board.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    board.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";
    board.style.aspectRatio = info.w && info.h ? (info.w + " / " + info.h) : "1 / 1";
    board.classList.toggle("jig-solved", !!state.solved);

    if (board.children.length !== total) {
      board.textContent = "";
      for (var i = 0; i < total; i++) {
        var t = el("button", "jig-tile");
        t.type = "button";
        t.setAttribute("data-idx", String(i));
        t.draggable = false;
        board.appendChild(t);
      }
    }

    for (var k = 0; k < total; k++) {
      paintTile(board.children[k], k, state.order[k], rows, cols, info.src);
    }
    paintPeek(info.src);
  }

  function paintTile(node, boardIdx, pieceIdx, rows, cols, src) {
    var row = Math.floor(pieceIdx / cols);
    var col = pieceIdx % cols;
    var denomC = cols - 1;
    var denomR = rows - 1;
    node.style.backgroundImage = src ? 'url("' + src + '")' : "";
    // both axes scale independently now that the grid need not be square: a
    // bare percentage on one axis would preserve the photo's own aspect
    // ratio and break the row/column math.
    node.style.backgroundSize = (cols * 100) + "% " + (rows * 100) + "%";
    node.style.backgroundPosition =
      (denomC ? (col / denomC) * 100 : 0) + "% " + (denomR ? (row / denomR) * 100 : 0) + "%";
    node.classList.toggle("jig-home", pieceIdx === boardIdx);
    node.classList.toggle("jig-sel", boardIdx === selected);
    node.setAttribute("aria-pressed", boardIdx === selected ? "true" : "false");
    node.setAttribute(
      "aria-label",
      "Piece " + (pieceIdx + 1) + " at square " + (boardIdx + 1) +
      (pieceIdx === boardIdx ? ", in place" : "")
    );
  }

  function paintPeek(src) {
    els.peekLayer.style.backgroundImage = src ? 'url("' + src + '")' : "";
  }

  function paintHud() {
    if (!state || !els) return;
    els.moves.textContent = String(state.moves);
    els.time.textContent = fmtTime(totalElapsed());
    els.left.textContent = String(displacedCount(state.order));
    els.count.textContent = String(state.rows * state.cols);
  }

  function paintControls() {
    var i, node;

    var pieceBtns = els.pieces.querySelectorAll(".jig-size");
    for (i = 0; i < pieceBtns.length; i++) {
      node = pieceBtns[i];
      node.setAttribute("aria-pressed", Number(node.getAttribute("data-pieces")) === state.pieces ? "true" : "false");
    }
    els.piecesInput.value = PIECE_PRESETS.indexOf(state.pieces) === -1 ? String(state.pieces) : "";

    var chips = els.picker.children;
    for (i = 0; i < chips.length; i++) {
      node = chips[i];
      var isUploadChip = node.classList.contains("jig-pick-upload");
      var active = isUploadChip ? state.activeKind === "upload" : (state.activeKind === "builtin" && node.getAttribute("data-img") === state.activeBuiltinId);
      node.setAttribute("aria-pressed", active ? "true" : "false");
    }

    els.peek.setAttribute("aria-pressed", peekOn ? "true" : "false");
    els.peekLayer.classList.toggle("jig-show", peekOn);
    els.win.classList.toggle("jig-show", !!state.solved);
    els.win.setAttribute("aria-hidden", state.solved ? "false" : "true");
  }

  function syncUploadChip() {
    var existing = els.picker.querySelector(".jig-pick-upload");
    if (!state.uploaded) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (!existing) {
      existing = el("button", "jig-pick jig-pick-upload");
      existing.type = "button";
      existing.setAttribute("aria-label", "Your uploaded photo");
      existing.title = "Your photo";
      els.picker.insertBefore(existing, els.picker.firstChild);
    }
    existing.style.backgroundImage = 'url("' + state.uploaded.dataUrl + '")';
  }

  function setStatus(msg) {
    if (els && els.status) els.status.textContent = msg || "";
  }

  function paintAll() {
    syncUploadChip();
    paintBoard();
    paintHud();
    paintControls();
  }

  /* ----------------------------------------------------------------- moves */

  function regenerateBoard(keepStatus) {
    stopTimer();
    selected = -1;
    var info = imageInfo();
    var grid = computeGrid(state.pieces, info.w / info.h);
    state.rows = grid.rows;
    state.cols = grid.cols;
    state.order = shuffleOrder(grid.rows * grid.cols);
    state.moves = 0;
    state.elapsed = 0;
    state.solved = false;
    setPeek(false);
    paintAll();
    save();
    if (!keepStatus) setStatus("");
  }

  function applyBuiltin(id, keepStatus) {
    if (!imageById(id)) return;
    state.activeKind = "builtin";
    state.activeBuiltinId = id;
    regenerateBoard(keepStatus);
  }

  function applyUpload(dataUrl, w, h) {
    state.uploaded = { dataUrl: dataUrl, w: w, h: h };
    state.activeKind = "upload";
    regenerateBoard(true);
    setStatus("Your photo is loaded. Shuffled and ready.");
  }

  function applyPieceCount(n) {
    n = clampInt(n, MIN_PIECES, MAX_PIECES);
    if (n === state.pieces) return;
    state.pieces = n;
    regenerateBoard(true);
    var actual = state.rows * state.cols;
    setStatus(actual === n
      ? "Now " + actual + " pieces."
      : "Now " + actual + " pieces (closest fit for this photo's shape)."
    );
  }

  function swap(a, b) {
    if (a === b || a < 0 || b < 0) return;
    var order = state.order;
    var t = order[a]; order[a] = order[b]; order[b] = t;
    state.moves++;
    selected = -1;
    startTimer();

    paintBoard();
    paintHud();

    flash(a); flash(b);

    if (isSolved(state.order)) celebrate();
    save();
  }

  function flash(idx) {
    var node = els.board.children[idx];
    if (!node) return;
    node.classList.remove("jig-just");
    void node.offsetWidth;
    node.classList.add("jig-just");
  }

  function selectTile(idx) {
    if (state.solved) return;
    if (selected === idx) {
      selected = -1;
      paintBoard();
      setStatus("");
      return;
    }
    if (selected === -1) {
      selected = idx;
      paintBoard();
      setStatus("Now tap the square it should trade places with.");
      return;
    }
    swap(selected, idx);
    if (!state.solved) setStatus("");
  }

  function celebrate() {
    state.solved = true;
    stopTimer();
    selected = -1;
    paintBoard();
    paintControls();
    els.winLine.textContent = pick(WIN_LINES);
    els.winTitle.textContent = "Solved in " + state.moves + " moves";
    setStatus("Finished in " + fmtTime(totalElapsed()) + ".");

    try {
      if (window.Bloom && typeof window.Bloom.confetti === "function") {
        var r = els.board.getBoundingClientRect();
        window.Bloom.confetti(r.left + r.width / 2, r.top + r.height / 2);
      }
    } catch (e) { /* confetti is a nicety, never a failure */ }
  }

  /* ------------------------------------------------------------------ peek */

  function setPeek(next) {
    peekOn = !!next;
    if (els) {
      els.peek.setAttribute("aria-pressed", peekOn ? "true" : "false");
      els.peekLayer.classList.toggle("jig-show", peekOn);
    }
  }

  /* --------------------------------------------------------------- upload */

  function revokePending() {
    if (pendingObjectUrl) {
      try { URL.revokeObjectURL(pendingObjectUrl); } catch (e) { /* already gone */ }
      pendingObjectUrl = null;
    }
  }

  function handleUploadFile(file) {
    setStatus("Loading your photo…");
    if (els.uploadStatus) els.uploadStatus.textContent = "Loading…";

    revokePending();
    var url;
    try {
      url = URL.createObjectURL(file);
    } catch (e) {
      setStatus("Could not read that file.");
      return;
    }
    pendingObjectUrl = url;
    var myToken = ++loadToken;

    var img = new Image();
    img.onload = function () {
      var wasPending = pendingObjectUrl === url;
      revokePending();
      if (myToken !== loadToken || !mounted || !wasPending) return;

      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) {
        setStatus("That photo could not be used.");
        if (els.uploadStatus) els.uploadStatus.textContent = "";
        return;
      }

      var scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));

      var dataUrl;
      try {
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);
        dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      } catch (e) {
        setStatus("Could not process that photo.");
        if (els.uploadStatus) els.uploadStatus.textContent = "";
        return;
      }

      if (els.uploadStatus) els.uploadStatus.textContent = "";
      applyUpload(dataUrl, cw, ch);
    };
    img.onerror = function () {
      var wasPending = pendingObjectUrl === url;
      revokePending();
      if (myToken !== loadToken || !mounted || !wasPending) return;
      setStatus("Could not read that photo.");
      if (els.uploadStatus) els.uploadStatus.textContent = "";
    };
    img.src = url;
  }

  /* -------------------------------------------------------------- pointer  */

  function tileIndexFromEvent(ev) {
    var node = ev.target && ev.target.closest ? ev.target.closest(".jig-tile") : null;
    if (!node || !els.board.contains(node)) return -1;
    return Number(node.getAttribute("data-idx"));
  }

  function tileIndexFromPoint(x, y) {
    var node = document.elementFromPoint(x, y);
    if (!node) return -1;
    var tile = node.closest ? node.closest(".jig-tile") : null;
    if (!tile || !els.board.contains(tile)) return -1;
    return Number(tile.getAttribute("data-idx"));
  }

  function clearOver() {
    if (!drag || drag.overIdx < 0) return;
    var node = els.board.children[drag.overIdx];
    if (node) node.classList.remove("jig-over");
    drag.overIdx = -1;
  }

  function onBoardPointerDown(ev) {
    if (state.solved || ev.button > 0) return;
    var idx = tileIndexFromEvent(ev);
    if (idx < 0) return;
    drag = { from: idx, x: ev.clientX, y: ev.clientY, moved: false, overIdx: -1 };
  }

  function onBoardPointerMove(ev) {
    if (!drag) return;
    var dx = ev.clientX - drag.x;
    var dy = ev.clientY - drag.y;
    if (!drag.moved && (dx * dx + dy * dy) < 64) return; // 8px threshold
    drag.moved = true;

    var over = tileIndexFromPoint(ev.clientX, ev.clientY);
    if (over === drag.overIdx) return;
    clearOver();
    if (over >= 0 && over !== drag.from) {
      var node = els.board.children[over];
      if (node) { node.classList.add("jig-over"); drag.overIdx = over; }
    }
  }

  function onBoardPointerUp(ev) {
    if (!drag) return;
    var d = drag;
    clearOver();
    drag = null;
    if (state.solved) return;

    if (d.moved) {
      var to = tileIndexFromPoint(ev.clientX, ev.clientY);
      if (to >= 0 && to !== d.from) {
        selected = -1;
        swap(d.from, to);
        if (!state.solved) setStatus("");
      } else {
        paintBoard();
      }
      return;
    }
    selectTile(d.from);
  }

  function onBoardPointerCancel() {
    if (!drag) return;
    clearOver();
    drag = null;
    paintBoard();
  }

  /* ---------------------------------------------------------------- wiring */

  function wire() {
    // board: pointer drives both tap-to-swap and drag-to-swap
    on(els.board, "pointerdown", onBoardPointerDown);
    on(els.board, "pointermove", onBoardPointerMove);
    on(window, "pointerup", onBoardPointerUp);
    on(window, "pointercancel", onBoardPointerCancel);
    on(els.board, "dragstart", function (ev) { ev.preventDefault(); });

    // keyboard: buttons fire click without a pointer sequence
    on(els.board, "click", function (ev) {
      if (ev.detail !== 0) return; // real pointer clicks already handled
      var idx = tileIndexFromEvent(ev);
      if (idx >= 0) selectTile(idx);
    });

    // piece count presets
    on(els.pieces, "click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".jig-size") : null;
      if (!b) return;
      applyPieceCount(Number(b.getAttribute("data-pieces")));
    });

    // custom piece count
    function applyCustomPieces() {
      var raw = els.piecesInput.value;
      if (raw === "") return;
      applyPieceCount(Number(raw));
    }
    on(els.piecesGo, "click", applyCustomPieces);
    on(els.piecesInput, "keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); applyCustomPieces(); }
    });

    // upload
    on(els.uploadInput, "change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = ""; // allow re-selecting the same file later
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        setStatus("Please choose an image file.");
        return;
      }
      handleUploadFile(file);
    });

    // photo picker (built-ins + the upload chip)
    on(els.picker, "click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".jig-pick") : null;
      if (!b) return;
      if (b.classList.contains("jig-pick-upload")) {
        if (state.activeKind !== "upload" && state.uploaded) {
          state.activeKind = "upload";
          regenerateBoard(true);
          setStatus("Your photo, scrambled and ready.");
        }
        return;
      }
      var id = b.getAttribute("data-img");
      if (!id || (state.activeKind === "builtin" && id === state.activeBuiltinId)) return;
      var img = imageById(id);
      if (!img) return;
      applyBuiltin(id, true);
      setStatus(img.label + ", scrambled and ready.");
    });

    // shuffle
    on(els.shuffle, "click", function () {
      regenerateBoard(true);
      setStatus("Shuffled.");
    });

    on(els.again, "click", function () {
      regenerateBoard(true);
      setStatus("Shuffled.");
    });

    // peek: hold to preview, tap to toggle, Enter/Space to toggle
    on(els.peek, "pointerdown", function () {
      peekHeld = true;
      peekWasOn = peekOn;
      peekDownAt = Date.now();
      setPeek(true);
    });
    on(els.peek, "pointerup", function () {
      if (!peekHeld) return;
      peekHeld = false;
      var held = Date.now() - peekDownAt;
      setPeek(held > 250 ? false : !peekWasOn);
    });
    on(els.peek, "pointercancel", function () {
      if (!peekHeld) return;
      peekHeld = false;
      setPeek(peekWasOn);
    });
    on(els.peek, "click", function (ev) {
      if (ev.detail !== 0) return; // pointer path already handled it
      setPeek(!peekOn); // keyboard activation
    });

    // pause the clock when the tab is hidden
    on(document, "visibilitychange", function () {
      if (document.hidden) stopTimer();
      else if (state && !state.solved && state.moves > 0) startTimer();
    });
  }

  /* ------------------------------------------------------------ public API */

  function mount(containerEl) {
    if (!containerEl || !containerEl.appendChild) return;
    if (mounted) unmount(); // mounting twice must not duplicate state

    host = containerEl;
    state = load();

    host.textContent = "";
    host.appendChild(build());
    mounted = true;

    wire();
    probeImages();
    paintAll();
    save(); // persist the scramble immediately, not just on the first move

    if (state.solved) {
      els.winTitle.textContent = "Solved in " + state.moves + " moves";
      els.winLine.textContent = pick(WIN_LINES);
    } else if (state.moves > 0) {
      startTimer();
      setStatus("Picking up where you left off.");
    } else {
      setStatus("Tap one square, then tap another to trade them.");
    }
  }

  function unmount() {
    if (!mounted) return;
    stopTimer();
    save();
    offAll();
    loadToken++;          // orphan any in-flight image probes / uploads
    revokePending();
    drag = null;
    selected = -1;
    peekOn = false;
    peekHeld = false;
    if (host) host.textContent = "";
    host = null;
    root = null;
    els = null;
    mounted = false;
  }

  window.MoonpieJigsaw = {
    mount: mount,
    unmount: unmount,
    // internal seams, exposed for unit tests
    _shuffle: shuffleOrder,
    _computeGrid: computeGrid
  };
})();
