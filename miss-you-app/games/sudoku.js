/* Moonpie Sudoku — self-contained 9x9 sudoku for the miss-you app.
 * Plain browser IIFE. No modules, no build step, no dependencies.
 * Exposes: window.MoonpieSudoku = { mount(containerEl), unmount() }
 *
 * DOM surface used (kept deliberately small): document.createElement,
 * document.add/removeEventListener, el.appendChild/removeChild/firstChild,
 * el.className, el.classList, el.textContent, el.setAttribute,
 * el.add/removeEventListener, el.focus, el.getBoundingClientRect.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- config */

  var STORAGE_KEY = "moonpie-sudoku-v1";
  var SCHEMA = 1;

  var DIFFICULTY = {
    easy: { label: "Easy", holes: 40 },
    medium: { label: "Medium", holes: 48 },
    hard: { label: "Hard", holes: 53 }
  };
  var DIFF_ORDER = ["easy", "medium", "hard"];

  /* ------------------------------------------------------- pure sudoku core */

  function boxOf(r, c) {
    return ((r / 3) | 0) * 3 + ((c / 3) | 0);
  }

  function zeros(n) {
    var a = new Array(n), i;
    for (i = 0; i < n; i++) a[i] = 0;
    return a;
  }

  function popcount(m) {
    var n = 0;
    while (m) {
      m &= m - 1;
      n++;
    }
    return n;
  }

  function shuffle(arr) {
    var i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /* 27 units (9 rows, 9 cols, 9 boxes), each an array of 9 cell indices. */
  var UNITS = (function () {
    var units = [], r, c, b, br, bc, g;
    for (r = 0; r < 9; r++) {
      g = [];
      for (c = 0; c < 9; c++) g.push(r * 9 + c);
      units.push(g);
    }
    for (c = 0; c < 9; c++) {
      g = [];
      for (r = 0; r < 9; r++) g.push(r * 9 + c);
      units.push(g);
    }
    for (b = 0; b < 9; b++) {
      g = [];
      br = ((b / 3) | 0) * 3;
      bc = (b % 3) * 3;
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) g.push((br + r) * 9 + bc + c);
      units.push(g);
    }
    return units;
  })();

  /* peers[i] = every cell sharing a row, column or box with i (excluding i). */
  var PEERS = (function () {
    var peers = [], i, u, k, seen, list;
    for (i = 0; i < 81; i++) {
      seen = {};
      list = [];
      for (u = 0; u < UNITS.length; u++) {
        if (UNITS[u].indexOf(i) < 0) continue;
        for (k = 0; k < 9; k++) {
          var p = UNITS[u][k];
          if (p !== i && !seen[p]) {
            seen[p] = 1;
            list.push(p);
          }
        }
      }
      peers.push(list);
    }
    return peers;
  })();

  /* Count solutions of `grid`, stopping as soon as `limit` are found.
   * Returns 0 (unsolvable / contradictory), or 1..limit. Uses bitmask
   * candidate tracking plus minimum-remaining-values cell selection. */
  function solveCount(grid, limit) {
    var rows = zeros(9), cols = zeros(9), boxes = zeros(9), i, v, bit, r, c, b;
    for (i = 0; i < 81; i++) {
      v = grid[i];
      if (!v) continue;
      bit = 1 << (v - 1);
      r = (i / 9) | 0;
      c = i % 9;
      b = boxOf(r, c);
      if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) return 0;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    }

    var work = grid.slice();
    var count = 0;

    (function rec() {
      var best = -1, bestMask = 0, bestN = 10, j, rr, cc, bb, mask, n;
      for (j = 0; j < 81; j++) {
        if (work[j]) continue;
        rr = (j / 9) | 0;
        cc = j % 9;
        bb = boxOf(rr, cc);
        mask = ~(rows[rr] | cols[cc] | boxes[bb]) & 511;
        n = popcount(mask);
        if (n === 0) return; /* dead end */
        if (n < bestN) {
          bestN = n;
          best = j;
          bestMask = mask;
          if (n === 1) break;
        }
      }
      if (best < 0) {
        count++; /* no empty cells left: a complete solution */
        return;
      }
      var r3 = (best / 9) | 0, c3 = best % 9, b3 = boxOf(r3, c3), d, dbit;
      for (d = 1; d <= 9; d++) {
        dbit = 1 << (d - 1);
        if (!(bestMask & dbit)) continue;
        work[best] = d;
        rows[r3] |= dbit;
        cols[c3] |= dbit;
        boxes[b3] |= dbit;
        rec();
        work[best] = 0;
        rows[r3] &= ~dbit;
        cols[c3] &= ~dbit;
        boxes[b3] &= ~dbit;
        if (count >= limit) return;
      }
    })();

    return count;
  }

  /* Build a complete, valid solved grid via randomised backtracking. */
  function generateSolved() {
    var grid = zeros(81), rows = zeros(9), cols = zeros(9), boxes = zeros(9);

    var ok = (function rec() {
      var best = -1, bestMask = 0, bestN = 10, j, rr, cc, bb, mask, n;
      for (j = 0; j < 81; j++) {
        if (grid[j]) continue;
        rr = (j / 9) | 0;
        cc = j % 9;
        bb = boxOf(rr, cc);
        mask = ~(rows[rr] | cols[cc] | boxes[bb]) & 511;
        n = popcount(mask);
        if (n === 0) return false;
        if (n < bestN) {
          bestN = n;
          best = j;
          bestMask = mask;
          if (n === 1) break;
        }
      }
      if (best < 0) return true; /* grid is full */

      var r3 = (best / 9) | 0, c3 = best % 9, b3 = boxOf(r3, c3);
      var cands = [], d;
      for (d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) cands.push(d);
      shuffle(cands);

      for (d = 0; d < cands.length; d++) {
        var v = cands[d], bit = 1 << (v - 1);
        grid[best] = v;
        rows[r3] |= bit;
        cols[c3] |= bit;
        boxes[b3] |= bit;
        if (rec()) return true;
        grid[best] = 0;
        rows[r3] &= ~bit;
        cols[c3] &= ~bit;
        boxes[b3] &= ~bit;
      }
      return false;
    })();

    return ok ? grid : null;
  }

  /* Dig holes out of a solved grid, keeping the solution unique at every
   * step. Returns { puzzle, holes } where holes is what was actually removed. */
  function digPuzzle(solution, targetHoles) {
    var puzzle = solution.slice();
    var order = [], i;
    for (i = 0; i < 81; i++) order.push(i);
    shuffle(order);

    var removed = 0;
    for (i = 0; i < 81 && removed < targetHoles; i++) {
      var idx = order[i], saved = puzzle[idx];
      if (!saved) continue;
      puzzle[idx] = 0;
      if (solveCount(puzzle, 2) === 1) removed++;
      else puzzle[idx] = saved; /* removal would create ambiguity — put it back */
    }
    return { puzzle: puzzle, holes: removed };
  }

  /* Generate a puzzle for a difficulty. Retries a few times to get closer to
   * the target hole count; every candidate is already guaranteed unique. */
  function generatePuzzle(diffKey) {
    var target = (DIFFICULTY[diffKey] || DIFFICULTY.easy).holes;
    var best = null, attempt;
    for (attempt = 0; attempt < 3; attempt++) {
      var solution = generateSolved();
      if (!solution) continue;
      var dug = digPuzzle(solution, target);
      if (!best || dug.holes > best.holes) best = { puzzle: dug.puzzle, solution: solution, holes: dug.holes };
      if (best.holes >= target) break;
    }
    return best;
  }

  /* Cells that duplicate a value inside a row, column or box. */
  function findConflicts(values) {
    var bad = new Array(81), i, u, k, unit, v, byDigit, d;
    for (i = 0; i < 81; i++) bad[i] = false;
    for (u = 0; u < UNITS.length; u++) {
      unit = UNITS[u];
      byDigit = {};
      for (k = 0; k < 9; k++) {
        v = values[unit[k]];
        if (!v) continue;
        if (!byDigit[v]) byDigit[v] = [];
        byDigit[v].push(unit[k]);
      }
      for (d in byDigit) {
        if (!Object.prototype.hasOwnProperty.call(byDigit, d)) continue;
        if (byDigit[d].length > 1) {
          for (k = 0; k < byDigit[d].length; k++) bad[byDigit[d][k]] = true;
        }
      }
    }
    return bad;
  }

  /* ------------------------------------------------------------- utilities */

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    if (m > 99) m = 99;
    return pad2(m) + ":" + pad2(sec % 60);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function isIntArray(a, len) {
    if (!a || typeof a.length !== "number" || a.length !== len) return false;
    for (var i = 0; i < len; i++) {
      if (typeof a[i] !== "number" || !isFinite(a[i])) return false;
    }
    return true;
  }

  /* --------------------------------------------------------------- storage */

  function storageGet() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function storageSet(obj) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      /* private mode / quota — progress just won't persist */
    }
  }

  function storageClear() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /* ----------------------------------------------------------------- state */

  var state = null;
  var ui = null;
  var timerId = null;
  var keyHandler = null;
  var host = null;
  var saveTick = 0;

  function freshState(diffKey) {
    var made = generatePuzzle(diffKey);
    return {
      difficulty: diffKey,
      puzzle: made.puzzle,
      solution: made.solution,
      entries: zeros(81),
      notes: zeros(81),
      elapsed: 0,
      mistakes: 0,
      won: false,
      selected: -1,
      notesMode: false
    };
  }

  /* Rebuild state from a stored blob, or return null if it is unusable. */
  function restoreState(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.v !== SCHEMA) return null;
    if (!DIFFICULTY[raw.difficulty]) return null;
    if (!isIntArray(raw.puzzle, 81) || !isIntArray(raw.solution, 81)) return null;
    if (!isIntArray(raw.entries, 81) || !isIntArray(raw.notes, 81)) return null;

    var i;
    for (i = 0; i < 81; i++) {
      if (raw.puzzle[i] < 0 || raw.puzzle[i] > 9) return null;
      if (raw.solution[i] < 1 || raw.solution[i] > 9) return null;
      if (raw.entries[i] < 0 || raw.entries[i] > 9) return null;
      if (raw.notes[i] < 0 || raw.notes[i] > 511) return null;
      /* a given must agree with the solution, and cannot also hold an entry */
      if (raw.puzzle[i] && raw.puzzle[i] !== raw.solution[i]) return null;
      if (raw.puzzle[i] && raw.entries[i]) return null;
    }
    /* the stored solution must actually be a valid solved grid */
    var conflicts = findConflicts(raw.solution);
    for (i = 0; i < 81; i++) if (conflicts[i]) return null;

    var elapsed = typeof raw.elapsed === "number" && isFinite(raw.elapsed) && raw.elapsed >= 0 ? Math.floor(raw.elapsed) : 0;
    var mistakes = typeof raw.mistakes === "number" && isFinite(raw.mistakes) && raw.mistakes >= 0 ? Math.floor(raw.mistakes) : 0;

    return {
      difficulty: raw.difficulty,
      puzzle: raw.puzzle.slice(),
      solution: raw.solution.slice(),
      entries: raw.entries.slice(),
      notes: raw.notes.slice(),
      elapsed: elapsed,
      mistakes: mistakes,
      won: !!raw.won,
      selected: -1,
      notesMode: false
    };
  }

  function save() {
    if (!state) return;
    storageSet({
      v: SCHEMA,
      difficulty: state.difficulty,
      puzzle: state.puzzle,
      solution: state.solution,
      entries: state.entries,
      notes: state.notes,
      elapsed: state.elapsed,
      mistakes: state.mistakes,
      won: state.won
    });
  }

  /* ------------------------------------------------------------ game logic */

  function valueAt(i) {
    return state.puzzle[i] || state.entries[i];
  }

  function isGiven(i) {
    return state.puzzle[i] > 0;
  }

  function currentValues() {
    var v = new Array(81), i;
    for (i = 0; i < 81; i++) v[i] = valueAt(i);
    return v;
  }

  function isSolved() {
    var i;
    for (i = 0; i < 81; i++) {
      if (valueAt(i) !== state.solution[i]) return false;
    }
    return true;
  }

  function selectCell(i) {
    state.selected = i;
    paint();
  }

  function placeDigit(d) {
    var i = state.selected;
    if (state.won || i < 0 || isGiven(i)) return;

    if (state.notesMode) {
      if (valueAt(i)) return; /* erase the value before pencilling */
      state.notes[i] ^= 1 << (d - 1);
    } else {
      if (state.entries[i] === d) {
        state.entries[i] = 0; /* tapping the same digit again clears it */
      } else {
        state.entries[i] = d;
        state.notes[i] = 0;
        if (d !== state.solution[i]) state.mistakes++;
        /* tidy the pencil marks this placement invalidates */
        var peers = PEERS[i], k;
        for (k = 0; k < peers.length; k++) state.notes[peers[k]] &= ~(1 << (d - 1));
      }
    }

    if (isSolved()) win();
    save();
    paint();
  }

  function eraseCell() {
    var i = state.selected;
    if (state.won || i < 0 || isGiven(i)) return;
    state.entries[i] = 0;
    state.notes[i] = 0;
    save();
    paint();
  }

  function win() {
    state.won = true;
    state.selected = -1;
    celebrate();
  }

  function celebrate() {
    if (!ui || !ui.board) return;
    try {
      if (window.Bloom && typeof window.Bloom.confetti === "function") {
        var r = ui.board.getBoundingClientRect ? ui.board.getBoundingClientRect() : null;
        var x = r ? r.left + r.width / 2 : 0;
        var y = r ? r.top + r.height / 2 : 0;
        window.Bloom.confetti(x, y);
      }
    } catch (e) {
      /* the host app's confetti is a nicety, never a requirement */
    }
  }

  function newGame(diffKey) {
    if (!DIFFICULTY[diffKey]) diffKey = "easy";
    storageClear();
    state = freshState(diffKey);
    save();
    paint();
  }

  /* ------------------------------------------------------------- rendering */

  function buildUI(container) {
    var root = el("div", "sdk-root");

    /* header ------------------------------------------------------------- */
    var head = el("div", "sdk-head");
    var title = el("div", "sdk-title");
    title.appendChild(el("span", "sdk-title-script", "little"));
    title.appendChild(el("span", "sdk-title-main", "Sudoku"));
    head.appendChild(title);

    var stats = el("div", "sdk-stats");
    var timeStat = el("div", "sdk-stat");
    timeStat.appendChild(el("span", "sdk-stat-k", "time"));
    var timeVal = el("span", "sdk-stat-v", "00:00");
    timeStat.appendChild(timeVal);

    var missStat = el("div", "sdk-stat");
    missStat.appendChild(el("span", "sdk-stat-k", "oopsies"));
    var missVal = el("span", "sdk-stat-v", "0");
    missStat.appendChild(missVal);

    stats.appendChild(timeStat);
    stats.appendChild(missStat);
    head.appendChild(stats);
    root.appendChild(head);

    /* difficulty --------------------------------------------------------- */
    var diffs = el("div", "sdk-diffs");
    diffs.setAttribute("role", "group");
    diffs.setAttribute("aria-label", "Difficulty");
    var diffBtns = {};
    DIFF_ORDER.forEach(function (key) {
      var b = el("button", "sdk-diff", DIFFICULTY[key].label);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (state.difficulty === key && !state.won) return;
        newGame(key);
      });
      diffs.appendChild(b);
      diffBtns[key] = b;
    });
    root.appendChild(diffs);

    /* board -------------------------------------------------------------- */
    var wrap = el("div", "sdk-boardwrap");
    var board = el("div", "sdk-board");
    board.setAttribute("role", "grid");
    board.setAttribute("aria-label", "Sudoku board");

    var cells = [], i;
    for (i = 0; i < 81; i++) {
      var r = (i / 9) | 0, c = i % 9;
      var cls = "sdk-cell";
      if (c === 2 || c === 5) cls += " sdk-edge-r";
      if (r === 2 || r === 5) cls += " sdk-edge-b";
      var cell = el("button", cls);
      cell.type = "button";
      cell.setAttribute("tabindex", "-1");
      cell.setAttribute("role", "gridcell");
      cell._idx = i;

      var val = el("span", "sdk-val", "");
      cell.appendChild(val);

      var notes = el("span", "sdk-notes");
      var marks = [], n;
      for (n = 0; n < 9; n++) {
        var mk = el("i", "sdk-mark", "");
        notes.appendChild(mk);
        marks.push(mk);
      }
      cell.appendChild(notes);

      (function (idx) {
        cell.addEventListener("click", function () {
          if (state.won) return;
          selectCell(idx);
        });
      })(i);

      board.appendChild(cell);
      cells.push({ node: cell, val: val, marks: marks });
    }
    wrap.appendChild(board);

    var winBox = el("div", "sdk-win");
    winBox.appendChild(el("div", "sdk-win-emoji", "🌷"));
    winBox.appendChild(el("div", "sdk-win-script", "you did it"));
    var winSub = el("div", "sdk-win-sub", "");
    winBox.appendChild(winSub);
    var winBtn = el("button", "sdk-btn sdk-btn-hot", "Play again");
    winBtn.type = "button";
    winBtn.addEventListener("click", function () {
      newGame(state.difficulty);
    });
    winBox.appendChild(winBtn);
    wrap.appendChild(winBox);
    root.appendChild(wrap);

    /* number pad --------------------------------------------------------- */
    var pad = el("div", "sdk-pad");
    var padBtns = [], d;
    for (d = 1; d <= 9; d++) {
      var pb = el("button", "sdk-key");
      pb.type = "button";
      pb.setAttribute("aria-label", "Place " + d);
      var pnum = el("span", "sdk-key-num", String(d));
      var pleft = el("span", "sdk-key-left", "");
      pb.appendChild(pnum);
      pb.appendChild(pleft);
      (function (digit) {
        pb.addEventListener("click", function () {
          placeDigit(digit);
        });
      })(d);
      pad.appendChild(pb);
      padBtns.push({ node: pb, left: pleft });
    }
    root.appendChild(pad);

    /* actions ------------------------------------------------------------ */
    var actions = el("div", "sdk-actions");

    var notesBtn = el("button", "sdk-btn sdk-btn-notes");
    notesBtn.type = "button";
    notesBtn.setAttribute("aria-pressed", "false");
    notesBtn.appendChild(el("span", "sdk-btn-ico", "✏️"));
    notesBtn.appendChild(el("span", null, "Notes"));
    var notesPip = el("span", "sdk-pip", "off");
    notesBtn.appendChild(notesPip);
    notesBtn.addEventListener("click", function () {
      state.notesMode = !state.notesMode;
      paint();
    });

    var eraseBtn = el("button", "sdk-btn");
    eraseBtn.type = "button";
    eraseBtn.appendChild(el("span", "sdk-btn-ico", "🧽"));
    eraseBtn.appendChild(el("span", null, "Erase"));
    eraseBtn.addEventListener("click", eraseCell);

    var newBtn = el("button", "sdk-btn sdk-btn-hot");
    newBtn.type = "button";
    newBtn.appendChild(el("span", "sdk-btn-ico", "🌸"));
    newBtn.appendChild(el("span", null, "New"));
    newBtn.addEventListener("click", function () {
      newGame(state.difficulty);
    });

    actions.appendChild(notesBtn);
    actions.appendChild(eraseBtn);
    actions.appendChild(newBtn);
    root.appendChild(actions);

    var hint = el("div", "sdk-hint", "tap a square, then a number. notes mode pencils in maybes");
    hint.setAttribute("aria-live", "polite");
    root.appendChild(hint);

    container.appendChild(root);

    return {
      root: root,
      board: board,
      cells: cells,
      padBtns: padBtns,
      diffBtns: diffBtns,
      timeVal: timeVal,
      missVal: missVal,
      notesBtn: notesBtn,
      notesPip: notesPip,
      eraseBtn: eraseBtn,
      winBox: winBox,
      winSub: winSub,
      hint: hint
    };
  }

  function paintTime() {
    if (!ui || !state) return;
    ui.timeVal.textContent = formatTime(state.elapsed);
  }

  function paint() {
    if (!ui || !state) return;

    var values = currentValues();
    var conflicts = findConflicts(values);
    var sel = state.selected;
    var selVal = sel >= 0 ? values[sel] : 0;
    var selRow = sel >= 0 ? (sel / 9) | 0 : -1;
    var selCol = sel >= 0 ? sel % 9 : -1;
    var selBox = sel >= 0 ? boxOf(selRow, selCol) : -1;

    var counts = zeros(10), i;
    for (i = 0; i < 81; i++) if (values[i]) counts[values[i]]++;

    for (i = 0; i < 81; i++) {
      var cell = ui.cells[i];
      var node = cell.node;
      var v = values[i];
      var r = (i / 9) | 0, c = i % 9;

      var cls = "sdk-cell";
      if (c === 2 || c === 5) cls += " sdk-edge-r";
      if (r === 2 || r === 5) cls += " sdk-edge-b";
      if (isGiven(i)) cls += " sdk-given";
      if (v) cls += " sdk-filled";
      else if (state.notes[i]) cls += " sdk-noted";
      if (conflicts[i]) cls += " sdk-conflict";
      if (sel >= 0) {
        if (i === sel) cls += " sdk-sel";
        else if (r === selRow || c === selCol || boxOf(r, c) === selBox) cls += " sdk-peer";
        if (selVal && v === selVal && i !== sel) cls += " sdk-same";
      }
      node.className = cls;

      cell.val.textContent = v ? String(v) : "";

      var notesMask = v ? 0 : state.notes[i];
      var n;
      for (n = 0; n < 9; n++) {
        cell.marks[n].textContent = notesMask & (1 << n) ? String(n + 1) : "";
      }

      node.setAttribute("aria-label",
        "row " + (r + 1) + " column " + (c + 1) + (v ? ", " + v : ", empty"));
    }

    for (i = 1; i <= 9; i++) {
      var pb = ui.padBtns[i - 1];
      var left = 9 - counts[i];
      pb.left.textContent = left > 0 ? String(left) : "";
      pb.node.className = "sdk-key" + (left <= 0 ? " sdk-key-done" : "") +
        (state.notesMode ? " sdk-key-notes" : "");
    }

    DIFF_ORDER.forEach(function (key) {
      var b = ui.diffBtns[key];
      var on = state.difficulty === key;
      b.className = "sdk-diff" + (on ? " sdk-diff-on" : "");
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    ui.notesBtn.className = "sdk-btn sdk-btn-notes" + (state.notesMode ? " sdk-on" : "");
    ui.notesBtn.setAttribute("aria-pressed", state.notesMode ? "true" : "false");
    ui.notesPip.textContent = state.notesMode ? "on" : "off";

    ui.missVal.textContent = String(state.mistakes);
    paintTime();

    ui.root.className = "sdk-root" + (state.won ? " sdk-is-won" : "");
    if (state.won) {
      ui.winSub.textContent = "solved in " + formatTime(state.elapsed) +
        " with " + state.mistakes + (state.mistakes === 1 ? " oopsie" : " oopsies");
    }
  }

  /* ---------------------------------------------------------------- keys */

  function moveSelection(dr, dc) {
    if (state.won) return;
    var i = state.selected;
    if (i < 0) {
      selectCell(0);
      return;
    }
    var r = (i / 9) | 0, c = i % 9;
    r = Math.min(8, Math.max(0, r + dr));
    c = Math.min(8, Math.max(0, c + dc));
    selectCell(r * 9 + c);
  }

  function onKeyDown(e) {
    if (!state || !ui) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

    var k = e.key;
    if (!k) return;

    if (k >= "1" && k <= "9") {
      placeDigit(parseInt(k, 10));
      e.preventDefault();
      return;
    }
    if (k === "0" || k === "Backspace" || k === "Delete") {
      eraseCell();
      e.preventDefault();
      return;
    }
    if (k === "n" || k === "N") {
      state.notesMode = !state.notesMode;
      paint();
      e.preventDefault();
      return;
    }
    if (k === "ArrowUp") { moveSelection(-1, 0); e.preventDefault(); return; }
    if (k === "ArrowDown") { moveSelection(1, 0); e.preventDefault(); return; }
    if (k === "ArrowLeft") { moveSelection(0, -1); e.preventDefault(); return; }
    if (k === "ArrowRight") { moveSelection(0, 1); e.preventDefault(); return; }
  }

  /* ------------------------------------------------------- mount / unmount */

  function tick() {
    if (!state) return;
    if (!state.won) {
      state.elapsed++;
      paintTime();
      saveTick++;
      if (saveTick >= 5) {
        saveTick = 0;
        save();
      }
    }
  }

  function mount(containerEl) {
    if (!containerEl || typeof containerEl.appendChild !== "function") return;

    /* mounting twice must not double up timers, listeners or state */
    unmount();

    host = containerEl;
    clear(host);

    var restored = restoreState(storageGet());
    state = restored || freshState("easy");
    if (!restored) save();

    ui = buildUI(host);
    paint();
    if (state.won) celebrate();

    keyHandler = onKeyDown;
    document.addEventListener("keydown", keyHandler);

    saveTick = 0;
    timerId = window.setInterval(tick, 1000);
  }

  function unmount() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (state) save();
    if (host) {
      clear(host);
      host = null;
    }
    ui = null;
    state = null;
    saveTick = 0;
  }

  window.MoonpieSudoku = { mount: mount, unmount: unmount };
})();
