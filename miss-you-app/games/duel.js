/*
 * Duel - the "just me / together" layer shared by every game.
 *
 * Together mode does not mean two cursors on one board. It means both phones
 * build the SAME puzzle from a shared daily seed, each person plays it where
 * they are, and progress is posted and read back so each of them can see how
 * far the other has got and who finished first. That needs no realtime
 * connection, works when one phone is asleep, and is the only version of
 * "together" that is honest across a time difference.
 *
 * A game opts in with:
 *
 *   var duel = window.MoonpieDuel.create({
 *     game: "sudoku",
 *     level: () => state.difficulty,     // which shared board this is
 *     onModeChange: mode => restart(),   // rebuild using duel.random()
 *   });
 *   host.appendChild(duel.el);           // the mode switch + the other player
 *   duel.random()                        // seeded in together, Math.random solo
 *   duel.report(progressPercent, seconds, done)
 *
 * Exposes window.MoonpieDuel.
 */
(function () {
  "use strict";

  var API = "../api/duel";
  var STORE = "moonpie-duel-mode";
  var POLL_MS = 20000;

  function nickOf(profile) {
    return profile === "Michelle" ? "Moonpie" : profile === "Michael" ? "Michael" : profile;
  }
  function myProfile() {
    try {
      if (window.MoonpiePush && window.MoonpiePush.myProfile) return window.MoonpiePush.myProfile();
    } catch (e) { /* push not wired up yet */ }
    return "Michelle";
  }
  function otherProfile(me) { return me === "Michelle" ? "Michael" : "Michelle"; }

  /* A small deterministic PRNG (mulberry32). Both phones get the same seed
     from the server, so both build byte-identical puzzles from it. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function create(opts) {
    var game = opts.game;
    var levelOf = typeof opts.level === "function" ? opts.level : function () { return opts.level || "default"; };
    var onModeChange = opts.onModeChange || function () {};

    var mode = "solo";
    try { mode = localStorage.getItem(STORE + ":" + game) === "together" ? "together" : "solo"; } catch (e) {}

    var seed = null;
    var players = {};
    var pollTimer = null;
    var lastSent = 0;

    var el = document.createElement("div");
    el.className = "duel-bar";
    el.innerHTML =
      '<div class="duel-modes" role="group" aria-label="who is playing">' +
        '<button type="button" class="duel-mode" data-duel-mode="solo">just me</button>' +
        '<button type="button" class="duel-mode" data-duel-mode="together">together</button>' +
      '</div>' +
      '<p class="duel-status" hidden></p>';

    var statusEl = el.querySelector(".duel-status");

    function paintModes() {
      var buttons = el.querySelectorAll("[data-duel-mode]");
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute("data-duel-mode") === mode;
        buttons[i].classList.toggle("is-on", on);
        buttons[i].setAttribute("aria-pressed", String(on));
      }
      statusEl.hidden = mode !== "together";
    }

    function paintStatus() {
      if (mode !== "together") return;
      var me = myProfile();
      var them = players[otherProfile(me)];
      if (!them) {
        statusEl.textContent = "Same puzzle on both phones. " + nickOf(otherProfile(me)) + " hasn't started yet.";
        statusEl.className = "duel-status";
        return;
      }
      if (them.done) {
        statusEl.textContent = nickOf(otherProfile(me)) + " finished this one in " + fmtTime(them.elapsed) + ".";
        statusEl.className = "duel-status is-done";
        return;
      }
      statusEl.textContent = nickOf(otherProfile(me)) + " is " + them.progress + "% through, " + fmtTime(them.elapsed) + " so far.";
      statusEl.className = "duel-status";
    }

    function apply(data) {
      if (!data) return;
      if (typeof data.seed === "number") seed = data.seed;
      players = data.players || {};
      paintStatus();
    }

    function pull() {
      if (mode !== "together") return Promise.resolve();
      return fetch(API + "?game=" + encodeURIComponent(game) + "&level=" + encodeURIComponent(levelOf()))
        // A non-ok response has to throw, not resolve to null: resolving left
        // apply() with nothing to do and the status box rendered empty, which
        // reads as "broken" rather than "offline".
        .then(function (r) {
          if (!r.ok) throw new Error("duel " + r.status);
          return r.json();
        })
        .then(apply)
        .catch(function () {
          statusEl.textContent = "Can't reach the shared board right now. You can still play; it just won't sync.";
          statusEl.className = "duel-status";
        });
    }

    function startPolling() {
      stopPolling();
      if (mode !== "together") return;
      pollTimer = setInterval(pull, POLL_MS);
    }
    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function setMode(next) {
      if (next === mode) return;
      mode = next;
      try { localStorage.setItem(STORE + ":" + game, mode); } catch (e) {}
      paintModes();
      if (mode === "together") {
        pull().then(function () { onModeChange(mode); startPolling(); });
      } else {
        seed = null;
        stopPolling();
        onModeChange(mode);
      }
    }

    el.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-duel-mode]") : null;
      if (button) setMode(button.getAttribute("data-duel-mode"));
    });

    paintModes();
    if (mode === "together") { pull().then(startPolling); }

    return {
      el: el,
      get mode() { return mode; },
      /* Seeded while playing together so both boards match, ordinary random
         when playing alone so a solo game is never the same twice. */
      random: function () {
        if (mode === "together" && seed !== null) {
          if (!this._rng) this._rng = mulberry32(seed);
          return this._rng();
        }
        return Math.random();
      },
      /* Call at the start of building a puzzle, so the seeded stream restarts
         from the same point on both phones. */
      resetRandom: function () {
        this._rng = (mode === "together" && seed !== null) ? mulberry32(seed) : null;
      },
      ready: function () { return mode !== "together" || seed !== null; },
      report: function (progress, elapsed, done) {
        if (mode !== "together") return;
        var now = Date.now();
        if (!done && now - lastSent < 10000) return;   // don't spam on every move
        lastSent = now;
        fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: game, level: levelOf(), profile: myProfile(),
            progress: progress, elapsed: elapsed, done: !!done,
          }),
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(apply)
          .catch(function () { /* posting is best effort; the game keeps working unsynced */ });
      },
      destroy: stopPolling,
    };
  }

  window.MoonpieDuel = { create: create };
})();
