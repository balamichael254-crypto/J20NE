const { test, expect } = require("@playwright/test");

test.use({ channel: "chrome", viewport: { width: 390, height: 844 } });

async function unlock(page) {
  await page.goto("http://127.0.0.1:8765/miss-you-app/?v=32");
  await page.locator("#passkey-input").fill("2504");
  await page.locator("#passkey-form button[type=submit]").click();
  await expect(page.locator("#birthday-opening")).toBeVisible();
  await page.locator("#tap-blow-fallback").evaluate(element => element.classList.remove("hidden"));
  await page.locator("#tap-blow-fallback").click();
  await expect(page.locator("#opening-reveal")).toBeVisible();
  await page.locator("#enter-universe").click();
  await expect(page.locator("#screen-home")).toBeVisible();
}

test("birthday opening and expanded content work on mobile", async ({ page }) => {
  page.on("pageerror", error => console.log(`PAGE ERROR: ${error.message}`));
  await page.route("https://open.spotify.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Spotify embed</title>" }));
  await page.route("https://images.unsplash.com/**", route => route.fulfill({ status: 204, body: "" }));
  await unlock(page);

  await page.locator('[data-open="places"]').first().click();
  await expect(page.locator(".world-portal")).toHaveCount(20);
  await page.locator(".world-portal").first().click();
  await expect(page.locator("#world-modal")).toBeVisible();
  await expect(page.locator(".world-gallery img")).toHaveCount(3);
  await expect(page.locator(".world-moment")).toHaveCount(4);
  await page.locator("#close-world").click();

  await page.locator('[data-open="poems"]').first().evaluate(element => element.click());
  await expect(page.locator(".poem-card")).toHaveCount(12);

  await page.locator('[data-open="letters"]').first().evaluate(element => element.click());
  await expect(page.locator(".letter-card")).toHaveCount(16);

  await page.locator('[data-open="notices"]').first().evaluate(element => element.click());
  await expect(page.locator(".notice-note")).toHaveCount(40);

  await page.locator('[data-open="reasons"]').first().evaluate(element => element.click());
  const seen = new Set();
  for (let index = 0; index < 18; index += 1) {
    seen.add(await page.locator("#reason-text").innerText());
    await page.locator("#new-reason").click();
  }
  expect(seen.size).toBe(18);

  await page.locator('[data-open="songs"]').first().evaluate(element => element.click());
  await expect(page.locator(".spotify-card iframe")).toHaveCount(6);
});
