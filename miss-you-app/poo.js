/*
 * Poo - a small companion who lives in Michelle's universe.
 *
 * She is mounted once, at the page level, so she is present on every screen
 * without any screen needing to know about her. Other parts of the app talk
 * to her through the tiny public API at the bottom (window.Poo), the same
 * way they already call things like toast() or burstAt().
 *
 * Visual approach: her body is one full sprite per expression (never holed),
 * with her ears and head-tuft drawn again on top as a separate layer that
 * springs independently - so she has real secondary motion without ever
 * showing a gap. Expressions cross-fade rather than cut. This is the same
 * technique verified for the native build, ported to plain canvas.
 */
(function () {
  "use strict";

  const ASSET_DIR = "./assets/poo/rig/";
  const POSES = ["neutral", "content", "happy", "excited", "curious",
                 "lookup", "shy", "sleepy", "surprised", "wink"];
  const PARTS = ["body", "ear_l", "ear_r", "sprout"];
  // measured on the shared 620x700 sprite canvas, expressed as fractions
  // (averaged from rig.json across all rigged poses)
  const PIVOTS = { ear_l: [0.445, 0.439], ear_r: [0.554, 0.439], sprout: [0.499, 0.378] };

  // a few lines in the site's own voice, not sprite-caption exclamations -
  // shown only in the expanded view, styled like the rest of the copy
  const LINES = {
    content: ["I'm glad you're here.", "Just keeping your corner warm."],
    happy: ["That one made me happy too.", "I felt that, all the way over here."],
    excited: ["Tell me everything.", "I've been waiting for you to look over."],
    shy: ["...you're going to make me blush.", "I don't know where to look now."],
    sleepy: ["Rest. I'll still be here when you wake up.", "Close your eyes. I'll keep watch."],
    lookup: ["I keep glancing toward the door for you.", "Still watching for you."],
    surprised: ["Oh! I didn't expect that.", "You always catch me off guard."],
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function Spring(v, k, c) {
    return { value: v, target: v, vel: 0, k, c };
  }
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
        el.onload = el.onerror = () => {
          pending--;
          if (pending === 0 && started) onDone(img);
        };
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
      <button class="poo-bubble" type="button" aria-label="say hi to Poo">
        <canvas class="poo-canvas" width="220" height="220"></canvas>
      </button>
      <div class="poo-panel" hidden>
        <div class="poo-panel-card">
          <button class="poo-panel-close" type="button" aria-label="close">×</button>
          <canvas class="poo-canvas-big" width="480" height="480"></canvas>
          <p class="poo-line" id="poo-line"></p>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function init() {
    const dom = buildDom();
    const bubbleCanvas = dom.querySelector(".poo-canvas");
    const bigCanvas = dom.querySelector(".poo-canvas-big");
    const panel = dom.querySelector(".poo-panel");
    const lineEl = dom.querySelector("#poo-line");
    const bubbleBtn = dom.querySelector(".poo-bubble");
    const closeBtn = dom.querySelector(".poo-panel-close");

    let images = null;
    loadImages(loaded => { images = loaded; });

    const S = {
      t: 0,
      pose: "neutral", prevPose: "neutral", fade: 1, fadeDur: 0.2,
      squash: Spring(1, 220, 12),
      earL: Spring(0, 85, 5.2),
      earR: Spring(0, 85, 5.2),
      sprout: Spring(0, 140, 4),
      blush: Spring(0, 60, 9),
      blinkUntil: -1, nextBlink: 2 + Math.random() * 4,
      parts: [],
      pressTimer: null,
      recentTaps: [],
      expanded: false,
    };

    function setPose(pose, fade) {
      if (pose === S.pose) return;
      S.prevPose = S.pose;
      S.pose = pose;
      S.fade = 0;
      S.fadeDur = Math.max(fade || 0.2, 1 / 60);
    }

    function say(pose) {
      if (!S.expanded) return;
      const pool = LINES[pose];
      if (pool) lineEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    }

    function emit(kind, cw, x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 70;
        S.parts.push({
          kind, x, y,
          vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a) * sp) * 0.8 + 20,
          life: 0, ttl: 0.55 + Math.random() * 0.35,
          size: cw * (0.06 + Math.random() * 0.03),
        });
      }
    }

    function react(kind) {
      const cw = (S.expanded ? bigCanvas : bubbleCanvas).width;
      const cx = cw / 2, cy = cw * 0.42;
      S.squash.value = 0.88; S.squash.vel += 1.8;
      S.earL.vel += (Math.random() - 0.5) * 30;
      S.earR.vel += (Math.random() - 0.5) * 30;
      S.sprout.vel += 20;

      if (kind === "love") {
        setPose("excited", 0.15);
        emit("heart", cw, cx, cy, 10);
        S.blush.target = 1;
        setTimeout(() => setPose("content", 0.3), 900);
        say("excited");
      } else if (kind === "shy") {
        setPose("shy", 0.15);
        S.blush.target = 1;
        emit("heart", cw, cx, cy, 3);
        setTimeout(() => setPose("content", 0.3), 1100);
        say("shy");
      } else if (kind === "cheer") {
        setPose("happy", 0.12);
        emit("spark", cw, cx, cy, 6);
        setTimeout(() => setPose("content", 0.3), 800);
        say("happy");
      } else if (kind === "sleepy") {
        setPose("sleepy", 0.3);
        say("sleepy");
      } else if (kind === "surprised") {
        setPose("surprised", 0.1);
        emit("spark", cw, cx, cy, 6);
        setTimeout(() => setPose("curious", 0.3), 700);
        say("surprised");
      } else {
        setPose("happy", 0.15);
        emit("spark", cw, cx, cy, 5);
        setTimeout(() => setPose("content", 0.3), 800);
        say("happy");
      }
    }

    function setMood(mood) {
      const map = { soft: "content", heavy: "shy", sleepy: "sleepy", clingy: "lookup" };
      const pose = map[mood] || "neutral";
      setPose(pose, 0.35);
      say(pose);
    }

    function dims(cw) {
      const aspect = 620 / 700;
      return [cw * aspect, cw];
    }

    function drawPuppet(ctx, cw, pose, alpha) {
      const set = images && images[pose];
      if (!set) return;
      const [dw, dh] = dims(cw);
      const x0 = (cw - dw) / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (set.body.complete) ctx.drawImage(set.body, x0, 0, dw, dh);

      [["ear_l", S.earL.value], ["ear_r", S.earR.value], ["sprout", S.sprout.value]]
        .forEach(([part, angle]) => {
          const img = set[part];
          if (!img.complete) return;
          const [px, py] = PIVOTS[part];
          const ax = x0 + px * dw, ay = py * dh;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(angle * Math.PI / 180);
          ctx.translate(-ax, -ay);
          ctx.drawImage(img, x0, 0, dw, dh);
          ctx.restore();
        });
      ctx.restore();
    }

    function draw(ctx, cw) {
      ctx.clearRect(0, 0, cw, cw);
      const breath = Math.sin(S.t * 1.5) * 0.015;
      const sq = S.squash.value;
      const sy = sq * (1 + breath);
      const sx = (1 / Math.max(sq, 0.4)) * (1 - breath * 0.5);
      const bob = Math.sin(S.t * 1.1) * cw * 0.012;

      ctx.save();
      ctx.translate(cw / 2, cw / 2 + bob);
      ctx.scale(sx, sy);
      ctx.translate(-cw / 2, -cw / 2);

      if (S.fade < 1) drawPuppet(ctx, cw, S.prevPose, 1 - S.fade);
      drawPuppet(ctx, cw, S.pose, S.fade);

      const b = clamp(S.blush.value, 0, 1);
      if (b > 0.03) {
        ctx.globalAlpha = b * 0.45;
        ctx.fillStyle = "#ff7fb0";
        const [dw, dh] = dims(cw);
        const x0 = (cw - dw) / 2;
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.ellipse(x0 + dw / 2 + s * dw * 0.17, dh * 0.40, dw * 0.075, dw * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();

      S.parts.forEach(p => {
        const life = p.life / p.ttl;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - life);
        ctx.font = p.size + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = p.kind === "heart" ? "#ff7fb0" : "#ffd27a";
        ctx.fillText(p.kind === "heart" ? "♥" : "✦", p.x, p.y);
        ctx.restore();
      });
    }

    function stepBlink() {
      if (S.blinkUntil > 0) {
        if (S.t >= S.blinkUntil) {
          S.blinkUntil = -1;
          S.nextBlink = S.t + 2.5 + Math.random() * 5;
          if (["neutral", "content", "curious"].includes(S.pose)) { /* stays */ }
        }
        return;
      }
      if (S.t < S.nextBlink) return;
      if (!["neutral", "content", "curious"].includes(S.pose)) { S.nextBlink = S.t + 1; return; }
      S.blinkUntil = S.t + 0.12;
      const was = S.pose;
      setPose("wink", 0.05);
      setTimeout(() => { if (S.pose === "wink") setPose(was, 0.08); }, 120);
    }

    let last = performance.now();
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      S.t += dt;

      if (S.fade < 1) S.fade = Math.min(1, S.fade + dt / S.fadeDur);
      stepBlink();
      [S.squash, S.earL, S.earR, S.sprout, S.blush].forEach(s => springStep(s, dt));
      S.blush.target *= 0.99;

      S.parts = S.parts.filter(p => {
        p.life += dt;
        if (p.life >= p.ttl) return false;
        p.x += p.vx * dt; p.y -= p.vy * dt; p.vy -= 130 * dt;
        return true;
      });

      draw(bubbleCanvas.getContext("2d"), bubbleCanvas.width);
      if (S.expanded) draw(bigCanvas.getContext("2d"), bigCanvas.width);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });

    // idle acts, gentle and rare - a look-around or a little wiggle, never
    // more than one system running at once
    function scheduleIdle() {
      setTimeout(() => {
        if (!S.pressTimer && document.visibilityState === "visible") {
          const acts = ["look", "wiggle", "stretch"];
          const act = acts[Math.floor(Math.random() * acts.length)];
          if (act === "look") { setPose("curious", 0.3); setTimeout(() => setPose("neutral", 0.3), 1400); }
          else if (act === "wiggle") { S.earL.vel += 24; S.earR.vel -= 24; S.sprout.vel += 18; }
          else { S.squash.value = 1.08; S.squash.vel -= 1; }
        }
        scheduleIdle();
      }, 22000 + Math.random() * 40000);
    }
    scheduleIdle();

    // ---- interaction ----
    let tapTimer = null;
    bubbleBtn.addEventListener("click", () => {
      S.recentTaps = S.recentTaps.filter(t => S.t - t < 2);
      S.recentTaps.push(S.t);
      react(S.recentTaps.length >= 3 ? "love" : "cheer");
    });

    let pressStart = 0;
    bubbleBtn.addEventListener("pointerdown", () => {
      pressStart = performance.now();
      S.pressTimer = setTimeout(() => { react("shy"); S.pressTimer = null; }, 550);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
      bubbleBtn.addEventListener(ev, () => {
        if (S.pressTimer) { clearTimeout(S.pressTimer); S.pressTimer = null; }
      }));

    let lastBubbleClick = 0;
    bubbleBtn.addEventListener("dblclick", (e) => { e.preventDefault(); });

    function openPanel() {
      panel.hidden = false;
      S.expanded = true;
      requestAnimationFrame(() => panel.classList.add("open"));
      react("cheer");
    }
    function closePanel() {
      panel.classList.remove("open");
      S.expanded = false;
      setTimeout(() => { panel.hidden = true; }, 220);
    }
    bubbleBtn.addEventListener("dblclick", openPanel);
    closeBtn.addEventListener("click", closePanel);
    panel.addEventListener("click", (e) => { if (e.target === panel) closePanel(); });

    // ---- public API ----
    window.Poo = { react, setMood, open: openPanel, close: closePanel };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
