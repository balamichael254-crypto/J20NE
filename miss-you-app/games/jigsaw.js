/* Moonpie jigsaw — a photo tile puzzle for the games world.
 *
 * Plain browser IIFE: no modules, no build step, no dependencies.
 * Exposes window.MoonpieJigsaw = { mount(containerEl), unmount() }.
 *
 * The photo is never canvas-sliced. Each tile is the same image used as a CSS
 * background at background-size:(N*100)% with a per-tile background-position, so
 * the puzzle stays sharp at any DPI and costs one image decode for the whole board.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "moonpie-jigsaw-v1";
  var SIZES = [3, 4, 5];
  var DEFAULT_SIZE = 3;

  /* Photographs that actually ship with the app (verified on disk under
   * miss-you-app/assets/worlds/). Any entry that fails to load at runtime is
   * dropped from the picker rather than rendered as broken tiles. */
  var IMAGES = [
    { id: "paris", src: "./assets/worlds/paris-1.webp", label: "Paris at Midnight" },
    { id: "santorini", src: "./assets/worlds/santorini-1.webp", label: "Santorini" },
    { id: "maldives", src: "./assets/worlds/maldives-1.webp", label: "The Maldives" },
    { id: "kyoto", src: "./assets/worlds/kyoto-1.webp", label: "Kyoto" },
    { id: "venice", src: "./assets/worlds/venice-1.webp", label: "Venice" },
    { id: "amalfi", src: "./assets/worlds/amalfi-1.webp", label: "Amalfi" },
    { id: "aurora", src: "./assets/worlds/aurora-1.webp", label: "The Aurora" },
    { id: "kenya", src: "./assets/worlds/kenya-1.webp", label: "Kenya" }
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

  var state = null;     // { imageId, size, order[], moves, elapsed, solved }
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

  function defaultState(imageId, size) {
    var n = size * size;
    return {
      imageId: imageId,
      size: size,
      order: shuffleOrder(n),
      moves: 0,
      elapsed: 0,
      solved: false
    };
  }

  function validState(raw) {
    if (!raw || typeof raw !== "object") return null;
    var size = raw.size;
    if (SIZES.indexOf(size) === -1) return null;
    var n = size * size;
    if (!Array.isArray(raw.order) || raw.order.length !== n) return null;

    // order must be a permutation of 0..n-1
    var seen = new Array(n);
    for (var i = 0; i < n; i++) {
      var v = raw.order[i];
      if (typeof v !== "number" || v < 0 || v >= n || v % 1 !== 0 || seen[v]) return null;
      seen[v] = true;
    }

    var img = imageById(raw.imageId);
    if (!img) return null;

    return {
      imageId: img.id,
      size: size,
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
    var ok = validState(raw);
    if (ok) {
      // trust the board, not the stored flag
      ok.solved = isSolved(ok.order);
      return ok;
    }
    return defaultState(IMAGES[0].id, DEFAULT_SIZE);
  }

  function save() {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        imageId: state.imageId,
        size: state.size,
        order: state.order,
        moves: state.moves,
        elapsed: totalElapsed(),
        solved: state.solved
      }));
    } catch (e) { /* private mode / quota — puzzle still plays */ }
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
    };
    probe.onerror = function () {
      if (token !== loadToken || !mounted) return;
      imgStatus[entry.src] = "bad";
      dropImage(entry);
    };
    probe.src = entry.src;
  }

  function dropImage(entry) {
    // remove its chip from the picker
    if (els && els.picker) {
      var chip = els.picker.querySelector('[data-img="' + entry.id + '"]');
      if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
    }
    // if it was the active photo, fall back to the first one that works
    if (state && state.imageId === entry.id) {
      var alt = okImages()[0];
      if (alt) {
        state.imageId = alt.id;
        newBoard(state.size, true);
        setStatus("That photo would not load, so we swapped in " + alt.label + ".");
      }
    }
    if (els && els.picker && !els.picker.children.length) {
      setStatus("None of the photos could load right now.");
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
    shell.appendChild(hud);

    // size + actions
    var row = el("div", "jig-row");

    var sizes = el("div", "jig-sizes");
    sizes.setAttribute("role", "group");
    sizes.setAttribute("aria-label", "Puzzle size");
    els.sizes = sizes;
    for (var i = 0; i < SIZES.length; i++) {
      var n = SIZES[i];
      var b = el("button", "jig-size", n + "×" + n);
      b.type = "button";
      b.setAttribute("data-size", String(n));
      b.setAttribute("aria-pressed", "false");
      sizes.appendChild(b);
    }
    row.appendChild(sizes);

    els.peek = el("button", "jig-btn", "Peek");
    els.peek.type = "button";
    els.peek.setAttribute("aria-pressed", "false");
    els.peek.title = "Hold to look at the photo";
    row.appendChild(els.peek);

    els.shuffle = el("button", "jig-btn jig-primary", "Shuffle again");
    els.shuffle.type = "button";
    row.appendChild(els.shuffle);

    shell.appendChild(row);

    // photo picker
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

  function currentSrc() {
    var img = imageById(state.imageId);
    return img ? img.src : "";
  }

  function paintBoard() {
    var n = state.size;
    var total = n * n;
    var src = currentSrc();
    var board = els.board;

    board.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    board.classList.toggle("jig-solved", !!state.solved);

    // rebuild tiles only when the count changed; otherwise restyle in place
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
      paintTile(board.children[k], k, state.order[k], n, src);
    }
    paintPeek(src);
  }

  function paintTile(node, boardIdx, pieceIdx, n, src) {
    var row = Math.floor(pieceIdx / n);
    var col = pieceIdx % n;
    var denom = n - 1;
    node.style.backgroundImage = src ? 'url("' + src + '")' : "";
    // both axes must be N*100%: a bare "500%" computes to "500% auto", which
    // preserves the photo's aspect ratio and breaks the row math.
    node.style.backgroundSize = (n * 100) + "% " + (n * 100) + "%";
    node.style.backgroundPosition =
      (denom ? (col / denom) * 100 : 0) + "% " + (denom ? (row / denom) * 100 : 0) + "%";
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
  }

  function paintControls() {
    var i, node;
    var sizeBtns = els.sizes.children;
    for (i = 0; i < sizeBtns.length; i++) {
      node = sizeBtns[i];
      node.setAttribute("aria-pressed", Number(node.getAttribute("data-size")) === state.size ? "true" : "false");
    }
    var chips = els.picker.children;
    for (i = 0; i < chips.length; i++) {
      node = chips[i];
      node.setAttribute("aria-pressed", node.getAttribute("data-img") === state.imageId ? "true" : "false");
    }
    els.peek.setAttribute("aria-pressed", peekOn ? "true" : "false");
    els.peekLayer.classList.toggle("jig-show", peekOn);
    els.win.classList.toggle("jig-show", !!state.solved);
    els.win.setAttribute("aria-hidden", state.solved ? "false" : "true");
  }

  function setStatus(msg) {
    if (els && els.status) els.status.textContent = msg || "";
  }

  function paintAll() {
    paintBoard();
    paintHud();
    paintControls();
  }

  /* ----------------------------------------------------------------- moves */

  function newBoard(size, keepStatus) {
    stopTimer();
    selected = -1;
    state.size = size;
    state.order = shuffleOrder(size * size);
    state.moves = 0;
    state.elapsed = 0;
    state.solved = false;
    setPeek(false);
    paintAll();
    save();
    if (!keepStatus) setStatus("");
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
    // force reflow so the animation restarts
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
    if (!state.solved) setStatus(""); // keep the finishing time on screen
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

    // size
    on(els.sizes, "click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".jig-size") : null;
      if (!b) return;
      var n = Number(b.getAttribute("data-size"));
      if (SIZES.indexOf(n) === -1 || n === state.size) return;
      newBoard(n);
      setStatus("New " + n + "×" + n + " scramble.");
    });

    // photo picker
    on(els.picker, "click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".jig-pick") : null;
      if (!b) return;
      var id = b.getAttribute("data-img");
      if (!id || id === state.imageId) return;
      var img = imageById(id);
      if (!img) return;
      state.imageId = id;
      newBoard(state.size, true);
      setStatus(img.label + ", scrambled and ready.");
    });

    // shuffle
    on(els.shuffle, "click", function () {
      newBoard(state.size);
      setStatus("Shuffled.");
    });

    on(els.again, "click", function () {
      newBoard(state.size);
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

    // make sure the restored photo is one we still ship
    if (!imageById(state.imageId)) state.imageId = IMAGES[0].id;
    state.size = SIZES.indexOf(state.size) === -1 ? DEFAULT_SIZE : state.size;

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
    loadToken++;          // orphan any in-flight image probes
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
    // internal seam, exposed for the shuffle unit test
    _shuffle: shuffleOrder
  };
})();
