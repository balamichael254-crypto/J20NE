/*
 * Bloom - the ambient particle layer.
 *
 * Not one drifting-petal effect recolored for every screen - three different
 * PLACES with their own physics, switched by the room the app is in
 * (document.body.dataset.world):
 *
 *   garden (the default)  - real photographed lily petals, fall with gravity
 *                            and a lazy sway, exactly like a petal actually
 *                            drifting down off a branch.
 *   space  ("distance")   - hearts rise weightless, no gravity, a slow gentle
 *                            sway, like held balloons in zero-g.
 *   ocean  ("care")       - bubbles rise with a wobble that grows the closer
 *                            they get to the surface, thinning as they go.
 *
 * Celebration confetti/burst stay real lily petals everywhere - that's a
 * reward effect from a specific tap, not part of the room's ambience, so it
 * doesn't need to match the scene underneath it.
 *
 * Paused entirely when the tab is hidden or the room is the vault (a private
 * screen with no ambient distraction), and draws nothing under
 * prefers-reduced-motion.
 */
(function () {
  "use strict";

  const SRC = ["./assets/flowers/lily-1.webp", "./assets/flowers/lily-2.webp",
               "./assets/flowers/lily-3.webp", "./assets/flowers/lily-4.webp",
               "./assets/flowers/lily-5.webp", "./assets/flowers/lily-6.webp"];

  const AMBIENT = 11;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];

  let cv, ctx, art = [], parts = [], raf = 0, last = 0, dpr = 1, W = 0, H = 0;
  let scene = "garden";

  function sceneFor(world) {
    if (world === "distance") return "space";
    if (world === "care") return "ocean";
    // "us" has its own bespoke DOM fireflies (see the .hearth-fly elements in
    // index.html/app.js) - the canvas ambience would draw straight over the
    // meadow scene, so it stays off here same as it does for the vault
    if (world === "vault" || world === "us") return "none";
    return "garden";
  }

  function fit() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* -------------------------------------------------------------- spawners */

  function petal(seeded) {
    const s = rnd(0.055, 0.13);
    return {
      kind: "petal", img: pick(art),
      x: rnd(-40, W + 40), y: seeded ? rnd(-H * 0.2, H) : rnd(-220, -60),
      s, vy: rnd(16, 34) * (0.6 + s * 4), vx: rnd(-9, 9),
      rot: rnd(0, Math.PI * 2), spin: rnd(-0.5, 0.5),
      sway: rnd(0.35, 0.9), phase: rnd(0, Math.PI * 2),
      alpha: rnd(0.42, 0.82),
    };
  }

  // weightless, rising, gently swaying - a held balloon, not a falling leaf
  function heart(seeded) {
    const s = rnd(0.5, 1.15);
    return {
      kind: "heart",
      x: rnd(-20, W + 20), y: seeded ? rnd(-H * 0.1, H + 40) : rnd(H + 40, H + 140),
      s, vy: -rnd(10, 22) * (0.7 + s * 0.4), vx: 0,
      rot: rnd(-0.2, 0.2), spin: rnd(-0.15, 0.15),
      sway: rnd(0.25, 0.55), phase: rnd(0, Math.PI * 2),
      hue: pick(["#ffb3d1", "#ff8fbd", "#ffd3e6", "#e6c9ff"]),
      alpha: rnd(0.35, 0.75),
    };
  }

  // rises with a wobble that grows near the surface; shrinks as it "pops"
  function bubble(seeded) {
    const s = rnd(0.4, 1.1);
    return {
      kind: "bubble",
      x: rnd(0, W), y: seeded ? rnd(-H * 0.1, H + 40) : rnd(H + 20, H + 120),
      s, vy: -rnd(14, 30) * (0.6 + s * 0.5), vx: 0,
      sway: rnd(0.6, 1.3), phase: rnd(0, Math.PI * 2),
      alpha: rnd(0.28, 0.6),
    };
  }

  const spawners = { garden: petal, space: heart, ocean: bubble };

  function reseed() {
    parts = parts.filter(p => p.kind === "confetti");   // keep any reward fx running
    const spawn = spawners[scene];
    if (!spawn) return;
    for (let i = 0; i < AMBIENT; i++) parts.push(spawn(true));
  }

  /* ----------------------------------------------------------------- step */

  function step(dt, t) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];

      if (p.kind === "confetti") {
        p.y += p.vy * dt; p.x += p.vx * dt;
        p.rot += p.spin * dt;
        p.vy += 220 * dt;
        p.life += dt;
        p.alpha = Math.max(0, 1 - p.life / p.ttl);
        if (p.life >= p.ttl) parts.splice(i, 1);
        continue;
      }

      if (p.kind === "petal") {
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(t * p.sway + p.phase) * 16) * dt;
        p.rot += p.spin * dt;
        if (p.y > H + 120) { parts.splice(i, 1); parts.push(petal(false)); }
        continue;
      }

      if (p.kind === "heart") {
        p.y += p.vy * dt;
        p.x += Math.sin(t * p.sway + p.phase) * 10 * dt;
        p.rot += p.spin * dt;
        if (p.y < -60) { parts.splice(i, 1); parts.push(heart(false)); }
        continue;
      }

      if (p.kind === "bubble") {
        // wobble amplitude grows as it nears the top - reads as "reaching air"
        const rise = clamp01(1 - p.y / H);
        p.y += p.vy * dt;
        p.x += Math.sin(t * p.sway + p.phase) * (6 + rise * 14) * dt;
        if (p.y < -40) { parts.splice(i, 1); parts.push(bubble(false)); }
      }
    }
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ----------------------------------------------------------------- draw */

  function drawHeart(ctx, x, y, size, rot, alpha, hue) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
    ctx.fillStyle = hue;
    ctx.shadowColor = hue; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-11, -5, -11, -13, 0, -8);
    ctx.bezierCurveTo(11, -13, 11, -5, 0, 5);
    ctx.fill();
    ctx.restore();
  }

  function drawBubble(ctx, x, y, size, alpha) {
    const r = size * 9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fill();
    // a small highlight so it reads as glass, not a flat dot
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (p.kind === "petal" || p.kind === "confetti") {
        if (!p.img || !p.img.width) continue;
        const w = p.img.width * p.s, h = p.img.height * p.s;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else if (p.kind === "heart") {
        drawHeart(ctx, p.x, p.y, p.s, p.rot, p.alpha, p.hue);
      } else if (p.kind === "bubble") {
        drawBubble(ctx, p.x, p.y, p.s, p.alpha);
      }
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const nextScene = sceneFor(document.body.dataset.world);
    if (nextScene !== scene) { scene = nextScene; reseed(); }
    if (scene !== "none") step(dt, now / 1000);
    else parts = parts.filter(p => p.kind === "confetti");
    draw();
    raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  /* ------------------------------------------------------------- public */

  // a celebratory shower from a point - real petals, always, regardless of scene
  function confetti(x, y, n) {
    if (calm.matches || !art.length) return;
    n = n || 26;
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rnd(180, 460);
      parts.push({
        kind: "confetti", img: pick(art), x, y,
        s: rnd(0.05, 0.11),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: rnd(0, 6.28), spin: rnd(-5, 5),
        alpha: 1, life: 0, ttl: rnd(1.5, 2.6),
      });
    }
    start();
  }

  function burst(x, y) {
    if (calm.matches || !art.length) return;
    for (let i = 0; i < 7; i++) {
      const a = rnd(0, 6.28), sp = rnd(70, 190);
      parts.push({
        kind: "confetti", img: pick(art), x, y,
        s: rnd(0.03, 0.06),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        rot: rnd(0, 6.28), spin: rnd(-6, 6),
        alpha: .95, life: 0, ttl: rnd(0.7, 1.2),
      });
    }
    start();
  }

  function init() {
    if (calm.matches) { window.Bloom = { confetti() {}, burst() {}, ready: false }; return; }

    cv = document.createElement("canvas");
    cv.id = "petal-layer";
    cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    ctx = cv.getContext("2d");
    fit();

    let pending = SRC.length;
    SRC.forEach(src => {
      fetch(src)
        .then(r => (r.ok ? r.blob() : Promise.reject()))
        .then(createImageBitmap)
        .then(bmp => { art.push(bmp); })
        .catch(() => {})
        .finally(() => {
          if (--pending) return;
          if (!art.length) return;
          scene = sceneFor(document.body.dataset.world);
          reseed();
          start();
        });
    });

    let rt = null;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fit, 250); });
    document.addEventListener("visibilitychange", () =>
      document.visibilityState === "visible" ? start() : stop());

    window.Bloom = { confetti, burst, ready: true };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
