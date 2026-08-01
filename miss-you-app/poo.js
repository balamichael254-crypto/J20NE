/*
 * Poo - Michelle's companion. She lives loose on the screen, not tucked in a
 * corner bubble: bigger, freely draggable, drifting on her own between
 * interactions, and opens full-screen when you want her whole attention.
 *
 * Visual approach unchanged from before: each expression is one full sprite
 * (never holed), with ears/head-tuft drawn again on top as an independently
 * springy layer - verified technique, just given more room to move.
 */
(function () {
  "use strict";

  const ASSET_DIR = "./assets/poo/rig/";
  const POSES = ["neutral", "content", "happy", "excited", "curious",
                 "lookup", "shy", "sleepy", "surprised", "wink"];
  const PARTS = ["body", "ear_l", "ear_r", "sprout"];
  const PIVOTS = { ear_l: [0.445, 0.439], ear_r: [0.554, 0.439], sprout: [0.499, 0.378] };

  const BOND_KEY = "moonpie-poo-bond";
  const POS_KEY = "moonpie-poo-pos";
  const STAGES = [0, 8, 24, 55]; // shy, warming, playful, devoted
  const STAGE_NAMES = ["shy", "warming", "playful", "devoted"];

  // A generous pool per emotion so she never says the same thing twice in a
  // row. {name} is replaced with Moonpie only once she is bonded enough that
  // it feels earned rather than constant.
  const LINES = {
    neutral: ["Just glad to be near you.", "I like it here, watching your world.",
      "No rush. I'll just sit with you a while."],
    content: ["This is a good, quiet kind of happy.", "I could stay right here a long time.",
      "You make ordinary minutes feel soft."],
    happy: ["That made me happy too.", "I felt that, all the way over here.",
      "You have good taste in tiny joys.", "See, this is why I like being yours."],
    excited: ["Tell me everything, don't leave anything out.",
      "I've been waiting for you to look over here.", "Okay, okay, what happened?!"],
    curious: ["Hm. What are you thinking about?", "You have that look again - tell me.",
      "I'm nosy about your whole day, honestly."],
    lookup: ["I keep glancing over, hoping it's your turn to visit.",
      "Still watching the door for you.", "You're my favorite thing to wait for."],
    shy: ["...you're going to make me blush.", "I don't know where to look now.",
      "Stop it. ...don't actually stop it."],
    sleepy: ["Rest. I'll still be here when you wake up.", "Close your eyes. I'll keep watch.",
      "Sleepy, but happy-sleepy. The good kind."],
    surprised: ["Oh! I didn't expect that.", "You always catch me off guard.",
      "Wait, really?"],
    wink: ["Caught you looking.", "Hehe."],
  };

  const GREETINGS = {
    shy: ["oh - hi.", "...you came back."],
    warming: ["hi! I was hoping it was you.", "there you are."],
    playful: ["FINALLY. hi hi hi.", "you're back, you're back!"],
    devoted: ["hi, {name}.", "there you are. I missed this exact moment."],
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function getBond() {
    const v = parseFloat(localStorage.getItem(BOND_KEY) || "0");
    return Number.isFinite(v) ? v : 0;
  }
  function addBond(amount) {
    const v = clamp(getBond() + amount, 0, 999);
    localStorage.setItem(BOND_KEY, String(v));
    return v;
  }
  function stageOf(bond) {
    let s = 0;
    STAGES.forEach((t, i) => { if (bond >= t) s = i; });
    return s;
  }

  function Spring(v, k, c) { return { value: v, target: v, vel: 0, k, c }; }
  function springStep(s, dt) {
    dt = Math.min(dt, 1 / 30);
    s.vel += ((s.target - s.value) * s.k - s.vel * s.c) * dt;
    s.value += s.vel * dt;
    return s.value;
  }

  function loadImages(onDone) {
    const img = {};
    let pending = 0, started = false;
    POSES.forEach(pose => {
      img[pose] = {};
      PARTS.forEach(part => {
        pending++;
        const el = new Image();
        el.src = ASSET_DIR + pose + "_" + part + ".png";
        el.onload = el.onerror = () => { pending--; if (pending === 0 && started) onDone(img); };
        img[pose][part] = el;
      });
    });
    started = true;
    if (pending === 0) onDone(img);
    return img;
  }

  function buildDom() {
    const wrap = document.createElement("div");
    wrap.className = "poo-companion";
    wrap.innerHTML = `
      <div class="poo-roam" tabindex="0" role="button" aria-label="Poo, tap to say hi">
        <canvas class="poo-canvas" width="360" height="360"></canvas>
        <div class="poo-word" id="poo-word" aria-hidden="true"></div>
      </div>
      <div class="poo-full" hidden>
        <button class="poo-full-close" type="button" aria-label="close">
          <span>←</span><small>back</small>
        </button>
        <canvas class="poo-canvas-full" width="900" height="900"></canvas>
        <p class="poo-full-line" id="poo-full-line"></p>
        <div class="poo-full-actions">
          <button class="secondary-btn" data-poo-act="pet" type="button">pet her</button>
          <button class="secondary-btn" data-poo-act="tickle" type="button">tickle</button>
          <button class="primary-btn" data-poo-act="love" type="button">tell her you love her</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function init() {
    const dom = buildDom();
    const roam = dom.querySelector(".poo-roam");
    const bubbleCanvas = dom.querySelector(".poo-canvas");
    const wordEl = dom.querySelector("#poo-word");
    const full = dom.querySelector(".poo-full");
    const fullCanvas = dom.querySelector(".poo-canvas-full");
    const fullLine = dom.querySelector("#poo-full-line");
    const fullClose = dom.querySelector(".poo-full-close");

    let images = null;
    loadImages(loaded => { images = loaded; });

    const savedPos = (() => {
      try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch { return null; }
    })();

    const S = {
      t: 0,
      pose: "neutral", prevPose: "neutral", fade: 1, fadeDur: 0.2,
      squash: Spring(1, 220, 12),
      earL: Spring(0, 85, 5.2), earR: Spring(0, 85, 5.2), sprout: Spring(0, 140, 4),
      blush: Spring(0, 60, 9), tiltLean: Spring(0, 70, 8),
      blinkUntil: -1, nextBlink: 2 + Math.random() * 4,
      recentTaps: [], expanded: false,
      x: savedPos?.x ?? (window.innerWidth * 0.74),
      y: savedPos?.y ?? (window.innerHeight * 0.6),
      wanderTarget: null, nextWander: 6 + Math.random() * 10,
      dragging: false,
      restPose: "neutral", holdUntil: 0,
    };

    const size = () => Math.min(210, Math.max(150, window.innerWidth * 0.42));

    function bounds() {
      const s = size();
      return {
        minX: s / 2 + 8, maxX: window.innerWidth - s / 2 - 8,
        minY: window.innerHeight * 0.16 + s / 2, maxY: window.innerHeight * 0.82 - s / 2,
      };
    }

    function placeRoam() {
      const s = size();
      roam.style.width = s + "px";
      roam.style.height = s + "px";
      roam.style.left = (S.x - s / 2) + "px";
      roam.style.top = (S.y - s / 2) + "px";
    }

    function savePos() {
      try { localStorage.setItem(POS_KEY, JSON.stringify({ x: S.x, y: S.y })); } catch {}
    }

    function setPose(pose, fade, holdSec) {
      if (holdSec) S.holdUntil = S.t + holdSec;
      if (pose === S.pose) return;
      S.prevPose = S.pose; S.pose = pose; S.fade = 0;
      S.fadeDur = Math.max(fade || 0.2, 1 / 60);
    }

    function say(pose, opts) {
      opts = opts || {};
      const stage = stageOf(getBond());
      const name = "Moonpie";
      let text;
      if (opts.greeting) {
        text = pick(GREETINGS[STAGE_NAMES[stage]] || GREETINGS.shy);
      } else {
        const pool = LINES[pose] || LINES.neutral;
        text = pick(pool);
      }
      text = text.replace("{name}", name);
      if (S.expanded) {
        fullLine.textContent = text;
      } else {
        wordEl.textContent = text;
        wordEl.classList.remove("show");
        void wordEl.offsetWidth;
        wordEl.classList.add("show");
        clearTimeout(say._t);
        say._t = setTimeout(() => wordEl.classList.remove("show"), 3200);
      }
    }

    function emit(kind, cw, x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 50 + Math.random() * 90;
        S.parts.push({
          kind, x, y,
          vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a) * sp) * 0.8 + 30,
          life: 0, ttl: 0.6 + Math.random() * 0.4, size: cw * (0.055 + Math.random() * 0.03),
        });
      }
    }
    S.parts = [];

    function react(kind, opts) {
      opts = opts || {};
      const cv = S.expanded ? fullCanvas : bubbleCanvas;
      const cw = cv.width, cx = cw / 2, cy = cw * 0.4;
      S.squash.value = 0.86; S.squash.vel += 2;
      S.earL.vel += (Math.random() - 0.5) * 34; S.earR.vel += (Math.random() - 0.5) * 34;
      S.sprout.vel += 22;

      const bondGain = { pet: 0.6, cheer: 0.4, love: 1.6, tickle: 1.0, shy: 0.8 }[kind] || 0.3;
      addBond(bondGain);

      if (kind === "love") {
        setPose("excited", 0.14, 1.0); emit("heart", cw, cx, cy, 14); S.blush.target = 1;
        say("excited");
      } else if (kind === "shy") {
        setPose("shy", 0.14, 1.1); S.blush.target = 1; emit("heart", cw, cx, cy, 4);
        say("shy");
      } else if (kind === "tickle") {
        setPose("surprised", 0.1, 0.26); emit("spark", cw, cx, cy, 8);
        S.tiltLean.vel += 40;
        setTimeout(() => { if (!S.holdUntil || S.t >= S.holdUntil - 0.9) { setPose("happy", 0.2, 0.85); say("happy"); } }, 260);
      } else if (kind === "sleepy") {
        setPose("sleepy", 0.3); say("sleepy");
      } else if (kind === "surprised") {
        setPose("surprised", 0.1, 0.7); emit("spark", cw, cx, cy, 7);
        say("surprised");
      } else if (kind === "pet") {
        setPose("content", 0.2); emit("heart", cw, cx, cy, 5); S.blush.target = 0.7;
        say("content");
      } else {
        setPose("happy", 0.15, 0.8); emit("spark", cw, cx, cy, 6);
        say("happy");
      }
    }

    function setMood(mood) {
      const map = { soft: "content", heavy: "shy", sleepy: "sleepy", clingy: "lookup" };
      const pose = map[mood] || "neutral";
      S.restPose = pose;
      setPose(pose, 0.35);
      say(pose);
    }

    function dims(cw) { const aspect = 620 / 700; return [cw * aspect, cw]; }

    function drawPuppet(ctx, cw, pose, alpha) {
      const set = images && images[pose];
      if (!set) return;
      const [dw, dh] = dims(cw);
      const x0 = (cw - dw) / 2;
      ctx.save(); ctx.globalAlpha = alpha;
      if (set.body.complete) ctx.drawImage(set.body, x0, 0, dw, dh);
      [["ear_l", S.earL.value], ["ear_r", S.earR.value], ["sprout", S.sprout.value]]
        .forEach(([part, angle]) => {
          const img = set[part];
          if (!img.complete) return;
          const [px, py] = PIVOTS[part];
          const ax = x0 + px * dw, ay = py * dh;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle * Math.PI / 180); ctx.translate(-ax, -ay);
          ctx.drawImage(img, x0, 0, dw, dh);
          ctx.restore();
        });
      ctx.restore();
    }

    function drawInto(ctx, cw, glow) {
      ctx.clearRect(0, 0, cw, cw);
      const breath = Math.sin(S.t * 1.5) * 0.015;
      const sq = S.squash.value;
      const sy = sq * (1 + breath);
      const sx = (1 / Math.max(sq, 0.4)) * (1 - breath * 0.5);
      const bob = Math.sin(S.t * 1.1) * cw * 0.014;
      const rot = clamp(S.tiltLean.value, -22, 22);

      ctx.save();
      ctx.translate(cw / 2, cw / 2 + bob);
      ctx.rotate(rot * Math.PI / 180);
      ctx.scale(sx, sy);
      ctx.translate(-cw / 2, -cw / 2);

      if (glow > 0.02) {
        ctx.save(); ctx.globalAlpha = glow * 0.55; ctx.shadowColor = "#ffd9f2"; ctx.shadowBlur = cw * 0.12;
        drawPuppet(ctx, cw, S.pose, 1); ctx.restore();
      }
      if (S.fade < 1) drawPuppet(ctx, cw, S.prevPose, 1 - S.fade);
      drawPuppet(ctx, cw, S.pose, S.fade);

      const b = clamp(S.blush.value, 0, 1);
      if (b > 0.03) {
        ctx.globalAlpha = b * 0.45; ctx.fillStyle = "#ff7fb0";
        const [dw, dh] = dims(cw); const x0 = (cw - dw) / 2;
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.ellipse(x0 + dw / 2 + s * dw * 0.17, dh * 0.40, dw * 0.075, dw * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();

      S.parts.forEach(p => {
        const life = p.life / p.ttl;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - life);
        ctx.font = p.size + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = p.kind === "heart" ? "#ff7fb0" : "#ffd27a";
        ctx.fillText(p.kind === "heart" ? "♥" : "✦", p.x, p.y);
        ctx.restore();
      });
    }

    function stepBlink() {
      if (S.blinkUntil > 0) {
        if (S.t >= S.blinkUntil) { S.blinkUntil = -1; S.nextBlink = S.t + 2.5 + Math.random() * 5; }
        return;
      }
      if (S.t < S.nextBlink) return;
      if (S.holdUntil && S.t < S.holdUntil) return;
      if (!["neutral", "content", "curious"].includes(S.pose)) { S.nextBlink = S.t + 1; return; }
      S.blinkUntil = S.t + 0.12;
      setPose("wink", 0.05, 0.12);
    }

    function stepWander(dt) {
      if (S.dragging || S.expanded) return;
      if (S.t < S.nextWander) {
        if (S.wanderTarget) {
          const b = bounds();
          const tx = clamp(S.wanderTarget.x, b.minX, b.maxX);
          const ty = clamp(S.wanderTarget.y, b.minY, b.maxY);
          S.x += (tx - S.x) * Math.min(dt * 0.6, 1);
          S.y += (ty - S.y) * Math.min(dt * 0.6, 1);
          S.tiltLean.target = clamp((tx - S.x) * 0.15, -14, 14);
        }
        return;
      }
      S.nextWander = S.t + 14 + Math.random() * 26;
      const b = bounds();
      S.wanderTarget = {
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
      };
      if (!S.holdUntil || S.t >= S.holdUntil) setPose(Math.random() < 0.5 ? "curious" : "neutral", 0.4, 1.2);
      savePos();
    }

    // the one authority that returns her to rest once any hold expires -
    // replaces the old scattered setTimeout reverts that could race each other
    function stepHold() {
      if (S.holdUntil && S.t >= S.holdUntil) {
        S.holdUntil = 0;
        if (S.pose !== "wink") setPose(S.restPose, 0.3);
      }
    }

    let last = performance.now();
    function loop(now) {
      try {
        const dt = Math.min((now - last) / 1000, 1 / 20);
        last = now; S.t += dt;

        if (S.fade < 1) S.fade = Math.min(1, S.fade + dt / S.fadeDur);
        stepHold();
        stepBlink();
        stepWander(dt);
        [S.squash, S.earL, S.earR, S.sprout, S.blush, S.tiltLean].forEach(s => springStep(s, dt));
        S.blush.target *= 0.99; S.tiltLean.target *= 0.96;

        S.parts = S.parts.filter(p => {
          p.life += dt; if (p.life >= p.ttl) return false;
          p.x += p.vx * dt; p.y -= p.vy * dt; p.vy -= 130 * dt;
          return true;
        });

        placeRoam();
        const bond = getBond();
        const glow = clamp((bond - STAGES[3]) / 30, 0, 1) * 0.4;
        drawInto(bubbleCanvas.getContext("2d"), bubbleCanvas.width, glow);
        if (S.expanded) drawInto(fullCanvas.getContext("2d"), fullCanvas.width, glow);
      } catch (err) {
        last = now;
        console.error("Poo loop error (recovered):", err);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });

    // idle acts - gentle, occasional, never stacked with wandering's own pose change
    function scheduleIdle() {
      setTimeout(() => {
        if (!S.dragging && !S.expanded && document.visibilityState === "visible") {
          const acts = ["look", "wiggle", "stretch", "yawn"];
          const bond = getBond();
          const act = bond > STAGES[2] && Math.random() < 0.3 ? "watch"
            : acts[Math.floor(Math.random() * acts.length)];
          if (act === "look") { setPose("curious", 0.3, 1.5); }
          else if (act === "wiggle") { S.earL.vel += 24; S.earR.vel -= 24; S.sprout.vel += 18; }
          else if (act === "yawn") { setPose("sleepy", 0.3, 1.6); }
          else if (act === "watch") { setPose("lookup", 0.3, 2.2); say("lookup"); }
          else { S.squash.value = 1.08; S.squash.vel -= 1; }
        }
        scheduleIdle();
      }, 20000 + Math.random() * 34000);
    }
    scheduleIdle();

    // ---- drag ----
    let moved = false, holdTimer = null, startX = 0, startY = 0;
    roam.addEventListener("pointerdown", (e) => {
      roam.setPointerCapture(e.pointerId);
      S.dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      holdTimer = setTimeout(() => { if (!moved) react("shy"); }, 550);
    });
    roam.addEventListener("pointermove", (e) => {
      if (!S.dragging) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
        moved = true; clearTimeout(holdTimer);
      }
      if (moved) {
        const b = bounds();
        S.x = clamp(e.clientX, b.minX, b.maxX);
        S.y = clamp(e.clientY, b.minY, b.maxY);
        S.tiltLean.target = clamp((e.movementX || 0) * 1.2, -20, 20);
      }
    });
    roam.addEventListener("pointerup", () => {
      clearTimeout(holdTimer);
      S.dragging = false;
      S.tiltLean.target = 0;
      if (!moved) {
        S.recentTaps = S.recentTaps.filter(t => S.t - t < 2);
        S.recentTaps.push(S.t);
        react(S.recentTaps.length >= 3 ? "love" : "cheer");
      } else {
        savePos();
        S.nextWander = S.t + 16 + Math.random() * 20;
      }
    });
    roam.addEventListener("dblclick", () => openFull());

    function openFull() {
      full.hidden = false;
      S.expanded = true;
      requestAnimationFrame(() => full.classList.add("open"));
      say("neutral", { greeting: true });
      document.body.classList.add("poo-full-open");
    }
    function closeFull() {
      full.classList.remove("open");
      S.expanded = false;
      document.body.classList.remove("poo-full-open");
      setTimeout(() => { full.hidden = true; }, 260);
    }
    fullClose.addEventListener("click", closeFull);
    full.querySelectorAll("[data-poo-act]").forEach(btn => {
      btn.addEventListener("click", () => react(btn.dataset.pooAct));
    });

    window.addEventListener("resize", () => {
      const b = bounds();
      S.x = clamp(S.x, b.minX, b.maxX);
      S.y = clamp(S.y, b.minY, b.maxY);
    });

    // ---- public API ----
    window.Poo = { react, setMood, open: openFull, close: closeFull, bond: getBond };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
