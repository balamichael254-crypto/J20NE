# Moonpie - Android wrapper

A thin native shell around the real app (the same one at
`moonpie-wine.vercel.app/miss-you-app/`), built to get the one thing a
website can never do: **actually block screenshots and screen recording**,
via Android's `FLAG_SECURE` window flag. Everything else - the vault, Poo,
push, the whole app - is unchanged, because it's still the same web app,
just loaded inside a native window Android treats differently.

Honest scope: this protects Android only. iOS has no equivalent flag -
Apple has never given any app, native or not, a way to block a screenshot.
See the comment at the top of `App.js` for the full explanation.

## What's actually built

- `App.js` - a full-screen `WebView` pointing at the deployed app, with:
  - `expo-screen-capture`'s `usePreventScreenCapture()` held for as long as
    the screen is mounted - i.e. the entire time the app is open. Android
    refuses to include this window in any screenshot or recording; the
    result is a black frame, not a warning after the fact.
  - Android hardware back button wired to the WebView's own history instead
    of immediately closing the app.
  - `domStorageEnabled` so the vault's derived key, Poo's bond progress, and
    saved widgets persist across app restarts exactly like they do in a
    normal mobile browser tab.
- `app.json` - package id `app.moonpie.wrapper`, the deployed URL (change it
  under `expo.extra.moonpieUrl` if the deployment moves), Android
  permissions for camera/photos (only used if you attach a photo from
  within the web app) and notifications.
- `expo-notifications` is installed and configured as a plugin, ready for a
  later move from Web Push to a real native push token if that's ever
  worth doing - not wired up yet, since the web app's own Web Push
  (`api/push-send.js`) already works inside this WebView without it.

## Running it

This machine's Node (24.x) enables experimental native TypeScript stripping,
which conflicts with how Expo's CLI loads a couple of its own `.ts` files.
Every command below needs it turned off:

```powershell
$env:NODE_OPTIONS = "--no-experimental-strip-types"
```

(set once per terminal session; a machine on Node 18/20 LTS, which is what
Expo actually recommends, won't need this at all)

```powershell
cd mobile
npm install
npx expo-doctor        # sanity check - should read "21/21 checks passed"
npx expo start         # opens Expo Dev Tools; scan the QR with Expo Go
```

Expo Go **cannot** demonstrate the screenshot blocking - `FLAG_SECURE` only
takes effect in a real build of this specific app, not inside the shared Expo
Go container. To actually see it working, build a real APK (below) and
install that.

## Building a real, installable APK

Needs a free Expo account (`npx expo login` will prompt for one) and EAS CLI:

```powershell
npm install -g eas-cli
eas login
eas build:configure          # links this project to your Expo account
eas build --platform android --profile preview
```

That queues a cloud build (a few minutes) and gives you a download link for
a real `.apk` - install it directly on an Android phone (you'll need to
allow "install from unknown sources" once) to see actual screenshot
blocking in effect. `--profile production` instead builds an `.aab` for the
Play Store.

## Verifying the screenshot block once installed

1. Open the app, get to any screen.
2. Try to screenshot it (power+volume, or your launcher's gesture).
3. Android should refuse, or hand back a solid black image - never the
   actual content. Compare against the same screen in a normal browser tab,
   where the screenshot captures completely normally.

## What this does not include yet

- **A floating Poo overlay outside the app.** That needs
  `SYSTEM_ALERT_WINDOW` and a foreground service - real native code, not a
  config-plugin toggle - and is a separate, larger piece of work from this
  wrapper.
- **A production app icon / splash screen.** `assets/*.png` are still Expo's
  scaffold placeholders; swap them for real Moonpie branding before a Play
  Store submission.
- **iOS.** Buildable from the same source (`eas build --platform ios`), but
  gets none of the screenshot protection - see the honesty note up top.
