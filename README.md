# Moonpie

A private mobile-first birthday universe for Michelle.

## Run locally

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/miss-you-app/`. The anniversary passkey is `2502`.

## Shared widgets with Supabase

Every widget is saved on the current phone first. Cross-device sync uses the Vercel function at `api/widgets.js` and a Supabase Postgres table.

1. Create or open the Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once.
3. In **Project Settings > API**, copy the project URL and service-role key.
4. Add these server-side environment variables to the Vercel project for Production, Preview, and Development:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

5. Redeploy the latest commit.

The service-role key is used only inside the Vercel function and must never be added to browser JavaScript or committed to Git. Row Level Security is enabled without public policies, so browser clients cannot read the table directly. The app checks the shared shelf every 15 seconds and whenever it returns to the foreground.

The old GitHub Pages workflow was removed because Pages cannot execute the sync API. Vercel should deploy directly from the connected GitHub repository.

## Verification

```powershell
node --check miss-you-app\content.js
node --check miss-you-app\app.js
npx @playwright/test test tests/app.spec.js --workers=1
```
