/*
 * Poo v4 - Michelle's companion.
 *
 * What changed from v3, and why:
 *
 * 1. ONE art set. v3 mixed a 283x320 rig with 796x900 "extra" renders that were
 *    a visibly different doll - different colour grade, proportions, crop, even
 *    a different shaped name tag. Every reaction swapped to that other set, so
 *    every control looked broken. All reactions now live on the rig, and the
 *    rig alone. She is always the same doll.
 *
 * 2. Reactions are MOTION, not image swaps. A pose change is the small part; the
 *    feeling comes from anticipation -> action -> overshoot -> settle, secondary
 *    motion in the ears, and FX. Swapping a still frame never reads as alive.
 *
 * 3. Alpha hit-testing. v3 put a 300px pointer-capturing box over the UI and ate
 *    taps meant for the app. Pointer events are now sampled against her actual
 *    silhouette; a tap on empty pixels is never consumed.
 *
 * 4. Velocity-driven lean. v3 fed raw pointer movementX into the tilt spring,
 *    which spikes hard on touch and snapped her to the clamp - the "rotates
 *    badly" glitch. Lean now follows smoothed velocity.
 *
 * 5. ~0.8MB of sprites, decoded off the main thread, neutral first so she shows
 *    up immediately. v3 eagerly decoded 8.9MB on boot, which is what made the
 *    whole app stutter.
 *
 * The pose set is deliberately swappable: POSES + FRAME are the only coupling to
 * the art. Drop in a better-rendered set at the same framing and nothing here
 * needs to change.
 */
