/* ===========================================================================
   Moonpie — Memory Match (concentration / pairs)
   Self-contained browser IIFE. No modules, no build, no npm.

   Public contract:
     window.MoonpieMemory = { mount(containerEl), unmount() }

   Pair this with ./memory.css. Nothing else is touched.
   =========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "moonpie-memory-v1";
  var FLIP_BACK_MS = 950; /* how long a wrong pair stays visible */
  var TICK_MS = 250;
  var SAVE_EVERY_TICKS = 20; /* ~5s autosave of the running clock */

  var SIZES = {
    "4x3": { cols: 4, rows: 3, pairs: 6, label: "4 × 3" },
    "4x4": { cols: 4, rows: 4, pairs: 8, label: "4 × 4" },
    "4x5": { cols: 4, rows: 5, pairs: 10, label: "4 × 5" }
  };
  var SIZE_ORDER = ["4x3", "4x4", "4x5"];
  var DEFAULT_SIZE = "4x4";

  /* Fallback shapes drawn in CSS, cycled so every face stays distinguishable
     even if its image never loads. Colour is per-face (mem-g-0 .. mem-g-9). */
  var SHAPES = ["heart", "lily", "moon", "star", "drop"];

  /* ---------------------------------------------------------------------
     CARD FACES
     Every `src` below was verified to exist on disk under miss-you-app/.
     The first 6 are used by 4x3, the first 8 by 4x4, all 10 by 4x5 — so the
     leading entries are ordered for maximum visual contrast.

     NOTE FOR INTEGRATION: this array is the single place to swap art. If a
     dedicated cut-out set (e.g. ./assets/flowers/lily-*.webp) is added later,
     change `src` here and nothing else. Any face whose image fails to load
     degrades to its CSS-drawn shape automatically.
     --------------------------------------------------------------------- */
  var FACES = [
    { id: "paris", src: "./assets/worlds/paris-1.webp", name: "Paris" },
    { id: "kyoto", src: "./assets/worlds/kyoto-1.webp", name: "Kyoto" },
    { id: "aurora", src: "./assets/worlds/aurora-1.webp", name: "the aurora" },
    { id: "cappadocia", src: "./assets/worlds/cappadocia-1.webp", name: "Cappadocia" },
    { id: "santorini", src: "./assets/worlds/santorini-1.webp", name: "Santorini" },
    { id: "marrakech", src: "./assets/worlds/marrakech-1.webp", name: "Marrakech" },
    { id: "maldives", src: "./assets/worlds/maldives-1.webp", name: "the Maldives" },
    { id: "london", src: "./assets/worlds/london-1.webp", name: "London" },
    { id: "venice", src: "./assets/worlds/venice-1.webp", name: "Venice" },
    { id: "bali", src: "./assets/worlds/bali-1.webp", name: "Bali" }
  ];

  var FACE_BY_ID = {};
  (function indexFaces() {
    for (var i = 0; i < FACES.length; i++) {
      FACES[i].index = i;
      FACES[i].shape = SHAPES[i % SHAPES.length];
      FACE_BY_ID[FACES[i].id] = FACES[i];
    }
  })();

  var MATCH_LINES = [
    "a pair. look at us.",
    "found each other again.",
    "that one was ours.",
    "two of a kind, like someone I know.",
    "matched. obviously."
  ];

  /* ------------------------------ runtime ------------------------------ */

  var state = null;      /* game state (also the shape we persist) */
  var duel = null;       /* the shared just-me / together layer */

  /* Seeded and shared while playing together, ordinary random alone. */
  function rnd() { return (duel && duel.mode === "together") ? duel.random() : Math.random(); }
  var host = null;       /* container element passed to mount() */
  var el = null;         /* cached DOM refs */
  var listeners = [];    /* [target, type, handler] — all removed on unmount */
  var tickId = 0;
  var flipId = 0;
  var tickCount = 0;
  var locked = false;    /* input lock during the wrong-pair flip-back */
  var firstIdx = -1;     /* index of the first card of the current turn */
  var runningSince = 0;  /* timestamp the clock last resumed, 0 = paused */
  var failedFaces = {};  /* face id -> true once its image 404s */

  /* ------------------------------ helpers ------------------------------ */

  function on(target, type, handler) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, false);
    listeners.push([target, type, handler]);
  }

  function offAll() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], false);
      } catch (e) { /* node detached already */ }
    }
    listeners = [];
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  }

  function emptyBest() {
    return { "4x3": null, "4x4": null, "4x5": null };
  }

  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------------------------- persistence ---------------------------- */

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object" || isArray(data)) return null;
      return data;
    } catch (e) {
      return null; /* corrupt or unavailable -> fresh game */
    }
  }

  function writeStore(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode / quota — the game still plays */ }
  }

  function save() {
    if (!state) return;
    syncElapsed();
    var deck = [];
    for (var i = 0; i < state.deck.length; i++) {
      var c = state.deck[i];
      deck.push({ f: c.face, m: !!c.matched, u: !!c.up });
    }
    writeStore({
      v: 1,
      size: state.size,
      deck: deck,
      moves: state.moves,
      elapsed: state.elapsed,
      best: state.best
    });
  }

  /* ---------------------------- deck builder --------------------------- */

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function buildDeck(sizeKey) {
    var cfg = SIZES[sizeKey] || SIZES[DEFAULT_SIZE];
    var cards = [];
    for (var i = 0; i < cfg.pairs; i++) {
      cards.push({ face: FACES[i].id, matched: false, up: false });
      cards.push({ face: FACES[i].id, matched: false, up: false });
    }
    return shuffle(cards);
  }

  function freshState(sizeKey, best) {
    if (!SIZES[sizeKey]) sizeKey = DEFAULT_SIZE;
    return {
      size: sizeKey,
      deck: buildDeck(sizeKey),
      moves: 0,
      elapsed: 0,
      won: false,
      best: best || emptyBest()
    };
  }

  function allMatched(st) {
    for (var i = 0; i < st.deck.length; i++) if (!st.deck[i].matched) return false;
    return true;
  }

  /* Matched cards are always face up; a half-finished comparison (two cards up
     but unresolved) is discarded so a restore can never start locked. */
  function normalizeDeck(st) {
    var pending = [];
    for (var i = 0; i < st.deck.length; i++) {
      var c = st.deck[i];
      if (c.matched) c.up = true;
      else if (c.up) pending.push(i);
    }
    if (pending.length > 1) {
      for (var j = 0; j < pending.length; j++) st.deck[pending[j]].up = false;
    }
    st.won = allMatched(st);
  }

  function loadState() {
    var raw = readStore();
    var best = emptyBest();

    if (raw && raw.best && typeof raw.best === "object") {
      for (var k = 0; k < SIZE_ORDER.length; k++) {
        var key = SIZE_ORDER[k];
        var v = raw.best[key];
        if (typeof v === "number" && isFinite(v) && v > 0) best[key] = Math.floor(v);
      }
    }

    var size = (raw && SIZES[raw.size]) ? raw.size : DEFAULT_SIZE;
    var cfg = SIZES[size];
    var deck = null;

    if (raw && isArray(raw.deck) && raw.deck.length === cfg.pairs * 2) {
      var counts = {};
      var out = [];
      var ok = true;
      for (var i = 0; i < raw.deck.length; i++) {
        var c = raw.deck[i];
        var face = (c && typeof c === "object") ? FACE_BY_ID[c.f] : null;
        if (!face || face.index >= cfg.pairs) { ok = false; break; }
        counts[c.f] = (counts[c.f] || 0) + 1;
        out.push({ face: c.f, matched: !!c.m, up: !!c.u });
      }
      if (ok) {
        for (var id in counts) {
          if (Object.prototype.hasOwnProperty.call(counts, id) && counts[id] !== 2) { ok = false; break; }
        }
      }
      if (ok) deck = out;
    }

    if (!deck) return freshState(size, best);

    var st = { size: size, deck: deck, moves: 0, elapsed: 0, won: false, best: best };
    if (raw && typeof raw.moves === "number" && isFinite(raw.moves) && raw.moves >= 0) {
      st.moves = Math.floor(raw.moves);
    }
    if (raw && typeof raw.elapsed === "number" && isFinite(raw.elapsed) && raw.elapsed >= 0) {
      st.elapsed = Math.floor(raw.elapsed);
    }
    normalizeDeck(st);
    return st;
  }

  /* ------------------------------- clock ------------------------------- */

  function syncElapsed() {
    if (!state || !runningSince) return;
    var n = Date.now();
    state.elapsed += (n - runningSince);
    runningSince = n;
  }

  function startClock() {
    if (!state || state.won || runningSince) return;
    runningSince = Date.now();
    if (!tickId) tickId = window.setInterval(onTick, TICK_MS);
  }

  function stopClock() {
    syncElapsed();
    runningSince = 0;
    if (tickId) {
      window.clearInterval(tickId);
      tickId = 0;
    }
  }

  function onTick() {
    if (!state || !el) return;
    syncElapsed();
    el.time.textContent = fmtTime(state.elapsed);
    tickCount++;
    if (tickCount % SAVE_EVERY_TICKS === 0) save();
  }

  function isStarted() {
    if (!state) return false;
    if (state.moves > 0) return true;
    for (var i = 0; i < state.deck.length; i++) {
      if (state.deck[i].up || state.deck[i].matched) return true;
    }
    return false;
  }

  /* ------------------------------ rendering ---------------------------- */

  function sizeButtonsHTML() {
    var out = [];
    for (var i = 0; i < SIZE_ORDER.length; i++) {
      var key = SIZE_ORDER[i];
      out.push(
        '<button type="button" class="mem-size" data-size="' + key + '">' +
          SIZES[key].label +
        "</button>"
      );
    }
    return out.join("");
  }

  function renderShell() {
    host.innerHTML = "";

    var root = document.createElement("div");
    root.className = "mem-root";
    root.innerHTML = [
      '<div class="mem-bar">',
        '<div class="mem-sizes" role="group" aria-label="Board size">',
          sizeButtonsHTML(),
        "</div>",
        '<button type="button" class="mem-new" data-act="new">new game</button>',
      "</div>",
      '<div class="mem-hud">',
        '<span class="mem-stat"><small>moves</small><strong data-ref="moves">0</strong></span>',
        '<span class="mem-stat"><small>time</small><strong data-ref="time">0:00</strong></span>',
        '<span class="mem-stat mem-stat--best"><small>best</small><strong data-ref="best">&mdash;</strong></span>',
      "</div>",
      '<div class="mem-boardwrap">',
        '<div class="mem-board" data-ref="board" aria-label="Memory board"></div>',
      "</div>",
      '<p class="mem-status" data-ref="status" role="status" aria-live="polite"></p>'
    ].join("");

    host.appendChild(root);

    el = {
      root: root,
      board: root.querySelector('[data-ref="board"]'),
      moves: root.querySelector('[data-ref="moves"]'),
      time: root.querySelector('[data-ref="time"]'),
      best: root.querySelector('[data-ref="best"]'),
      status: root.querySelector('[data-ref="status"]')
    };

    on(root, "click", onClick);
  }

  function buildCard(i) {
    var card = state.deck[i];
    var face = FACE_BY_ID[card.face];

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mem-card";
    btn.setAttribute("data-idx", String(i));

    var inner = document.createElement("span");
    inner.className = "mem-inner";

    var back = document.createElement("span");
    back.className = "mem-face mem-back";

    var front = document.createElement("span");
    front.className = "mem-face mem-front";

    var glyph = document.createElement("span");
    glyph.className = "mem-glyph mem-glyph--" + face.shape + " mem-g-" + face.index;
    front.appendChild(glyph);

    if (failedFaces[face.id]) {
      front.className += " is-fallback";
    } else {
      var img = document.createElement("img");
      img.className = "mem-img";
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", function () {
        failedFaces[face.id] = true;
        markFallback(face.id);
      }, false);
      img.src = face.src;
      front.appendChild(img);
    }

    inner.appendChild(back);
    inner.appendChild(front);
    btn.appendChild(inner);
    return btn;
  }

  /* An image 404'd — swap every card of that face to its CSS-drawn shape. */
  function markFallback(faceId) {
    if (!el || !state) return;
    for (var i = 0; i < state.deck.length; i++) {
      if (state.deck[i].face !== faceId) continue;
      var node = el.board.children[i];
      if (!node) continue;
      var front = node.querySelector(".mem-front");
      if (front && front.className.indexOf("is-fallback") === -1) {
        front.className += " is-fallback";
      }
    }
  }

  function renderBoard() {
    el.board.setAttribute("data-size", state.size);
    el.board.innerHTML = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < state.deck.length; i++) frag.appendChild(buildCard(i));
    el.board.appendChild(frag);
    for (var j = 0; j < state.deck.length; j++) syncCard(j);
  }

  function syncCard(i) {
    if (!el) return;
    var node = el.board.children[i];
    if (!node) return;
    var c = state.deck[i];
    var face = FACE_BY_ID[c.face];
    var up = c.up || c.matched;

    node.className = "mem-card" + (up ? " is-up" : "") + (c.matched ? " is-matched" : "");
    node.disabled = !!c.matched;
    node.setAttribute("aria-pressed", up ? "true" : "false");
    node.setAttribute(
      "aria-label",
      c.matched ? (face.name + ", matched")
        : up ? face.name
        : ("Face down card " + (i + 1))
    );
  }

  function paintStats() {
    if (!el || !state) return;
    el.moves.textContent = String(state.moves);
    el.time.textContent = fmtTime(state.elapsed);
    var best = state.best[state.size];
    el.best.textContent = (best == null) ? "not yet" : (best + " moves");
  }

  function paintSizes() {
    if (!el) return;
    var nodes = el.root.querySelectorAll(".mem-size");
    for (var i = 0; i < nodes.length; i++) {
      var active = nodes[i].getAttribute("data-size") === state.size;
      nodes[i].className = "mem-size" + (active ? " is-active" : "");
      nodes[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function setStatus(text, strong) {
    if (!el) return;
    el.status.textContent = text || "";
    el.status.className = "mem-status" + (strong ? " is-win" : "");
  }

  function paintAll() {
    paintStats();
    paintSizes();
    if (state.won) {
      setStatus("all pairs found in " + state.moves + " moves · " + fmtTime(state.elapsed), true);
    } else {
      setStatus(isStarted() ? "" : "flip two and see what happens.");
    }
  }

  /* ----------------------------- game flow ----------------------------- */

  function clearFlipTimer() {
    if (flipId) {
      window.clearTimeout(flipId);
      flipId = 0;
    }
  }

  function newGame(sizeKey) {
    if (duel) duel.resetRandom();   // restart the shared stream so both decks match
    clearFlipTimer();
    stopClock();
    locked = false;
    firstIdx = -1;
    tickCount = 0;
    var best = state ? state.best : emptyBest();
    state = freshState(sizeKey, best);
    el.root.classList.remove("is-won");
    renderBoard();
    paintAll();
    save();
  }

  function changeSize(sizeKey) {
    if (!SIZES[sizeKey] || sizeKey === state.size) return;
    newGame(sizeKey);
  }

  function onClick(e) {
    if (!state || !el) return;
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;

    var sizeBtn = t.closest(".mem-size");
    if (sizeBtn && el.root.contains(sizeBtn)) {
      changeSize(sizeBtn.getAttribute("data-size"));
      return;
    }

    var newBtn = t.closest('[data-act="new"]');
    if (newBtn && el.root.contains(newBtn)) {
      newGame(state.size);
      return;
    }

    var cardBtn = t.closest(".mem-card");
    if (cardBtn && el.board.contains(cardBtn)) {
      var idx = parseInt(cardBtn.getAttribute("data-idx"), 10);
      if (!isNaN(idx)) onCardClick(idx);
    }
  }

  function onCardClick(idx) {
    /* `locked` is true only while a wrong pair is flipping back, so no amount
       of rapid tapping can reveal a third card or corrupt the turn. */
    if (locked || !state || state.won) return;

    var c = state.deck[idx];
    if (!c || c.matched || c.up) return;

    c.up = true;
    syncCard(idx);
    startClock();
    setStatus("");

    if (firstIdx < 0) {
      firstIdx = idx;
      save();
      return;
    }

    var a = firstIdx;
    var b = idx;
    firstIdx = -1;
    state.moves++;
    paintStats();

    if (state.deck[a].face === state.deck[b].face) {
      state.deck[a].matched = true;
      state.deck[b].matched = true;
      syncCard(a);
      syncCard(b);
      if (allMatched(state)) {
        win();
      } else {
        setStatus(MATCH_LINES[state.moves % MATCH_LINES.length]);
        save();
      }
      return;
    }

    locked = true;
    flipId = window.setTimeout(function () {
      flipId = 0;
      locked = false;
      if (!state) return;
      state.deck[a].up = false;
      state.deck[b].up = false;
      syncCard(a);
      syncCard(b);
      save();
    }, FLIP_BACK_MS);
    save();
  }

  function win() {
    state.won = true;
    stopClock();

    var prev = state.best[state.size];
    var isBest = (prev == null || state.moves < prev);
    if (isBest) state.best[state.size] = state.moves;

    paintStats();
    var line = "all pairs found in " + state.moves + " moves · " + fmtTime(state.elapsed);
    setStatus(isBest ? ("new best on " + SIZES[state.size].label + ". " + line) : line, true);
    el.root.classList.add("is-won");
    if (duel) duel.report(100, state.elapsed, true);
    save();
    celebrate();
  }

  function celebrate() {
    try {
      if (window.Bloom && typeof window.Bloom.confetti === "function") {
        var r = el.board.getBoundingClientRect();
        window.Bloom.confetti(r.left + r.width / 2, r.top + r.height / 2);
      }
    } catch (e) { /* confetti is a nicety, never a failure */ }
  }

  function onVisibility() {
    if (!state) return;
    if (document.hidden) {
      stopClock();
      save();
    } else if (!state.won && isStarted()) {
      startClock();
    }
  }

  /* ---------------------------- mount / unmount ------------------------ */

  function mount(containerEl) {
    if (!containerEl || !containerEl.appendChild) return;

    /* Idempotent: a second mount tears the first one down completely, so
       state, timers and listeners can never be duplicated. */
    unmount();

    host = containerEl;
    failedFaces = {};
    locked = false;
    firstIdx = -1;
    tickCount = 0;
    state = loadState();

    for (var i = 0; i < state.deck.length; i++) {
      if (state.deck[i].up && !state.deck[i].matched) { firstIdx = i; break; }
    }

    renderShell();

    // just me / together: together deals the identical deck on both phones
    if (window.MoonpieDuel) {
      duel = window.MoonpieDuel.create({
        game: "memory",
        level: function () { return state ? String(state.size) : "default"; },
        onModeChange: function () { newGame(state ? state.size : undefined); }
      });
      if (el.root && el.root.parentNode) el.root.parentNode.insertBefore(duel.el, el.root);
      else host.insertBefore(duel.el, host.firstChild);
    }

    renderBoard();
    paintAll();
    if (state.won) el.root.classList.add("is-won");

    on(document, "visibilitychange", onVisibility);

    if (!state.won && isStarted()) startClock();
    save();
  }

  function unmount() {
    if (duel) {
      duel.destroy();
      duel = null;
    }
    stopClock();
    clearFlipTimer();
    if (state && host) save();
    offAll();
    if (host) {
      try { host.innerHTML = ""; } catch (e) { /* detached */ }
    }
    host = null;
    el = null;
    state = null;
    locked = false;
    firstIdx = -1;
    tickCount = 0;
    runningSince = 0;
  }

  window.MoonpieMemory = {
    mount: mount,
    unmount: unmount,
    /* test-only hook, used by the deck-builder assertions */
    __test: { buildDeck: buildDeck, SIZES: SIZES, FACES: FACES }
  };
})();
