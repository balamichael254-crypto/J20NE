/*
 * Our Eyes Only + Collective Memories - regression tests.
 *
 * The vault now talks to /api/vault instead of local IndexedDB, so these
 * tests run an in-memory fake of that endpoint via page.route - a real
 * Supabase-backed deployment behaves identically from the client's point of
 * view, since api/vault.js's contract is exactly what's faked here.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://127.0.0.1:8765/miss-you-app/";
const PASS = "lilies and a purple bunny";
const PIN = "2502";

// serviceWorkers:'block' matters here specifically: the app's own SW
// (miss-you-app/sw.js) intercepts every fetch, including /api/vault, at a
// layer page.route can't see - with the SW running, the mocked route below
// never fires and the request falls through to the real (404) endpoint.
test.use({ channel: "chrome", viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

/* A tiny in-memory stand-in for api/vault.js, keyed exactly like the real
   table: room is irrelevant here (one fake per test), rows carry to/from. */
async function fakeVaultApi(page) {
  const rows = [];
  await page.route("**/api/vault**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const to = url.searchParams.get("to");
      const items = rows.filter(r => r.to === to);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
    }
    if (req.method() === "POST") {
      const { item } = req.postDataJSON();
      rows.push(item);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: item.id }) });
    }
    if (req.method() === "DELETE") {
      const { id, to } = req.postDataJSON();
      const i = rows.findIndex(r => r.id === id && r.to === to);
      if (i >= 0) rows.splice(i, 1);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: id }) });
    }
    return route.continue();
  });
  return rows;
}

async function enterVault(page, profile) {
  await page.goto(BASE);
  await page.locator("#passkey-input").fill("2502");
  if (profile) await page.locator(`.profile-option[data-profile="${profile}"]`).click();
  await page.locator("#passkey-form button[type=submit]").click();
  await page.locator("#unwrap-bouquet").click();
  await expect(page.locator("#opening-reveal")).toBeVisible();
  await page.locator("#enter-universe").click();
  await page.locator('.tab[data-open="care"]').click();
  await expect(page.locator("#screen-care")).toBeVisible();
  await page.locator('[data-open="vault"]').click();
  await expect(page.locator("#screen-vault")).toBeVisible();
}

async function setUp(page) {
  await page.locator("#vault-pass").fill(PASS);
  await page.locator("#vault-new-pin").fill(PIN);
  await page.locator("#vault-setup-form button[type=submit]").click();
  await expect(page.locator('[data-phase="open"]')).toBeVisible({ timeout: 20000 });
}

async function addPhotoTo(page, inputId) {
  await page.evaluate(async id => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#e0578c"; x.fillRect(0, 0, 64, 64);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "t.png", { type: "image/png" }));
    const input = document.getElementById(id);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, inputId);
}

test("sending to the other person never shows up in your own inbox", async ({ page }) => {
  const rows = await fakeVaultApi(page);
  await enterVault(page, "Michelle");
  await setUp(page);

  expect(await page.locator("#vault-send-label").innerText()).toContain("Sunstone");

  await addPhotoTo(page, "vault-send-file");
  await page.waitForTimeout(400);

  expect(rows.length, "the send should have reached the server").toBe(1);
  expect(rows[0].to).toBe("Michael");
  expect(rows[0].from).toBe("Michelle");

  // Michelle's own inbox (to=Michelle) must stay empty - she sent it, she
  // doesn't get to see it again.
  await page.locator("#vault-inbox-grid button").count(); // let it settle
  await expect(page.locator("#vault-inbox-grid")).toContainText("Nothing waiting yet");
});

test("what one person sends, the other actually receives", async ({ page, browser }) => {
  test.setTimeout(60000);   // two PBKDF2-600k unlocks (one per "phone") in one test
  const rows = await fakeVaultApi(page);
  await enterVault(page, "Michael");
  await setUp(page);
  await addPhotoTo(page, "vault-send-file");
  await page.waitForTimeout(400);
  expect(rows[0].to).toBe("Michelle");

  // a second, fully isolated browser context - a second page in the SAME
  // context shares localStorage/origin state, which would make it look like
  // the same "phone" already past the gate. A real second device needs a
  // real second context.
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page2 = await context2.newPage();
  await fakeVaultApiSharingRows(page2, rows);
  await enterVault(page2, "Michelle");
  await setUp(page2);
  await expect(page2.locator("#vault-inbox-grid .vault-open")).toHaveCount(1);
  await expect(page2.locator("#vault-inbox-grid")).toContainText("from Sunstone");
  await context2.close();
});