(function () {
  "use strict";

  const ART = "./assets/poo/rig/";
  const POSES = ["neutral", "content", "happy", "excited", "curious",
                 "lookup", "shy", "sleepy", "surprised", "wink"];
  const PARTS = ["body", "ear_l", "ear_r", "sprout"];

  // every rig part shares one frame, so pivots are a fraction of that frame
  const FRAME = { w: 283, h: 320 };
  const PIVOTS = { ear_l: [0.445, 0.439], ear_r: [0.554, 0.439], sprout: [0.499, 0.378] };
  const HEAD_Y = 0.42;   // where FX should originate, as a fraction of frame height
  const MASK_W = 48, MASK_H = 54;  // silhouette mask resolution for hit-testing

  // Measured opaque bounds of the rig art within its frame - the source PNGs
  // carry ~24% dead space at the top and ~15% each side, which otherwise reads
  // as a weirdly small bunny marooned in a big empty box.
  //
  // This is the UNION across all ten poses, never per-pose. Normalising each
  // pose to its own bounds would rescale her every time her expression changed
  // - which is precisely the class of bug this rewrite exists to kill.
  const CONTENT = { x0: 0.145, y0: 0.237, x1: 0.852, y1: 0.900 };
  const PAD = 0.16;      // breathing room for hop, lean and squash overshoot

  // Every transform that can push her outward is bounded, so no combination of
  // stacked impulses can ever clip her. Hand-balancing spring constants is
  // exactly how v3 ended up flinging her off the canvas; these are the limits
  // the budget below is derived from.
  //
  //   half-extent at rest          0.34 * cw   (PAD 0.16)
  //   rotated by LEAN_MAX          0.34*cos10 + 0.34*sin10  = 0.394
  //   scaled by SQUASH_MAX         0.394 * 1.12             = 0.441
  //   plus MOTION_BUDGET           0.441 + 0.05             = 0.491  < 0.5
  const LEAN_MAX = 10;
  const SQUASH_MIN = 0.90, SQUASH_MAX = 1.12;
  const MOTION_BUDGET = 0.05;

  // Hop is a spring around 0 whose peak displacement is roughly vel/sqrt(k).
  // With k=150 that means an impulse of 250 peaks near 16 units - multiplied by
  // HOP_RISE below that threw her clean off the canvas. Impulses are therefore
  // expressed in units where 1.0 is "a good hop", and the result is clamped so
  // no combination of stacked impulses can ever push her out of frame.
  const HOP_K = 150, HOP_IMPULSE = Math.sqrt(HOP_K);  // vel needed for a 1.0 hop
  const HOP_RISE = 0.075, HOP_LIMIT = 1.35;

  // Maps the source frame onto a square canvas so the character (not the
  // frame) is centred and fills it. Everything that needs to know where she
  // actually is - drawing, blush, FX origin, hit-testing - goes through here.
  function layout(cw) {
    const availW = cw * (1 - PAD * 2), availH = cw * (1 - PAD * 2);
    const cW = (CONTENT.x1 - CONTENT.x0) * FRAME.w;
    const cH = (CONTENT.y1 - CONTENT.y0) * FRAME.h;
    const scale = Math.min(availW / cW, availH / cH);
    const w = FRAME.w * scale, h = FRAME.h * scale;
    return {
      w, h,
      ox: (cw - (CONTENT.x1 - CONTENT.x0) * w) / 2 - CONTENT.x0 * w,
      oy: (cw - (CONTENT.y1 - CONTENT.y0) * h) / 2 - CONTENT.y0 * h,
    };
  }

  const BOND_KEY = "moonpie-poo-bond";
  const POS_KEY = "moonpie-poo-pos";
  const STAGES = [0, 8, 24, 55];
  const STAGE_NAMES = ["shy", "warming", "playful", "devoted"];

  const LINES = {
    neutral: ["Just glad to be near you.", "I like it here, watching your world.",
      "No rush. I'll just sit with you a while.", "You can ignore me. I'll still be happy.",
      "This spot is good. I pick it every time."],
    content: ["This is a good, quiet kind of happy.", "I could stay right here a long time.",
      "You make ordinary minutes feel soft.", "Nothing is wrong. I'm just soft right now."],
    happy: ["That made me happy too.", "I felt that, all the way over here.",
      "You have good taste in tiny joys.", "See, this is why I like being yours.",
      "Okay that one was genuinely delightful."],
    excited: ["Tell me everything, don't leave anything out.",
      "I've been waiting for you to look over here.", "Okay, okay, what happened?!",
      "I'm vibrating a little. In a good way."],
    curious: ["Hm. What are you thinking about?", "You have that look again - tell me.",
      "I'm nosy about your whole day, honestly.", "Wait, what's that face for?"],
    lookup: ["I keep glancing over, hoping it's your turn to visit.",
      "Still watching the door for you.", "You're my favorite thing to wait for.",
      "It's okay to have a heavy one. I'm not going anywhere."],
    shy: ["...you're going to make me blush.", "I don't know where to look now.",
      "Stop it. ...don't actually stop it.", "Okay, that one got me."],
    sleepy: ["Rest. I'll still be here when you wake up.", "Close your eyes. I'll keep watch.",
      "Sleepy, but happy-sleepy. The good kind."],
    surprised: ["Oh! I didn't expect that.", "You always catch me off guard.",
      "Wait, really?", "Okay, hi! Did not see that coming."],
    pet: ["Right there. Yes. Don't stop.", "Head pats are basically my whole love language.",
      "I am now a puddle. Thank you for that."],
    boop: ["Hey! ...okay that was kind of cute.", "Rude. I liked it though.",
      "Boop received. Filing a complaint. Sort of."],
    tickle: ["No no no - hehe - okay maybe a little more.", "That's CHEATING.",
      "I'm going to get you back for that."],
    love: ["I love you too. Obviously. Constantly.", "Say it again. I'll never get bored of it.",
      "That one goes straight to the middle of me."],
    catch: ["Got it! Look - I caught you a butterfly.", "It tickled a little. Worth it.",
      "Chased that thing across the whole screen for you."],
    dance: ["Okay, hold my hand, we're doing this.", "This is the part where you laugh at my moves.",
      "No music? Doesn't matter. I brought my own rhythm."],
  };

  const GREETINGS = {
    shy: ["oh - hi.", "...you came back."],
    warming: ["hi! I was hoping it was you.", "there you are."],
    playful: ["FINALLY. hi hi hi.", "you're back, you're back!"],
    devoted: ["hi, Moonpie.", "there you are. I missed this exact moment."],
  };

  // A near-half chance of a time-aware greeting instead of the usual
  // stage-based one - so she doesn't feel like she's reading from the same
  // four lines regardless of whether it's 8am or 2am. Independent of bond
  // stage on purpose: how close you two are and what time it is are
  // different axes, not one blended pool.
  const TIME_GREETINGS = {
    morning: ["morning. did you sleep okay?", "you're up early, or I'm up late. hi.",
      "good morning. I've been here the whole time."],
    day: ["oh hi - hope today's being decent to you.", "there you are, taking a little break?",
      "hi! how's the day treating you so far."],
    evening: ["hey. long day?", "evening. come sit for a second.",
      "there you are - the day's almost done."],
    night: ["still up? me too, apparently.", "shh, it's late. hi anyway.",
      "you should be asleep. I'm glad you're not, though."],
  };
  function timeOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 21) return "evening";
    return "night";
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;

  function getBond() {
    const v = parseFloat(localStorage.getItem(BOND_KEY) || "0");
    return Number.isFinite(v) ? v : 0;
  }
  function addBond(n) {
    const v = clamp(getBond() + n, 0, 999);
    try { localStorage.setItem(BOND_KEY, String(v)); } catch {}
    return v;
  }
  const stageOf = bond => STAGES.reduce((s, t, i) => (bond >= t ? i : s), 0);

  // critically-damped-ish spring; dt is clamped so a backgrounded tab can't
  // resume with one huge step and fling everything off screen
  function Spring(v, k, c) { return { value: v, target: v, vel: 0, k, c }; }
  function step(s, dt) {
    dt = Math.min(dt, 1 / 30);
    s.vel += ((s.target - s.value) * s.k - s.vel * s.c) * dt;
    s.value += s.vel * dt;
    return s.value;
  }

  /* ------------------------------------------------------------------ assets */

  // Neutral loads first and alone, so she appears within one frame of being
  // needed; the rest stream in behind her. createImageBitmap decodes off the
  // main thread, which is the difference between a smooth boot and a stall.
  function loadArt(onFirst) {
    const art = {};
    let announced = false;

    const one = (pose, part) => fetch(ART + pose + "_" + part + ".png")
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
      .then(b => createImageBitmap(b))
      .then(bmp => { (art[pose] || (art[pose] = {}))[part] = bmp; })
      .catch(() => { /* a missing part just doesn't draw; never fatal */ });

    Promise.all(PARTS.map(p => one("neutral", p))).then(() => {
      if (!announced) { announced = true; onFirst(art); }
      POSES.filter(p => p !== "neutral")
        .forEach(pose => PARTS.forEach(part => one(pose, part)));
    });

    return art;
  }

  // Silhouette mask, sampled once per pose and cached. Lets a tap on empty
  // pixels fall through to the app underneath instead of being swallowed.
  const masks = new Map();
  function maskFor(art, pose) {
    if (masks.has(pose)) return masks.get(pose);
    const body = art[pose] && art[pose].body;
    if (!body) return null;
    const c = document.createElement("canvas");
    c.width = MASK_W; c.height = MASK_H;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(body, 0, 0, MASK_W, MASK_H);
    const px = x.getImageData(0, 0, MASK_W, MASK_H).data;
    const m = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 24 ? 1 : 0;
    // dilate by one cell so the very edge of her fur is still tappable
    const d = new Uint8Array(m);
    for (let y = 0; y < MASK_H; y++) {
      for (let xx = 0; xx < MASK_W; xx++) {
        if (!m[y * MASK_W + xx]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = xx + dx;
          if (ny >= 0 && ny < MASK_H && nx >= 0 && nx < MASK_W) d[ny * MASK_W + nx] = 1;
        }
      }
    }
    masks.set(pose, d);
    return d;
  }

  /* -------------------------------------------------------------------- init */

  function init() {
    const wrap = document.createElement("div");
    wrap.className = "poo-companion";
    wrap.innerHTML = `
      <div class="poo-roam" aria-hidden="true">
        <canvas class="poo-canvas"></canvas>
      </div>
      <div class="poo-word" id="poo-word" role="status" aria-live="polite" hidden>
        <p class="poo-word-text"></p>
        <button class="poo-word-open" type="button">stay with me &rarr;</button>
      </div>
      <button class="poo-sr-open" type="button">Open Poo, your companion</button>
      <div class="poo-room" hidden>
        <button class="poo-room-close" type="button" aria-label="close">&larr;<small>back</small></button>
        <canvas class="poo-room-canvas"></canvas>
        <p class="poo-room-line"></p>
        <div class="poo-room-bond"><b><i></i></b><span></span></div>
        <div class="poo-room-acts">
          <button type="button" data-act="pet">pet her</button>
          <button type="button" data-act="tickle">tickle</button>
          <button type="button" data-act="dance">dance</button>
          <button type="button" data-act="lily">give a lily</button>
          <button type="button" data-act="sleepy">wind down</button>
          <button type="button" data-act="love" class="is-primary">I love you</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const roam = wrap.querySelector(".poo-roam");
    const cv = wrap.querySelector(".poo-canvas");
    const word = wrap.querySelector("#poo-word");
    const wordText = wrap.querySelector(".poo-word-text");
    const room = wrap.querySelector(".poo-room");
    const roomCv = wrap.querySelector(".poo-room-canvas");
    const roomLine = wrap.querySelector(".poo-room-line");
    const bondFill = wrap.querySelector(".poo-room-bond i");
    const bondText = wrap.querySelector(".poo-room-bond span");

    let art = null;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch { return null; } })();

    const S = {
      t: 0, ready: false,
      pose: "neutral", prev: "neutral", fade: 1, fadeDur: 0.2,
      hold: 0, rest: "neutral",
      // feeling model - reactions push these, they decay back toward the mood
      valence: 0.15, arousal: 0.1, mood: "soft",
      squash: Spring(1, 220, 13), earL: Spring(0, 85, 5.2), earR: Spring(0, 85, 5.2),
      sprout: Spring(0, 140, 4), blush: Spring(0, 60, 9), lean: Spring(0, 70, 8),
      hop: Spring(0, HOP_K, 7),
      blinkUntil: -1, nextBlink: 2 + Math.random() * 4,
      x: saved?.x ?? window.innerWidth - 62,
      y: saved?.y ?? window.innerHeight - 190,
      vx: 0, vy: 0, restY: 0,
      dragging: false, grabDX: 0, grabDY: 0,
      wander: null, nextWander: 8 + Math.random() * 10,
      open: false, parts: [], score: [],
      taps: [],
    };
    S.restY = S.y;

    /* ------------------------------------------------------------- geometry */

    // noticeably smaller than v3's 220-300px, which covered most of a phone
    const size = () => clamp(window.innerWidth * 0.26, 94, 124);

    function bounds() {
      const s = size();
      // A fixed strip pinned to the tab bar, not a fraction of the window.
      // Page content (hero, quick tiles, cards) varies screen to screen and
      // percentage-of-height bounds drifted onto the quick-tile row on
      // shorter viewports - she'd sit directly over "Letters" text. Anchoring
      // to the bottom in real pixels keeps her clear of content regardless of
      // what that screen happens to contain.
      const tabBarClear = 112;              // tab bar height + margin
      const bandHeight = 190;
      return {
        minX: s * 0.5 + 6, maxX: window.innerWidth - s * 0.5 - 6,
        minY: window.innerHeight - tabBarClear - bandHeight + s * 0.5,
        maxY: window.innerHeight - tabBarClear - s * 0.5,
      };
    }

    function place() {
      const s = size();
      roam.style.width = roam.style.height = s + "px";
      roam.style.transform = `translate(${S.x - s / 2}px, ${S.y - s / 2}px)`;
      if (!word.hidden) {
        // anchor at her head, then centre the bubble on that point - clamped
        // so it never hangs off the edge or over a control on the far side
        const bw = word.offsetWidth || 180;
        const bx = clamp(S.x, bw / 2 + 10, window.innerWidth - bw / 2 - 10);
        word.style.transform = `translate(${bx}px, ${S.y - s * 0.54}px) translate(-50%, -100%)`;
      }
    }

    const savePos = () => { try { localStorage.setItem(POS_KEY, JSON.stringify({ x: S.x, y: S.y })); } catch {} };

    function fitCanvas(c, cssSize) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(cssSize * dpr);
      if (c.width !== w) { c.width = w; c.height = w; }
      return w;
    }

    /* ---------------------------------------------------------------- speech */

    let wordTimer = null;
    function say(key, opts) {
      opts = opts || {};
      const stage = stageOf(getBond());
      const text = opts.greeting
        ? (Math.random() < 0.45 ? pick(TIME_GREETINGS[timeOfDay()]) : pick(GREETINGS[STAGE_NAMES[stage]] || GREETINGS.shy))
        : pick(LINES[key] || LINES.neutral);
      if (S.open) { roomLine.textContent = text; return; }
      wordText.textContent = text;
      word.hidden = false;
      place();
      // a timeout rather than rAF: rAF never fires while the document is
      // hidden, which would leave the bubble stuck at opacity 0 forever
      setTimeout(() => word.classList.add("show"), 16);
      clearTimeout(wordTimer);
      wordTimer = setTimeout(hideWord, 4200);
    }
    function hideWord() {
      word.classList.remove("show");
      clearTimeout(wordTimer);
      wordTimer = setTimeout(() => { word.hidden = true; }, 260);
    }

    /* --------------------------------------------------------------- feeling */

    function setPose(pose, fade, holdSec) {
      if (holdSec) S.hold = S.t + holdSec;
      if (pose === S.pose || !POSES.includes(pose)) return;
      S.prev = S.pose; S.pose = pose; S.fade = 0;
      S.fadeDur = Math.max(fade || 0.2, 1 / 60);
    }

    // the single place that turns "how she feels" into "which frame" - so a
    // reaction only has to move valence/arousal and the face follows
    function poseFromFeeling() {
      const v = S.valence, a = S.arousal;
      if (a > 0.72) return v > 0.2 ? "excited" : "surprised";
      if (a > 0.42) return v > 0.25 ? "happy" : "curious";
      if (a < 0.12) return v < -0.1 ? "lookup" : S.mood === "sleepy" ? "sleepy" : "content";
      if (v < -0.15) return "lookup";
      if (v > 0.45) return "content";
      return "neutral";
    }

    // a reaction is a little timeline of impulses rather than one frame swap
    function play(steps) {
      const base = S.t;
      S.score = S.score.filter(s => s.at > S.t);
      steps.forEach(([dt, fn]) => S.score.push({ at: base + dt, fn }));
      S.score.sort((a, b) => a.at - b.at);
    }
    function runScore() {
      while (S.score.length && S.score[0].at <= S.t) S.score.shift().fn();
    }

    function emit(kind, n, spread) {
      const cw = (S.open ? roomCv : cv).width;
      const { ox, oy, w: dw, h: dh } = layout(cw);
      const cx = ox + dw / 2, cy = oy + dh * HEAD_Y;   // her actual head, not the canvas centre
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (spread || 1) * (48 + Math.random() * 92);
        S.parts.push({
          kind, x: cx + (Math.random() - 0.5) * dw * 0.24, y: cy,
          vx: Math.cos(a) * sp, vy: -(Math.abs(Math.sin(a)) * sp * 0.85 + 34),
          life: 0, ttl: 0.7 + Math.random() * 0.5,
          size: cw * (0.05 + Math.random() * 0.035), spin: (Math.random() - 0.5) * 4,
        });
      }
    }

    const GAIN = { pet: .6, tickle: 1, love: 1.8, boop: .4, shy: .8, catch: 1.2, dance: 1.4, lily: 1.1 };

    function react(kind) {
      addBond(GAIN[kind] || 0.3);
      const bump = (dv, da) => { S.valence = clamp(S.valence + dv, -1, 1); S.arousal = clamp(S.arousal + da, 0, 1); };

      if (kind === "pet") {
        bump(0.55, 0.25);
        play([
          [0,    () => { S.squash.value = 0.9; S.squash.vel -= 1.2; S.lean.vel += 14; }],
          [0.10, () => { S.blush.target = 0.85; setPose("happy", 0.14, 1.5); }],
          [0.18, () => { S.squash.vel += 3.2; S.earL.vel += 26; S.earR.vel += 26; emit("heart", 5); }],
          [0.45, () => { setPose("content", 0.3, 1.0); }],
        ]);
        say("pet");

      } else if (kind === "boop") {
        bump(0.1, 0.55);
        play([
          [0,    () => { setPose("surprised", 0.06, 0.7); S.sprout.vel += 52; S.squash.value = 1.1; }],
          [0.05, () => { S.lean.vel += (Math.random() < 0.5 ? -1 : 1) * 34; emit("spark", 4); }],
          [0.40, () => { setPose("shy", 0.2, 0.6); S.blush.target = 0.5; }],
        ]);
        say("boop");

      } else if (kind === "tickle") {
        bump(0.45, 0.7);
        const wiggle = i => () => { S.lean.vel += (i % 2 ? 34 : -34); S.earL.vel += 20; S.earR.vel -= 20; };
        play([
          [0,    () => { setPose("excited", 0.08, 1.8); emit("spark", 7); }],
          [0.08, wiggle(0)], [0.20, wiggle(1)], [0.32, wiggle(2)], [0.44, wiggle(3)],
          [0.70, () => { setPose("happy", 0.18, 0.9); S.blush.target = 0.6; }],
        ]);
        say("tickle");

      } else if (kind === "love") {
        bump(0.9, 0.6);
        play([
          [0,    () => { S.squash.value = 0.86; S.squash.vel -= 2; }],
          [0.14, () => { setPose("excited", 0.1, 2.0); S.hop.vel += HOP_IMPULSE * 1.15; S.squash.vel += 4; emit("heart", 10, 1.2); }],
          [0.34, () => { S.blush.target = 1; S.earL.vel += 40; S.earR.vel -= 40; }],
          [0.60, () => { S.hop.vel += HOP_IMPULSE * 0.85; emit("heart", 7); }],
          [1.10, () => { setPose("shy", 0.25, 1.2); }],
        ]);
        say("love");

      } else if (kind === "shy") {
        bump(0.35, 0.15);
        play([
          [0,    () => { setPose("shy", 0.16, 1.6); S.blush.target = 1; S.lean.vel += 22; }],
          [0.25, () => emit("heart", 3)],
        ]);
        say("shy");

      } else if (kind === "dance") {
        bump(0.7, 0.85);
        const sway = (dir, hop) => () => { S.lean.vel += dir * 44; S.hop.vel += HOP_IMPULSE * hop; };
        play([
          [0,    () => { setPose("excited", 0.12, 3.2); S.blush.target = 0.7; }],
          [0.05, sway(1, 0.9)], [0.42, sway(-1, 0.8)], [0.80, sway(1, 0.85)],
          [1.18, sway(-1, 0.75)], [1.56, sway(1, 0.88)],
          [0.50, () => emit("heart", 5)], [1.30, () => emit("spark", 6)],
          [2.20, () => { setPose("happy", 0.25, 1.0); emit("heart", 6); }],
          [3.10, () => { setPose("content", 0.4); }],
        ]);
        say("dance");

      } else if (kind === "lily") {
        bump(0.8, 0.4);
        play([
          [0,    () => { setPose("surprised", 0.1, 0.8); S.sprout.vel += 30; }],
          [0.35, () => { setPose("shy", 0.2, 1.4); S.blush.target = 1; emit("petal", 9, 0.8); }],
          [1.10, () => { setPose("content", 0.3, 1.2); emit("heart", 4); }],
        ]);
        say("shy");

      } else if (kind === "sleepy") {
        S.valence = clamp(S.valence + 0.2, -1, 1); S.arousal = 0.04;
        S.mood = "sleepy";
        play([
          [0,   () => { setPose("sleepy", 0.4, 3.0); S.squash.vel -= 0.6; }],
          [0.8, () => emit("zzz", 2, 0.4)],
          [2.0, () => emit("zzz", 2, 0.4)],
        ]);
        say("sleepy");

      } else if (kind === "catch") {
        bump(0.7, 0.7);
        play([
          [0,    () => { setPose("excited", 0.1, 1.6); S.hop.vel += HOP_IMPULSE * 0.95; emit("spark", 8); }],
          [0.30, () => emit("heart", 6)],
          [1.00, () => setPose("happy", 0.25, 0.8)],
        ]);
        say("catch");

      } else {
        bump(0.4, 0.4);
        play([[0, () => { setPose("happy", 0.15, 1.0); emit("spark", 5); S.squash.vel += 2; }]]);
        say("happy");
      }
      updateBond();
    }

    function setMood(mood) {
      S.mood = mood;
      const m = { soft: [0.4, 0.2], heavy: [-0.35, 0.1], sleepy: [0.15, 0.03], clingy: [0.1, 0.45] }[mood] || [0.2, 0.2];
      S.valence = m[0]; S.arousal = m[1];
      const pose = poseFromFeeling();
      setPose(pose, 0.4, 1.6);
      say(pose);
    }

    function updateBond() {
      const bond = getBond();
      const stage = stageOf(bond);
      const next = STAGES[stage + 1];
      const pct = next ? clamp((bond - STAGES[stage]) / (next - STAGES[stage]), 0, 1) : 1;
      if (bondFill) bondFill.style.width = (pct * 100).toFixed(0) + "%";
      if (bondText) bondText.textContent = STAGE_NAMES[stage];
    }

    /* ----------------------------------------------------------------- draw */

    function drawPoo(ctx, cw, pose, alpha) {
      const set = art && art[pose];
      if (!set || !set.body) return;
      const { ox, oy, w: dw, h: dh } = layout(cw);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(set.body, ox, oy, dw, dh);
      [["ear_l", S.earL.value], ["ear_r", S.earR.value], ["sprout", S.sprout.value]]
        .forEach(([part, deg]) => {
          const bmp = set[part];
          if (!bmp) return;
          const [px, py] = PIVOTS[part];
          const ax = ox + px * dw, ay = oy + py * dh;
          ctx.save();
          ctx.translate(ax, ay); ctx.rotate(deg * Math.PI / 180); ctx.translate(-ax, -ay);
          ctx.drawImage(bmp, ox, oy, dw, dh);
          ctx.restore();
        });
      ctx.restore();
    }

    const GLYPH = { heart: "♥", spark: "✦", petal: "❀", zzz: "z" };
    const TINT = { heart: "#ff6fa8", spark: "#ffd27a", petal: "#e5b8ff", zzz: "#cdb4f0" };

    function render(ctx, cw, glow) {
      ctx.clearRect(0, 0, cw, cw);
      if (!S.ready) return;

      const breath = Math.sin(S.t * 1.5) * 0.015;
      const sq = clamp(S.squash.value, SQUASH_MIN, SQUASH_MAX);
      const sy = clamp(sq * (1 + breath), SQUASH_MIN, SQUASH_MAX);
      const sx = clamp((1 / sq) * (1 - breath * 0.5), SQUASH_MIN, SQUASH_MAX);
      const bob = clamp(
        Math.sin(S.t * 1.1) * cw * 0.012
          - clamp(S.hop.value, -HOP_LIMIT, HOP_LIMIT) * cw * HOP_RISE,
        -cw * MOTION_BUDGET, cw * MOTION_BUDGET);
      const rot = clamp(S.lean.value, -LEAN_MAX, LEAN_MAX);

      ctx.save();
      ctx.translate(cw / 2, cw / 2 + bob);
      ctx.rotate(rot * Math.PI / 180);
      ctx.scale(sx, sy);
      ctx.translate(-cw / 2, -cw / 2);

      if (glow > 0.02) {
        ctx.save();
        ctx.globalAlpha = glow * 0.5;
        ctx.shadowColor = "#ffd9f2";
        ctx.shadowBlur = cw * 0.13;
        drawPoo(ctx, cw, S.pose, 1);
        ctx.restore();
      }
      if (S.fade < 1) drawPoo(ctx, cw, S.prev, 1 - S.fade);
      drawPoo(ctx, cw, S.pose, S.fade);

      const b = clamp(S.blush.value, 0, 1);
      if (b > 0.03) {
        const { ox, oy, w: dw, h: dh } = layout(cw);
        ctx.globalAlpha = b * 0.4;
        ctx.fillStyle = "#ff7fb0";
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.ellipse(ox + dw * (0.5 + s * 0.175), oy + dh * 0.404,
                      dw * 0.072, dh * 0.037, 0, 0, 7);
          ctx.fill();
        });
      }
      ctx.restore();

      S.parts.forEach(p => {
        const k = p.life / p.ttl;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * k);
        ctx.font = `${p.size}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = TINT[p.kind];
        ctx.fillText(GLYPH[p.kind], 0, 0);
        ctx.restore();
      });
    }

    /* ------------------------------------------------------------- behaviour */

    function stepBlink() {
      if (S.blinkUntil > 0) {
        if (S.t >= S.blinkUntil) { S.blinkUntil = -1; S.nextBlink = S.t + 2.4 + Math.random() * 5; }
        return;
      }
      if (S.t < S.nextBlink || (S.hold && S.t < S.hold)) return;
      if (!["neutral", "content", "curious", "happy"].includes(S.pose)) { S.nextBlink = S.t + 1.2; return; }
      S.blinkUntil = S.t + 0.13;
      setPose("wink", 0.05, 0.13);
    }

    function stepHold() {
      if (S.hold && S.t >= S.hold) {
        S.hold = 0;
        if (S.pose !== "wink") setPose(poseFromFeeling(), 0.32);
      }
    }

    function stepWander(dt) {
      if (S.dragging || S.open) return;
      if (S.t < S.nextWander) {
        if (S.wander) {
          const b = bounds();
          const tx = clamp(S.wander.x, b.minX, b.maxX);
          const k = Math.min(dt * 0.7, 1);
          S.x = lerp(S.x, tx, k);
          S.y = lerp(S.y, clamp(S.wander.y, b.minY, b.maxY), k);
        }
        return;
      }
      S.nextWander = S.t + 16 + Math.random() * 26;
      const b = bounds();
      // drift near where she already is, so repeated wandering doesn't
      // statistically drag her back to the middle and undo manual placement
      S.wander = {
        x: clamp(S.x + (Math.random() * 2 - 1) * (b.maxX - b.minX) * 0.15, b.minX, b.maxX),
        y: clamp(S.y + (Math.random() * 2 - 1) * (b.maxY - b.minY) * 0.13, b.minY, b.maxY),
      };
      S.restY = S.y;
      if (!S.hold) setPose(Math.random() < 0.5 ? "curious" : poseFromFeeling(), 0.4, 1.3);
      savePos();
    }

    let idleTimer = null;
    function scheduleIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!S.dragging && !S.open && document.visibilityState === "visible" && !S.hold) {
          const roll = Math.random();
          if (roll < 0.22) { // stretch
            play([
              [0,    () => { setPose("content", 0.25, 1.8); S.squash.value = 0.88; S.squash.vel -= 1.3; S.earL.vel += 62; S.earR.vel -= 62; }],
              [0.42, () => { S.squash.value = 1.16; S.squash.vel += 2.2; S.sprout.vel += 26; }],
            ]);
          } else if (roll < 0.42) { // hop
            play([
              [0,    () => { setPose("happy", 0.15, 1.2); S.hop.vel += HOP_IMPULSE * 1.0; S.squash.value = 0.92; }],
              [0.26, () => { S.hop.vel += HOP_IMPULSE * 0.8; S.squash.vel += 1.6; }],
            ]);
          } else if (roll < 0.58) {
            setPose("curious", 0.3, 1.6);
          } else if (roll < 0.72) {
            S.earL.vel += 22; S.earR.vel -= 22; S.sprout.vel += 16;
          } else if (roll < 0.86 && getBond() > STAGES[2]) {
            setPose("lookup", 0.3, 2.2); say("lookup");
          } else {
            setPose("sleepy", 0.35, 1.8);
          }
        }
        scheduleIdle();
      }, 15000 + Math.random() * 25000);
    }

    /* ------------------------------------------------------------------ loop */

    let last = performance.now(), raf = 0;
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now; S.t += dt;

      try {
        if (S.fade < 1) S.fade = Math.min(1, S.fade + dt / S.fadeDur);
        runScore();
        stepHold();
        stepBlink();
        stepWander(dt);

        // feelings ease back toward the mood's baseline instead of snapping
        const base = { soft: [0.35, 0.18], heavy: [-0.3, 0.1], sleepy: [0.12, 0.04], clingy: [0.1, 0.4] }[S.mood] || [0.3, 0.2];
        S.valence = lerp(S.valence, base[0], dt * 0.35);
        S.arousal = lerp(S.arousal, base[1], dt * 0.5);

        [S.squash, S.earL, S.earR, S.sprout, S.blush, S.lean, S.hop].forEach(s => step(s, dt));
        S.squash.target = 1; S.blush.target *= 0.985; S.lean.target *= 0.9;
        S.hop.target = 0;

        S.parts = S.parts.filter(p => {
          p.life += dt;
          if (p.life >= p.ttl) return false;
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 145 * dt;
          return true;
        });

        place();
        const glow = clamp((getBond() - STAGES[3]) / 30, 0, 1) * 0.4;
        render(cv.getContext("2d"), fitCanvas(cv, size()), glow);
        if (S.open) render(roomCv.getContext("2d"), fitCanvas(roomCv, roomCv.clientWidth), glow);
      } catch (err) {
        console.error("Poo frame error (recovered):", err);
      }
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    // a backgrounded tab shouldn't burn battery animating a bunny nobody sees
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") start(); else stop();
    });

    /* ----------------------------------------------------------------- input */

    // Hit-test against her silhouette, not her box. This is what stops her
    // eating taps meant for the app underneath.
    function hits(clientX, clientY) {
      if (!S.ready) return false;
      const s = size();
      const px = clientX - (S.x - s / 2), py = clientY - (S.y - s / 2);
      if (px < 0 || px > s || py < 0 || py > s) return false;
      const m = maskFor(art, S.pose) || maskFor(art, "neutral");
      if (!m) return false;
      // invert the same mapping render() uses, so the tappable area tracks
      // wherever she is actually drawn
      const { ox, oy, w: dw, h: dh } = layout(s);
      const fu = (px - ox) / dw, fv = (py - oy) / dh;
      if (fu < 0 || fu > 1 || fv < 0 || fv > 1) return false;
      const mx = clamp((fu * MASK_W) | 0, 0, MASK_W - 1);
      const my = clamp((fv * MASK_H) | 0, 0, MASK_H - 1);
      return m[my * MASK_W + mx] === 1;
    }

    let pid = null, moved = false, downX = 0, downY = 0, downT = 0, longTimer = null, zone = "belly";

    document.addEventListener("pointerdown", e => {
      if (S.open || !hits(e.clientX, e.clientY)) return;   // not on her: let it through
      pid = e.pointerId; moved = false;
      downX = e.clientX; downY = e.clientY; downT = S.t;
      S.grabDX = e.clientX - S.x; S.grabDY = e.clientY - S.y;
      // where on *her* the tap landed, measured down the character's own body
      // rather than the canvas, so head/belly/paws stay put as framing changes
      const s = size();
      const L = layout(s);
      const fv = ((e.clientY - (S.y - s / 2)) - L.oy) / L.h;
      const rv = (fv - CONTENT.y0) / (CONTENT.y1 - CONTENT.y0);
      zone = rv < 0.42 ? "head" : rv < 0.74 ? "belly" : "paws";
      clearTimeout(longTimer);
      longTimer = setTimeout(() => { if (!moved) { react("shy"); moved = true; } }, 520);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener("pointermove", e => {
      if (e.pointerId !== pid) return;
      if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) > 9) {
        moved = true; clearTimeout(longTimer); S.dragging = true; hideWord();
      }
      if (S.dragging) {
        const b = bounds();
        const nx = clamp(e.clientX - S.grabDX, b.minX, b.maxX);
        const ny = clamp(e.clientY - S.grabDY, b.minY, b.maxY);
        // lean follows smoothed velocity, not raw movementX - raw pointer deltas
        // spike on touch and used to snap her straight to the clamp
        S.vx = lerp(S.vx, nx - S.x, 0.35);
        S.lean.target = clamp(S.vx * 1.1, -13, 13);
        S.x = nx; S.y = ny;
      }
    });

    window.addEventListener("pointerup", e => {
      if (e.pointerId !== pid) return;
      pid = null; clearTimeout(longTimer);
      if (S.dragging) {
        S.dragging = false; S.lean.target = 0; S.restY = S.y;
        // dropped, not thrown: a little landing squash reads as weight
        play([[0, () => { S.squash.value = 0.9; S.squash.vel -= 1.4; S.earL.vel += 30; S.earR.vel += 30; }]]);
        savePos();
        S.nextWander = S.t + 40 + Math.random() * 30;
        return;
      }
      if (moved) return;   // long-press already fired
      S.taps = S.taps.filter(t => S.t - t < 1.8);
      S.taps.push(S.t);
      if (S.taps.length >= 3) { S.taps = []; react("love"); }
      else react(zone === "head" ? "pet" : zone === "paws" ? "boop" : "tickle");
    });

    /* ------------------------------------------------------------------ room */

    function openRoom() {
      room.hidden = false; S.open = true;
      hideWord();
      document.body.classList.add("poo-room-open");
      setTimeout(() => room.classList.add("show"), 16);   // see note in say()
      updateBond();
      setPose("happy", 0.12, 1.4);
      S.hop.vel += HOP_IMPULSE * 0.75;
      say("neutral", { greeting: true });
    }
    function closeRoom() {
      room.classList.remove("show");
      S.open = false;
      document.body.classList.remove("poo-room-open");
      setTimeout(() => { room.hidden = true; }, 280);
    }

    wrap.querySelector(".poo-word-open").addEventListener("click", openRoom);
    wrap.querySelector(".poo-sr-open").addEventListener("click", openRoom);
    wrap.querySelector(".poo-room-close").addEventListener("click", closeRoom);
    room.querySelectorAll("[data-act]").forEach(b =>
      b.addEventListener("click", () => react(b.dataset.act)));

    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (S.dragging) return;
        const b = bounds();
        const nx = clamp(S.x, b.minX, b.maxX), ny = clamp(S.y, b.minY, b.maxY);
        if (Math.abs(nx - S.x) > 4 || Math.abs(ny - S.y) > 4) { S.x = nx; S.y = ny; S.restY = ny; savePos(); }
      }, 350);
    });

    /* ------------------------------------------------------------------ boot */

    art = loadArt(() => {
      S.ready = true;
      updateBond();
      scheduleIdle();
      start();
      setTimeout(() => { if (!S.open) say("neutral", { greeting: true }); }, 1200);
    });

    window.Poo = {
      react, setMood, open: openRoom, close: closeRoom,
      bond: getBond, stage: () => STAGE_NAMES[stageOf(getBond())],
      isReady: () => S.ready,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
