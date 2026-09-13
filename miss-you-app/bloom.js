/*
 * Bloom - the ambient particle layer.
 *
 * Not one drifting-petal effect recolored for every screen - three different
 * PLACES with their own physics, switched by the room the app is in
 * (document.body.dataset.world):
 *
 *   garden (the default)  - a jar of things suspended in liquid: lily
 *                            petals, red hearts, pink hearts and pinwheel
 *                            lollipops, each drifting on its own slow current
 *                            with a gentle multi-frequency wobble and a soft
 *                            bob, the way things actually hang in a snow
 *                            globe rather than falling straight down. Not a
 *                            single kind of thing repeated - a jarful of
 *                            different small treats.
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
  const AMBIENT_COUNT = { garden: 16, space: AMBIENT, ocean: AMBIENT }; // garden carries 4 kinds now, so it earns more
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

  // A jar of small things suspended in liquid, not a shower of one thing.
  // Weighted so lilies still lead (this is the Love Garden), with hearts and
  // lollipops mixed through - "etc." left room to add more kinds later by
  // just adding another entry here.
  const GARDEN_KINDS = [
    { sub: "lily", weight: 4 },
    { sub: "heartRed", weight: 2 },
    { sub: "heartPink", weight: 2 },
    { sub: "lollipop", weight: 2 },
  ];
  const GARDEN_TOTAL_WEIGHT = GARDEN_KINDS.reduce((sum, k) => sum + k.weight, 0);
  function pickGardenKind() {
    let roll = Math.random() * GARDEN_TOTAL_WEIGHT;
    for (const k of GARDEN_KINDS) {
      if (roll < k.weight) return k.sub;
      roll -= k.weight;
    }
    return "lily";
  }

  const LOLLIPOP_HUES = [
    { base: "#ff5d7d", stripe: "#fff2f6" },
    { base: "#ff8fbd", stripe: "#ffffff" },
    { base: "#e8384f", stripe: "#ffe3e9" },
  ];
  const HEART_RED_HUES = ["#e8384f", "#ff5d7d", "#c9142f"];
  const HEART_PINK_HUES = ["#ffb3d1", "#ff8fbd", "#ffd3e6", "#e6c9ff"];

  // Suspended in liquid: a slowly wandering anchor point (a gentle current,
  // not gravity) plus two out-of-sync sine wobbles and a separate slower bob,
  // so nothing moves in a straight line or a single clean period - it reads
  // as fluid, not mechanical.
  function gardenFloat(seeded, forceSub) {
    const sub = forceSub || pickGardenKind();
    const s = sub === "lily" ? rnd(0.05, 0.115) : rnd(0.55, 1.05);
    const p = {
      kind: "float", sub,
      img: sub === "lily" ? pick(art) : null,
      baseX: rnd(-60, W + 60), baseY: seeded ? rnd(-60, H + 60) : rnd(-60, H + 60),
      driftAngle: rnd(0, Math.PI * 2), driftSpeed: rnd(3, 9), driftTurn: rnd(-0.12, 0.12),
      ampX: rnd(14, 34), freqX: rnd(0.12, 0.3), phaseX: rnd(0, Math.PI * 2),
      ampY: rnd(10, 26), freqY: rnd(0.1, 0.26), phaseY: rnd(0, Math.PI * 2),
      bobAmp: rnd(6, 14), bobFreq: rnd(0.2, 0.4), bobPhase: rnd(0, Math.PI * 2),
      s, rot: rnd(0, Math.PI * 2), spin: rnd(-0.3, 0.3),
      alpha: sub === "lily" ? rnd(0.5, 0.88) : rnd(0.55, 0.85),
      hue: sub === "heartRed" ? pick(HEART_RED_HUES)
         : sub === "heartPink" ? pick(HEART_PINK_HUES)
         : sub === "lollipop" ? pick(LOLLIPOP_HUES)
         : null,
    };
    return p;
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

  const spawners = { garden: gardenFloat, space: heart, ocean: bubble };

  function reseed() {
    parts = parts.filter(p => p.kind === "confetti");   // keep any reward fx running
    const spawn = spawners[scene];
    if (!spawn) return;
    const count = AMBIENT_COUNT[scene] || AMBIENT;
    for (let i = 0; i < count; i++) parts.push(spawn(true));
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

      if (p.kind === "float") {
        // the anchor drifts on a slow, gently curving current...
        p.driftAngle += p.driftTurn * dt;
        p.baseX += Math.cos(p.driftAngle) * p.driftSpeed * dt;
        p.baseY += Math.sin(p.driftAngle) * p.driftSpeed * dt;
        // ...wrapped like a toroidal jar, so nothing is ever "spawned" or
        // "despawned" - it just drifts back in from the opposite edge
        const margin = 70;
        if (p.baseX < -margin) p.baseX = W + margin;
        else if (p.baseX > W + margin) p.baseX = -margin;
        if (p.baseY < -margin) p.baseY = H + margin;
        else if (p.baseY > H + margin) p.baseY = -margin;
        // ...while two out-of-phase wobbles plus a slower bob ride on top,
        // which is what makes it read as suspended in liquid rather than on
        // a conveyor belt
        p.x = p.baseX + Math.sin(t * p.freqX + p.phaseX) * p.ampX;
        p.y = p.baseY + Math.sin(t * p.freqY + p.phaseY) * p.ampY + Math.sin(t * p.bobFreq + p.bobPhase) * p.bobAmp;
        p.rot += p.spin * dt;
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

  // A pinwheel candy - two-tone wedges rather than a true logarithmic spiral,
  // which is cheap to draw and still reads unmistakably as a lollipop at the
  // small sizes these float at.
  function drawLollipop(ctx, x, y, size, rot, alpha, hue) {
    const r = size * 10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    // the stick, behind the candy
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillRect(-size * 0.9, r * 0.2, size * 1.8, r * 1.7);
    // the candy disc
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = hue.base;
    ctx.shadowColor = hue.base;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    // alternating wedges on top, clipped to the disc, for the swirl
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    const wedges = 8;
    for (let i = 0; i < wedges; i++) {
      if (i % 2 !== 0) continue;
      const a0 = (i / wedges) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a0 + (Math.PI * 2) / wedges);
      ctx.closePath();
      ctx.fillStyle = hue.stripe;
      ctx.fill();
    }
    ctx.restore();
    // a small glassy highlight, same trick as the bubbles
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.4)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (p.kind === "petal" || p.kind === "confetti" || (p.kind === "float" && p.sub === "lily")) {
        if (!p.img || !p.img.width) continue;
        const w = p.img.width * p.s, h = p.img.height * p.s;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else if (p.kind === "heart" || (p.kind === "float" && (p.sub === "heartRed" || p.sub === "heartPink"))) {
        drawHeart(ctx, p.x, p.y, p.s, p.rot, p.alpha, p.hue);
      } else if (p.kind === "bubble") {
        drawBubble(ctx, p.x, p.y, p.s, p.alpha);
      } else if (p.kind === "float" && p.sub === "lollipop") {
        drawLollipop(ctx, p.x, p.y, p.s, p.rot, p.alpha, p.hue);
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
