# Buildesk Compass for Android

The Android app is a [Capacitor](https://capacitorjs.com/) 8 shell. It loads the existing TanStack Start / Nitro server over HTTPS. The phone does not ship the SQLite database, server functions, or secrets. Web development is still `npm run dev`.

## Versions

Pinned so the JavaScript in the server bundle matches the native plugins in the APK:

| Package | Version |
| --- | --- |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | 8.6.2 |
| `@capacitor/app` | 8.1.2 |
| `@capacitor/status-bar` | 8.0.4 |
| `@capacitor/keyboard` | 8.0.6 |
| `@capacitor/network` | 8.0.1 |
| `@capacitor/browser` | 8.0.5 |
| `@capacitor/splash-screen` | 8.0.2 |

Capacitor 8 needs Node.js 22 or newer, JDK 21, and Android Studio Otter (2025.2.1) or newer. The Android project targets SDK 36 and minimum SDK 24 (`android/variables.gradle`).

## Prerequisites

1. Node.js 22.x (this repo’s engine). Node 24 can install packages, but production deploys stay on Node 22.
2. JDK 21. Android Studio’s embedded JDK is enough. Set `JAVA_HOME` if `gradlew` cannot find Java.
3. Android Studio Otter 2025.2.1 or newer, with Android SDK 36 and build-tools installed.
4. A device with USB debugging, or an emulator image for API 24 or higher.
5. The Buildesk server from this repo, reachable at an HTTPS origin. For a debug emulator only, HTTP to `10.0.2.2` is allowed behind an explicit flag. Release builds reject it.

Confirm the package id before the first install you keep. It is the placeholder `com.buildesk.compass` in `capacitor.config.ts` and `android/app/build.gradle`. Changing `applicationId` later installs a second app.

## Server URL

The shell does not bake the host into source. The deployed origin is `https://track.cravingcodetech.in` (`VITE_PORTAL_BASE_URL` in `.env.production`). Set that same origin when you sync:

```bash
# .env (gitignored) or the shell environment
CAPACITOR_SERVER_URL=https://track.cravingcodetech.in
```

Use the same origin as `APP_BASE_URL`. On that server set `COOKIE_SECURE=true` only after HTTPS is working.

`npm run android:sync` reads only `CAPACITOR_*` keys from `.env`. It does not print other secrets and it does not put them in the web bundle.

Debug against the Vite server from an emulator:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3000
CAPACITOR_ALLOW_CLEARTEXT=1
npm run android:sync
```

Leave `COOKIE_SECURE` unset for that HTTP origin. A `Secure` cookie is dropped on HTTP, including in the WebView. Do not set `CAPACITOR_ALLOW_CLEARTEXT` for any build you ship. Release sync deletes that flag and refuses an `http://` URL. The release Gradle task also refuses a synced config that is cleartext, non-HTTPS, or missing a URL.

`CAPACITOR_DEBUG_WEBVIEW=1` turns on WebView debugging for that sync only. Release sync turns it off.

## Local run

```bash
npm ci
npm run android:sync
npm run android:open
npm run android:run
```

`android:run` syncs, then installs a debug build. Without `CAPACITOR_SERVER_URL`, the shell shows a setup page and does not pretend to save data.

Web scripts are unchanged: `npm run dev`, `npm run build`, `npm start`.

## Debug and release

| | Debug | Release |
| --- | --- | --- |
| Sync command | `npm run android:sync` | `npm run android:release` (syncs first) |
| Server URL | HTTPS, or loopback HTTP with `CAPACITOR_ALLOW_CLEARTEXT=1` | HTTPS required |
| Cleartext | Loopback hosts only, in `src/debug` network security config | Off. System CAs only. No custom trust-all |
| WebView debugging | Only if `CAPACITOR_DEBUG_WEBVIEW=1` at sync | Forced off |
| Signing | Debug keystore from Android SDK | `android/keystore.properties` (not committed) |
| Cookies | `COOKIE_SECURE` must be off for HTTP | `COOKIE_SECURE=true` on the server |

The URL and the debug flags are fixed at `cap sync`, then copied into `android/app/src/main/assets/capacitor.config.json` (gitignored). Building a release APK from Android Studio after a debug sync can still ship that debug config. Use `npm run android:release` so the sync and the Gradle checks run together.

## Signed APK / AAB

Create the upload key outside the repo. Do not commit the `.jks`, passwords, or `android/keystore.properties`.

`android/keystore.properties.example`:

```
storeFile=C:/path/outside-the-repo/buildesk-compass-release.jks
storePassword=
keyAlias=buildesk-compass
keyPassword=
```

Copy it to `android/keystore.properties` and fill the passwords locally.

```bash
npm run android:release
```

That writes an AAB at `android/app/build/outputs/bundle/release/`. For a sideload APK after the same release sync:

```bash
cd android
.\gradlew.bat assembleRelease
```

The APK committed for download is `public/downloads/trackdesk.apk` (about 4 MB). A push to `main` deploys it with the rest of the site. `scripts/deploy.sh` reads `versionName` and `versionCode` from that file and writes them into `public/native-release.json` before the build. You do not copy the APK onto the server by hand.

Build the new signed APK with a higher `versionName` or `versionCode` in `android/app/build.gradle`, replace `public/downloads/trackdesk.apk`, and push. Installed apps show **Upgrade app** when their reported version is lower. Replacing the file without raising either number updates the download for new people, and phones that already have that same version do not see an upgrade. Android shows its own install confirmation. The app does not replace itself in the background.

Google Play, if you use it, stays on Play’s update path. Do not add an updater that installs an APK silently or skips Play review.

Bump `versionCode` on every store upload and set `versionName` in `android/app/build.gradle` to the version you want devices to report.

## What can ship without a new APK

The shell’s WebView origin is the server. A normal server deploy (`scripts/deploy.sh` or the existing GitHub Action) updates the UI and the API for every installed app the next time it loads.

| Change | New APK / AAB |
| --- | --- |
| React screens, styles, copy, server functions, permissions, bug fixes in the web app | No, after the server deploy |
| `public/native-release.json` text and version gates | No, but a higher `minimumVersion` only helps after a newer native build exists |
| Capacitor or plugin version bump | Yes |
| New plugin, permission, package id, deep-link scheme, network security, signing, `minSdk` / `targetSdk` | Yes |
| App icon, splash, or status-bar color stored in `android/` | Yes |
| `CAPACITOR_SERVER_URL` | Yes, it is copied in at sync |

This is not “every frontend change avoids an APK.” A change that the WebView cannot do, or a plugin mismatch between the server’s JavaScript and the installed native bridge, needs a new binary. Do not fetch and run an unsigned JavaScript bundle from a third host. There is no live-update service in this setup: the server you already trust is the only remote code.

Capacitor’s own types describe `server.url` as a live-reload feature and say it is not intended for production. This repo still uses it, because the app is a server-rendered TanStack Start app and cannot be packaged as a static client without dropping auth, SQLite, and server functions. The tradeoff is that the app needs a reachable server, and a store review may treat a hosted WebView more strictly than a bundled UI. Review the current Play policy before a public listing. This repository does not claim that review has been done.

## Release checklist

1. Server deploy of the web app is healthy on HTTPS, with `COOKIE_SECURE=true`.
2. `CAPACITOR_SERVER_URL` is that origin. `CAPACITOR_ALLOW_CLEARTEXT` and `CAPACITOR_DEBUG_WEBVIEW` are unset.
3. `npm run android:release` completes. Gradle fails the release if the synced config is missing, cleartext, or not HTTPS.
4. Install the build on a device and sign in, leave the app, and return. The session should still be there.
5. Turn the network off. The banner must say changes are not saved. Turn it back on and confirm a real save.
6. Open a company or account, a task or ticket, and the Android back control. Back closes a dialog first, then returns through pages, and asks before leaving from Home.
7. Raise `versionName` or `versionCode`, replace `public/downloads/trackdesk.apk`, and push to `main`. Deploy reads the new version from the APK. Installed older apps then show **Upgrade app**. If older binaries must stop, also set `minimumVersion` in `public/native-release.json` before the push.
8. To roll back a bad web deploy, redeploy the previous server build. Installed apps pick it up on the next load. To roll back a bad native build, distribute the previous signed AAB/APK or halt the Play rollout. The app will not silently replace itself.

`public/native-release.json` is public and has no secrets. The app fetches it with `cache: "no-store"`. If the file is missing, the app does not block.

## Brand

The web tokens in `src/styles.css` are the source of truth:

| Token | Color |
| --- | --- |
| Primary | `#009BFF` |
| Navy (status bar, splash, sidebar) | `#0B1F33` |
| Page background | `#F4F7FB` |
| Foreground | `#0F172A` |

The Android theme uses those colors. Launcher art is generated by `node scripts/generate-android-icons.mjs`.

## Phone workflows

Daily paths use the existing server data:

- Sign-in routes ERP users to `/` and CRM users to `/crm`, using the current `productScope` checks.
- Bottom navigation is Home, Companies or Accounts, Tasks (or the next permitted ERP destination), Tickets or Payments, and More. More opens the existing scoped drawer.
- Dashboards lead with open work, then a few status numbers. The rest of the portfolio counts are behind one control. Recent companies and accounts are cards on a narrow screen.
- Company, account, task, ticket, meeting, and payment screens keep their current permissions. Shared tables already become stacked cards under `md`. Workspace tabs scroll and use a taller target on a phone.
- Wide admin surfaces stay available. A short note explains that the table scrolls sideways. That covers Command Center, reports, automation, master catalogs, CRM usage, broadcasts, win-back, and DPR Tracker. Nothing in those routes is removed.

## Permissions

The manifest asks for `INTERNET`. `@capacitor/network` adds `ACCESS_NETWORK_STATE` so the shell can tell a disconnected radio from “saved offline.” Neither is a runtime permission prompt.

The app does not request camera, location, contacts, microphone, or storage. Uploads use the system document picker that Capacitor’s WebView already provides. Downloads of `http(s)` responses go through Android’s DownloadManager and include the WebView cookie so an authenticated file can finish. Web push inside the WebView is unchanged and may not deliver while the process is stopped. No notification permission was added.

## Session cookies

`buildesk_session` stays an httpOnly cookie (`src/server/auth/session.ts`): `SameSite=Lax`, `Path=/`, 14 days, `Secure` when `COOKIE_SECURE` is true. The WebView origin is the server origin, so the cookie is first-party. It is not copied to `localStorage` or Capacitor Preferences. `CapacitorHttp` is left off so requests keep using the WebView cookie jar.

Logout still calls the server logout. On resume, the shell calls the existing `authMe` check. A dead session returns to sign-in and says unsent changes were not saved. A network error does not log the user out. Backgrounding does not reset a form unless Android kills the process. A killed process drops unsaved input; it was never stored on the device as a draft.

## Deep links

`buildeskcompass://app/companies/123` opens that path on the configured server after the path is checked: one leading slash, no scheme, no `..`, no credentials, and no other host. HTTPS links are accepted only when their origin is the WebView’s current origin. Anything else is refused.

Portal and account links that are normal HTTPS links open in the browser unless you add an Android App Link for your real host. Add that intent filter only for the host you control, and serve `assetlinks.json` from that host. The placeholder package id has to match. Google Calendar sign-in stays in the WebView so the callback can return. Other external links open in the system browser.

## Troubleshooting

**Login cookie does not stick.** The site must be HTTPS with `COOKIE_SECURE=true`, or HTTP debug with `COOKIE_SECURE` off. The URL in the shell and the URL that set the cookie must be the same origin. Do not enable `CapacitorHttp`.

**Network error.** The banner means the server has not accepted new work. The local `capacitor-www/offline.html` page is what Capacitor shows for a WebView load error. Its retry button loads `CAPACITOR_SERVER_URL` only when that value is `https://`. It does not submit forms.

**Back closes the app too soon.** Back should dismiss an open dialog, sheet, or menu first. From `/`, `/crm`, or `/login` it asks before exiting. From any other page it uses WebView history.

**Upload or download.** Use the system picker. A download should appear in the Android Downloads app. If the server URL is HTTP and this is not an allowed debug host, the download is blocked on purpose.

**Deep link does nothing or shows an error toast.** The path failed the check, or the app has no server URL yet. Use `buildeskcompass://app/` plus a path such as `/crm/accounts/...`.

**Plugin error after a web deploy.** The server’s `@capacitor/*` packages moved and the installed APK did not. Ship a new binary, and raise `minimumVersion` if older apps should stop.

**Gradle reports `Unsupported class file major version 69`.** The JDK is newer than Capacitor 8.6.2’s Gradle 8.14.3. Use JDK 21 (`JAVA_HOME` pointed at a 21 install). Android Studio’s bundled runtime may be newer than that.

## Checks that are not a device test

`npm run android:sync` checks that Capacitor can read the config and copy the shell. A release build also needs the Android SDK, a JDK, and a keystore. Signing keys are not in this repo, and a successful config sync is not an emulator or Play-review result.
