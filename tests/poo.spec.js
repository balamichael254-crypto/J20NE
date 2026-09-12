/*
 * Regression tests for Poo v4.
 *
 * Each test here maps to something that was actually broken in v3 and reported
 * as "she's always glitching / it's not even the same doll / the controls don't
 * work". They are written to fail loudly if any of it comes back.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://127.0.0.1:8765/miss-you-app/";

// system Chrome, so the suite runs without downloading a Playwright browser
test.use({ channel: "chrome", viewport: { width: 390, height: 844 } });

async function enter(page) {
  await page.goto(BASE);
  await page.locator("#passkey-input").fill("2502");
  await page.locator("#passkey-form button[type=submit]").click();
  await expect(page.locator("#birthday-opening")).toBeVisible();
  await page.locator("#unwrap-bouquet").click();
  await expect(page.locator("#opening-reveal")).toBeVisible();
  await page.locator("#enter-universe").click();
  await expect(page.locator("#screen-home")).toBeVisible();
  await page.waitForFunction(() => window.Poo && window.Poo.isReady());
}

/* Samples the bounding box of non-transparent pixels on a canvas. Returns null
   when nothing is drawn at all.
   Passed as a real function, not a string - Playwright evaluates a string
   pageFunction as a bare expression and never hands it the argument. */
const bbox = sel => {
  const c = document.querySelector(sel);
  if (!c || !c.width) return null;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let top = c.height, bot = -1, left = c.width, right = -1, n = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 16) {
        n++;
        if (y < top) top = y;
        if (y > bot) bot = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return n ? { top, bot, left, right, n, w: c.width, h: c.height } : null;
};

test("she renders, and only ever from the one consistent rig", async ({ page }) => {
  const requested = [];
  page.on("request", r => {
    const u = r.url();
    if (u.includes("/assets/poo/")) requested.push(u.split("/assets/poo/")[1]);
  });

  await enter(page);
  await page.waitForTimeout(700);

  const box = await page.evaluate(bbox, ".poo-canvas");
  expect(box, "Poo should be painting pixels").not.toBeNull();
  expect(box.n).toBeGreaterThan(1000);

  // v3's bug was mixing in a second, visibly different character from extra/.
  // Nothing outside rig/ may ever be fetched again.
  const strays = requested.filter(p => !p.startsWith("rig/"));
  expect(strays, `non-rig Poo art was requested: ${strays.join(", ")}`).toHaveLength(0);
  expect(requested.length).toBeGreaterThan(0);
});

test("she never escapes her canvas, through any reaction", async ({ page }) => {
  await enter(page);
  await page.evaluate(() => window.Poo.open());
  await page.waitForTimeout(600);

  const acts = ["pet", "tickle", "dance", "lily", "love", "boop", "catch", "sleepy"];
  let worstTop = Infinity, worstBot = -Infinity, frames = 0;

  for (const act of acts) {
    await page.evaluate(a => window.Poo.react(a), act);
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(40);
      const b = await page.evaluate(bbox, ".poo-room-canvas");
      if (!b) continue;
      frames++;
      worstTop = Math.min(worstTop, b.top);
      worstBot = Math.max(worstBot, b.bot);
      // the actual assertion: she is never touching either edge
      expect(b.top, `clipped at top during "${act}"`).toBeGreaterThan(0);
      expect(b.bot, `clipped at bottom during "${act}"`).toBeLessThan(b.h - 1);
    }
  }
  expect(frames, "no frames were sampled").toBeGreaterThan(50);
  console.log(`  headroom across ${frames} frames - top:${worstTop}px bottom:${worstBot}px`);
});

test("a tap beside her falls through to the app; a tap on her does not", async ({ page }) => {
  await enter(page);
  await page.waitForTimeout(500);

  const before = await page.evaluate(() => window.Poo.bond());

  // Corner of her bounding box - transparent, so the app underneath must get it
  // and Poo must ignore it. This is what v3 got wrong by laying a 300px
  // pointer-capturing box over the whole UI.
  const rect = await page.locator(".poo-roam").boundingBox();
  await page.mouse.click(rect.x + 4, rect.y + 4);
  await page.waitForTimeout(250);
  const afterCorner = await page.evaluate(() => window.Poo.bond());
  expect(afterCorner, "a tap on empty pixels must not reach Poo").toBe(before);

  // Her actual body must still respond.
  const r2 = await page.locator(".poo-roam").boundingBox();
  await page.mouse.click(r2.x + r2.width / 2, r2.y + r2.height * 0.62);
  await page.waitForTimeout(300);
  const afterBody = await page.evaluate(() => window.Poo.bond());
  expect(afterBody, "a tap on her body must reach Poo").toBeGreaterThan(before);
});

test("every room control works and deepens the bond", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));

  await enter(page);
  await page.evaluate(() => window.Poo.open());
  await expect(page.locator(".poo-room")).toHaveClass(/show/);

  const acts = await page.locator(".poo-room-acts [data-act]").all();
  expect(acts.length).toBe(6);

  let bond = await page.evaluate(() => window.Poo.bond());
  for (const btn of acts) {
    await btn.click();
    await page.waitForTimeout(160);
    const next = await page.evaluate(() => window.Poo.bond());
    expect(next, `"${await btn.getAttribute("data-act")}" did not register`).toBeGreaterThan(bond);
    bond = next;
    // she should be saying something about it
    await expect(page.locator(".poo-room-line")).not.toBeEmpty();
  }

  // the meter must actually reflect progress
  const fill = await page.locator(".poo-room-bond i").evaluate(el => el.style.width);
  expect(fill).toMatch(/\d+%/);

  await page.locator(".poo-room-close").click();
  await expect(page.locator(".poo-room")).not.toHaveClass(/show/);
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("the art payload stays small enough for a phone", async ({ page }) => {
  let bytes = 0;
  page.on("response", async r => {
    if (!r.url().includes("/assets/poo/")) return;
    const len = Number(r.headers()["content-length"] || 0);
    bytes += len;
  });
  await enter(page);
  await page.waitForTimeout(2500);   // let the non-neutral poses stream in

  const mb = bytes / 1024 / 1024;
  console.log(`  Poo art transferred: ${mb.toFixed(2)} MB`);
  // v3 shipped 8.9MB of sprites and stuttered the whole app doing it
  expect(mb, "Poo art has grown back past its budget").toBeLessThan(1.5);
});
