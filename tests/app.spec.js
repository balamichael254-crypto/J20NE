const { test, expect } = require("@playwright/test");

test.use({ channel: "chrome", viewport: { width: 390, height: 844 } });

async function unlock(page) {
  await page.goto("http://127.0.0.1:8765/miss-you-app/?v=37");
  await page.locator("#passkey-input").fill("2502");
  await page.locator("#passkey-form button[type=submit]").click();
  await expect(page.locator("#birthday-opening")).toBeVisible();
  await page.locator("#tap-blow-fallback").evaluate(element => element.classList.remove("hidden"));
  await page.locator("#tap-blow-fallback").click();
  await expect(page.locator("#opening-reveal")).toBeVisible();
  await page.locator("#enter-universe").click();
  await expect(page.locator("#screen-home")).toBeVisible();
}

test("birthday opening and expanded content work on mobile", async ({ page }) => {
  test.setTimeout(90000);
  page.on("pageerror", error => console.log(`PAGE ERROR: ${error.message}`));
  await page.route("https://open.spotify.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Spotify embed</title>" }));
  await unlock(page);

  await page.locator('[data-open="places"]').first().click();
  await expect(page.locator(".world-portal")).toHaveCount(20);
  await page.locator(".world-portal").first().evaluate(element => element.click());
  await expect(page.locator("#world-modal")).toBeVisible();
  await expect(page.locator(".world-gallery img")).toHaveCount(1);
  await expect(page.locator(".world-moment")).toHaveCount(4);
  await page.locator("#close-world").click();

  await page.locator('[data-open="poems"]').first().evaluate(element => element.click());
  await expect(page.locator(".poem-card")).toHaveCount(12);
  await page.reload();
  await expect(page.locator("#entry-gate")).toHaveCount(0);
  await expect(page.locator("#birthday-opening")).toHaveCount(0);
  await expect(page.locator("#screen-poems")).toBeVisible();

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

test("final personal copy, care room, back navigation, and bubble rush work", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/api/widgets**", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"widgets":[]}' }));
  await page.route("**/api/scores**", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"scores":[]}' }));
  await unlock(page);

  await page.locator('[data-open="notices"]').first().evaluate(element => element.click());
  await expect(page.locator(".notice-note")).toHaveCount(40);
  await expect(page.locator(".notice-note").nth(1)).toContainText("beautiful, cute, sexy, hot");
  await expect(page.locator(".notice-note").nth(12)).toContainText("beautiful mind");
  await expect(page.locator(".notice-note").nth(26)).toContainText("12,756-kilometre-wide world");

  await page.locator('[data-open="letters"]').first().evaluate(element => element.click());
  await expect(page.locator(".letter-card").first()).toContainText("Every Night With You");

  await page.locator('.tab[data-open="care"]').click();
  await page.locator('[data-care-mode="reassurance"]').click();
  await expect(page.locator("#care-response")).toContainText("You are still my girl");

  await page.locator('[data-open="games"]').first().evaluate(element => element.click());
  await page.locator("#start-bubbles").click();
  await expect(page.locator(".love-bubble").first()).toBeVisible();
  await expect(page.locator("#start-bubbles")).toBeDisabled();
  await page.locator("#back-button").evaluate(element => element.click());
  await expect(page.locator("#screen-care")).toBeVisible();
});
