# Moonpie

A private mobile-first birthday universe for Michelle.

## Run locally

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/miss-you-app/`. The anniversary passkey is `2502`.

## Shared widgets, and Our Eyes Only / Collective Memories, with Supabase

Every widget is saved on the current phone first. Cross-device sync uses the Vercel function at `api/widgets.js` and a Supabase Postgres table. The private photo vault (`api/vault.js`, table `moonpie_vault_items`) uses the same project - photos are AES-GCM encrypted in the browser before upload, so the table only ever holds ciphertext.

1. Create or open the Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once (it creates both tables).
3. In **Project Settings > API**, copy the project URL and service-role key.
4. Add these server-side environment variables to the Vercel project for Production, Preview, and Development:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

5. Redeploy the latest commit.

The service-role key is used only inside the Vercel functions and must never be added to browser JavaScript or committed to Git. Row Level Security is enabled without public policies, so browser clients cannot read either table directly. The app checks the shared widget shelf every 15 seconds and whenever it returns to the foreground.

## Real nudges (Web Push)

The care screen ("what does your heart need?") sends an actual push to the
other phone when she taps a feeling. This needs a VAPID key pair on top of the
Supabase variables above:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT      (e.g. mailto:you@example.com)
```

Generate a pair with `npx web-push generate-vapid-keys`. The **public** key also
has to be pasted into `miss-you-app/push.js` (`VAPID_PUBLIC_KEY`) - it
identifies the sender and is not a secret. The **private** key is a secret and
belongs only in the Vercel environment.

Each phone registers itself by tapping **allow nudges** once (Widget Studio →
"keep it close"). Until both phones have done that, `api/push-send.js` answers
honestly with "that person hasn't turned nudges on yet" rather than pretending
the nudge was delivered.

**Our Eyes Only** is a one-way send, not a shared gallery: a photo addressed to a name is only ever returned to a request for that name, so the sender's own inbox never shows what they just sent. **Collective Memories** is the opposite shape - both profiles add to and see one shared collection. Both share one passphrase-derived encryption key; the one-way/shared split is enforced by what the app requests from the server, not by separate per-person keys - see the comment at the top of `miss-you-app/vault.js` for the exact guarantee this does and does not make.

The old GitHub Pages workflow was removed because Pages cannot execute the sync API. Vercel should deploy directly from the connected GitHub repository.

## Verification

```powershell
node --check miss-you-app\content.js
node --check miss-you-app\app.js
npx @playwright/test test tests/app.spec.js --workers=1
```