async function fakeVaultApiSharingRows(page, rows) {
  await page.route("**/api/vault**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const to = url.searchParams.get("to");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: rows.filter(r => r.to === to) }) });
    }
    if (req.method() === "POST") {
      rows.push(req.postDataJSON().item);
      return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test("collective memories are shared regardless of who added them", async ({ page }) => {
  const rows = await fakeVaultApi(page);
  await enterVault(page, "Michelle");
  await setUp(page);

  await addPhotoTo(page, "memories-file");
  await page.waitForTimeout(400);
  expect(rows.find(r => r.to === "shared")).toBeTruthy();

  await expect(page.locator("#memories-grid .vault-open")).toHaveCount(1);
  await expect(page.locator("#memories-grid")).toContainText("Moonpie added this");
});

test("a wrong PIN is refused; the right one opens both features", async ({ page }) => {
  await fakeVaultApi(page);
  await enterVault(page, "Michelle");
  await setUp(page);

  await page.locator("#vault-lock-now").click();
  await expect(page.locator('[data-phase="locked"]')).toBeVisible();
  expect(await page.evaluate(() => window.Vault.isOpen())).toBe(false);

  await page.locator("#vault-pin").fill("9999");
  await page.locator("#vault-unlock-form button[type=submit]").click();
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-phase="locked"]')).toBeVisible();

  await page.locator("#vault-pin").fill(PIN);
  await page.locator("#vault-unlock-form button[type=submit]").click();
  await expect(page.locator('[data-phase="open"]')).toBeVisible({ timeout: 20000 });
});

test("a received photo is only painted while held, and never enters the DOM", async ({ page }) => {
  const rows = await fakeVaultApi(page);
  await enterVault(page, "Michael");
  await setUp(page);
  await addPhotoTo(page, "vault-send-file");   // Michael -> Michelle
  await page.waitForTimeout(400);

  // switch identity in-place to view as the recipient, same passphrase/PIN
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("moonpie-miss-you-v9") || "{}");
    s.profile = "Michelle";
    localStorage.setItem("moonpie-miss-you-v9", JSON.stringify(s));
  });
  await page.reload();
  await page.locator('.tab[data-open="care"]').click();
  await page.locator('[data-open="vault"]').click();
  await page.locator("#vault-pin").fill(PIN);
  await page.locator("#vault-unlock-form button[type=submit]").click();
  await expect(page.locator('[data-phase="open"]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator("#vault-inbox-grid .vault-open")).toHaveCount(1);

  await page.locator("#vault-inbox-grid .vault-open").first().click();
  await expect(page.locator("#vault-viewer")).toBeVisible();
  await page.waitForTimeout(500);

  const pink = () => page.evaluate(() => {
    const c = document.getElementById("vault-canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 130 && d[i + 2] > 120) n++;
    return n;
  });
  expect(await pink()).toBe(0);
  await page.evaluate(() => document.getElementById("vault-canvas")
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(300);
  expect(await pink()).toBeGreaterThan(1000);

  const leaks = await page.evaluate(() => {
    const viewer = document.getElementById("vault-viewer");
    return { imgs: viewer.querySelectorAll("img").length, blobUrls: (viewer.innerHTML.match(/blob:|data:image/g) || []).length };
  });
  expect(leaks.imgs).toBe(0);
  expect(leaks.blobUrls).toBe(0);
});

test("switching away from the app locks it", async ({ page }) => {
  await fakeVaultApi(page);
  await enterVault(page, "Michelle");
  await setUp(page);
  expect(await page.evaluate(() => window.Vault.isOpen())).toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => window.Vault.isOpen())).toBe(false);
  await expect(page.locator('[data-phase="locked"]')).toBeVisible();
});
