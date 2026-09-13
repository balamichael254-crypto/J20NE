/* ============================================================================
   Our Galaxy - a real particle system, not a looping GIF pretending to be
   one. A slow accretion-disc of drifting light around a warm core, with a
   handful of short words in orbit, and a "make a wish" moment where every
   particle actually flies from wherever it happens to be into the shape of
   real letters - sampled from a real rendered font, not a canned animation.

   Exposes window.MoonpieGalaxy = { mount(canvasEl), unmount() }, matching
   the games' own mount/unmount contract so the screen controller in app.js
   can tear the raf loop down the moment she leaves, the same way it already
   does for the arcade.
   ========================================================================= */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  const ORBIT_WORDS = ["my moon", "my home", "always", "my person", "2502", "still you", "my peace", "forever"];
  const WISH_TEXT = "I LOVE YOU";

  const HUES = ["#ffd9ec", "#ff8fbd", "#f56da8", "#e6c9ff", "#c9a6ff", "#ffe6b3"];

  let canvas, ctx, dpr = 1, W = 0, H = 0, cx = 0, cy = 0;
  let particles = [], words = [];
  let raf = 0, last = 0, mounted = false;
  let mode = "orbit"; // "orbit" | "forming" | "held" | "dissolving"
  let modeStart = 0;
  let onWishDone = null;

  function fit() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
  }

  /* -------------------------------------------------------------- setup */

  function makeParticle(i, total) {
    const depth = rnd(0.35, 1);
    return {
      // orbit description - where it lives when nothing else is happening
      radius: rnd(Math.min(W, H) * 0.14, Math.min(W, H) * 0.46),
      angle: (i / total) * TAU + rnd(-0.3, 0.3),
      speed: rnd(0.05, 0.16) * (Math.random() < 0.5 ? 1 : -1),
      wobble: rnd(4, 14), wobbleFreq: rnd(0.3, 0.8), wobblePhase: rnd(0, TAU),
      size: rnd(1.1, 2.6) * depth,
      hue: HUES[(Math.random() * HUES.length) | 0],
      alpha: rnd(0.35, 0.9) * depth,
      // current drawn position - diverges from the orbit description only
      // while forming/dissolving text, otherwise tracks the orbit exactly
      x: 0, y: 0,
      // finale target, in canvas-center-relative units
      tx: 0, ty: 0,
    };
  }

  function seedParticles() {
    const count = calm.matches ? 40 : 120;
    particles = Array.from({ length: count }, (_, i) => makeParticle(i, count));
  }

  function seedWords() {
    words = ORBIT_WORDS.map((text, i) => ({
      text,
      radius: rnd(Math.min(W, H) * 0.32, Math.min(W, H) * 0.47),
      angle: (i / ORBIT_WORDS.length) * TAU,
      speed: rnd(0.025, 0.05) * (i % 2 === 0 ? 1 : -1),
      alpha: rnd(0.5, 0.8),
    }));
  }

  /* ------------------------------------------------------- text sampling */

  // Renders `text` to a hidden canvas and reads back every pixel with real
  // ink under it - that set of points IS the shape of the letters, so
  // particles flying to them will always spell the word correctly, at any
  // size, in any font that happens to be loaded, no per-letter art needed.
  function sampleTextPoints(text, boxW, boxH, fontPx) {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(boxW));
    off.height = Math.max(1, Math.round(boxH));
    const octx = off.getContext("2d");
    octx.clearRect(0, 0, off.width, off.height);
    octx.fillStyle = "#fff";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.font = `800 ${fontPx}px Baloo, "Baloo 2", sans-serif`;
    octx.fillText(text, off.width / 2, off.height / 2);
    const data = octx.getImageData(0, 0, off.width, off.height).data;
    const cell = Math.max(2, Math.round(fontPx / 16));
    const points = [];
    for (let y = 0; y < off.height; y += cell) {
      for (let x = 0; x < off.width; x += cell) {
        if (data[(y * off.width + x) * 4 + 3] > 120) {
          points.push({ x: x - off.width / 2, y: y - off.height / 2 });
        }
      }
    }
    return points;
  }

  function beginWish() {
    if (mode !== "orbit") return;
    const fontPx = Math.min(W * 0.14, 46);
    let points = sampleTextPoints(WISH_TEXT, W, H * 0.5, fontPx);
    // shuffle so neighbouring particles don't all fly to the same stroke
    for (let i = points.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [points[i], points[j]] = [points[j], points[i]];
    }
    // one particle per sampled point; short on particles, spawn a few more
    // just for this flight rather than crowding several onto one point
    while (particles.length < points.length) particles.push(makeParticle(particles.length, points.length));
    particles.forEach((p, i) => {
      const target = points[i % points.length];
      p.tx = target.x;
      p.ty = target.y;
    });
    mode = "forming";
    modeStart = performance.now();
  }

  /* ----------------------------------------------------------------- step */

  function step(dt, now) {
    const elapsed = now - modeStart;

    if (mode === "orbit") {
      for (const p of particles) {
        p.angle += p.speed * dt;
      }
      for (const w of words) w.angle += w.speed * dt;
    } else if (mode === "forming") {
      const t = clamp01(elapsed / 1100);
      const ease = 1 - Math.pow(1 - t, 3);
      for (const p of particles) {
        const fromX = Math.cos(p.angle) * p.radius, fromY = Math.sin(p.angle) * p.radius;
        p.x = fromX + (p.tx - fromX) * ease;
        p.y = fromY + (p.ty - fromY) * ease;
      }
      if (t >= 1) { mode = "held"; modeStart = now; if (onWishDone) { onWishDone(); onWishDone = null; } }
    } else if (mode === "held") {
      for (const p of particles) { p.x = p.tx; p.y = p.ty; }
      if (elapsed > 2400) { mode = "dissolving"; modeStart = now; }
    } else if (mode === "dissolving") {
      const t = clamp01(elapsed / 900);
      const ease = t * t;
      for (const p of particles) {
        p.angle += p.speed * dt * 2;
        const toX = Math.cos(p.angle) * p.radius, toY = Math.sin(p.angle) * p.radius;
        p.x = p.tx + (toX - p.tx) * ease;
        p.y = p.ty + (toY - p.ty) * ease;
      }
      if (t >= 1) mode = "orbit";
    }
  }

  /* ----------------------------------------------------------------- draw */

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    // deep space ground + a soft warm core glow
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, "#2a1440");
    bg.addColorStop(0.55, "#170a2c");
    bg.addColorStop(1, "#0a0518");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const coreR = Math.min(W, H) * (mode === "orbit" ? 0.1 : 0.06);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.4);
    core.addColorStop(0, "rgba(255,214,235,.95)");
    core.addColorStop(0.35, "rgba(245,109,168,.55)");
    core.addColorStop(1, "rgba(245,109,168,0)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 3.4, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);

    for (const p of particles) {
      let x, y;
      if (mode === "orbit") {
        x = Math.cos(p.angle) * p.radius + Math.sin(now / 1000 * p.wobbleFreq + p.wobblePhase) * p.wobble * 0.2;
        y = Math.sin(p.angle) * p.radius + Math.cos(now / 1000 * p.wobbleFreq + p.wobblePhase) * p.wobble * 0.2;
      } else {
        x = p.x; y = p.y;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.hue;
      ctx.shadowColor = p.hue; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (mode === "orbit") {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.max(11, Math.min(W, H) * 0.032)}px Quicksand, sans-serif`;
      for (const w of words) {
        const x = Math.cos(w.angle) * w.radius, y = Math.sin(w.angle) * w.radius;
        ctx.globalAlpha = w.alpha;
        ctx.fillStyle = "#fff2f8";
        ctx.shadowColor = "rgba(255,180,215,.6)"; ctx.shadowBlur = 6;
        ctx.fillText(w.text, x, y);
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    // this loop only ever runs when reduced-motion is off (see mount()), so
    // there is no "should we animate" branch to make here - always step
    step(dt, now);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- public */

  function mount(container) {
    if (mounted) return;
    mounted = true;
    canvas = document.createElement("canvas");
    canvas.className = "galaxy-canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    ctx = canvas.getContext("2d");
    fit();
    seedParticles();
    seedWords();
    mode = "orbit";

    if (calm.matches) {
      // one still frame - the nebula and orbiting words, no motion
      draw(performance.now());
    } else {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    let rt = null;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { fit(); seedParticles(); seedWords(); }, 200); };
    addEventListener("resize", onResize);
    canvas._onResize = onResize;
  }

  function unmount() {
    if (!mounted) return;
    cancelAnimationFrame(raf);
    raf = 0;
    if (canvas) {
      if (canvas._onResize) removeEventListener("resize", canvas._onResize);
      canvas.remove();
    }
    canvas = ctx = null;
    particles = []; words = [];
    mounted = false;
    mode = "orbit";
  }

  // makeAWish(cb): starts the flight into WISH_TEXT; cb fires the instant
  // the letters finish assembling, so the caller can time a confetti burst
  // to the actual moment the words land rather than guessing a delay.
  function makeAWish(cb) {
    if (!mounted) return;
    if (calm.matches) {
      // no animation loop is running under reduced motion, so the whole
      // flight has to be resolved and painted synchronously in one go
      mode = "forming"; modeStart = performance.now() - 1100;
      step(0, performance.now());
      mode = "held"; modeStart = performance.now();
      draw(performance.now());
      if (cb) cb();
      return;
    }
    onWishDone = cb || null;
    beginWish();
  }

  window.MoonpieGalaxy = { mount, unmount, makeAWish };
})();
