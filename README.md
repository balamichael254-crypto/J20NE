# Moonpie

A private mobile-first birthday universe for Michelle.

## Run locally

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/miss-you-app/`. The anniversary passkey is `2504`.

## Shared widgets on Vercel

The web app stores every widget locally first. Cross-device sync uses `api/widgets.js` and an Upstash Redis store attached to the Vercel project.

Set either environment-variable pair in Vercel:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

or:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Redeploy after adding the variables. The app then checks the shared shelf every 15 seconds and whenever it returns to the foreground. GitHub Pages can host the static experience, but it cannot run the sync API; use the Vercel deployment for two-phone widgets.

## Verification

```powershell
node --check miss-you-app\content.js
node --check miss-you-app\app.js
npx @playwright/test test tests/app.spec.js --workers=1
```
