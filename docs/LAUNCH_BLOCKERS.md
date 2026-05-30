# Launch Blockers

Ordered punch list, dependencies respected. Tick top to bottom. Source of truth for "what's left before launch".

## Pre-prebuild (can run in parallel)

- [x] **Paid Apps agreement** accepted (2026-05-22).
- [x] **Tax form (W-9)** for ThriftVault LLC active (2026-05-22).
- [x] **Banking info** active (2026-05-23). LLC business account linked in App Store Connect → Agreements, Tax, and Banking.
- [x] **Register bundle ID in Apple Developer** (2026-05-22). `com.thriftvault.app` with In-App Purchase + Data Protection (defaults).
- [x] **Create app in App Store Connect** (2026-05-22). Name: "ThriftVault: Scan to Flip". Company Name: "ThriftVault LLC". SKU: `thriftvault-ios-1`. ascAppId: `6772308542`.
- [x] **Fill `eas.json:20-22`** with `ascAppId: 6772308542` + `appleTeamId: UG3X275FNX` (2026-05-22).
- [x] **Re-export app icon** (2026-05-22). `assets/logo/thriftvault_logo.png` is 1024×1024, 8-bit colormap (no alpha). All 4 paths in `app.json` repointed.

## Async / parallel (kick off now)

- [x] **Create sandbox tester Apple ID** (2026-05-26). `chrisluhrsdesign+sandbox@gmail.com` registered in App Store Connect → Users and Access → Sandbox. Used by the on-device purchase test in Post-prebuild.

## After Paid Apps + Tax + Banking are live

- [x] **Create 3 subscription products** (2026-05-26). Subscription Group "ThriftVault Pro" (id `22114945`) holds 3 auto-renewable subs: `monthly` ($4.99/1mo, 30-day free trial), `three_month` ($9.99/3mo, no trial), `annual` ($29.99/1yr, no trial). Apple burns deleted Product IDs permanently — original `yearly` ID was used during a delete-and-recreate, so ASC product ID for annual is `annual` while the RC package identifier remains `yearly`. RC↔ASC mapping resolves this asymmetry (see `project_rc_asc_product_id_mapping` memory).
- [x] **RevenueCat dashboard setup** (2026-05-26). Project "ThriftVault" created via onboarding wizard; entitlement `pro`, offering `default` with 3 packages (`monthly` / `three_month` / `yearly`). Test key in .env (production `appl_` key swap deferred to pre-production-build per `project_rc_test_key_swap` memory).
- [x] **Code wire-up** (2026-05-26). `react-native-purchases` installed via `npx expo install` (auto-linked; no `app.json` plugin needed); `EXPO_PUBLIC_REVENUECAT_API_KEY=test_...` in `.env`. **Expo Go workflow now ends**; next start requires dev client.

## Irreversible step (Expo Go → dev client)

- [x] **First EAS dev client build** (2026-05-27). Installed eas-cli, registered iPhone 13 UDID via `eas device:create`, generated Apple distribution cert + provisioning profile, built via `eas build --profile development --platform ios` (first attempt failed on Sentry source-map upload, fixed by adding `SENTRY_DISABLE_AUTO_UPLOAD=true` to `eas.json:development.env`; second attempt succeeded). Installed dev client via QR, trusted cert in VPN & Device Management, enabled iOS Developer Mode (required for sideloaded apps on iOS 16+), connected to Metro on port 8082 (8081 was stale). Also fixed schema warning: moved `ios.minimumOsVersion` from `app.json:ios` to `expo-build-properties.ios.deploymentTarget` (current Expo schema doesn't accept the top-level `minimumOsVersion` field).

You're on Windows, so no local Xcode or Mac is required. **EAS Build** runs on Apple's cloud Macs, generates the native iOS project on the build machine, signs it with your Apple Developer credentials, and gives you a QR code to install on iPhone. You will not run `npx expo prebuild` locally.

> **First time reading this?** See `DEV_OPS.md` → "Mental model for the dev-client switch" for a plain-language walkthrough of what the dev client is, how it differs from Expo Go, and the day-to-day rebuild rules. The setup steps below assume you've read it.

### Dev client setup (one time, Windows + EAS)

Prereqs: Apple Developer Org enrollment active (done 2026-05-21), iPhone 13 in hand, Expo account at expo.dev.

1. `npm install -g eas-cli`
2. `eas login` (Expo account credentials)
3. `eas device:create`. Registers iPhone 13's UDID with Apple Developer. CLI prints a URL + QR, open on iPhone in Safari, install the provisioning profile when iOS prompts. EAS adds the device to your Apple Developer team automatically.
4. `eas build --profile development --platform ios`. First run: CLI prompts for Apple ID credentials and handles cert + provisioning profile generation in the background. Cloud build takes ~15-30 min on free tier (longer queue), ~10 min on Production plan ($19/mo).
5. When the build finishes, EAS prints a URL + QR. Open the URL on iPhone in Safari and tap Install.
6. iOS → Settings → General → VPN & Device Management → trust the developer certificate. One-time per cert.
7. Open the ThriftVault dev client on your phone. It shows a "connect to a development server" screen, ready to pair with Metro.

### Daily dev loop after setup

- **JS-only changes** (most edits): `npx expo start --dev-client` from your Windows terminal. The phone's dev client auto-connects on the same Wi-Fi. Fast Refresh works exactly like Expo Go.
- **Native changes** (new native dep, `app.json` plugin edits, icon swap): rerun `eas build --profile development --platform ios`, reinstall via the new QR.
- **EAS Build quota**: free tier covers low-volume solo dev (one cloud build counts even if cancelled). If queues get painful, Production plan is $19/mo for priority + more builds.

## Post-prebuild

- [x] **Run sandbox purchase test** (2026-05-27). Swapped `.env` from `test_` to `appl_` RC key, then hit a chain of config gaps: (1) RC's App Store storefront had zero products (only Test Store had them) — fixed by uploading the App Store Connect API Key (`AuthKey_*.p8`) at the app-config scope so RC could import; (2) ASC products imported with status `READY_TO_SUBMIT` (fine for sandbox); (3) Wired App-Specific Shared Secret + Apple Server-to-Server Notification URL (`https://api.revenuecat.com/v1/incoming-webhooks/app_store`) into ASC App Info; (4) Attached `pro` entitlement (actual identifier turned out to be `ThriftVault Pro` with space + capitals — code was checking lowercase `pro`, swapped the constant in `hooks/usePurchases.ts`) to all 3 App Store products + wired each package in the `default` offering to its App Store product alongside the Test Store one. After all that: real StoreKit sandbox purchase flow worked, receipt POST returned 200, Pro UI flipped correctly. **Pattern lessons: (1)** RC's onboarding wizard creates Test Store products that are NOT auto-mirrored to the App Store storefront — products + entitlements + offering-package wiring must be redone for the App Store side, twice the work. **(2)** RC entitlement identifier is locked at creation and uses whatever you typed in the wizard (e.g. "ThriftVault Pro" not "pro"); document the exact string somewhere because every `info.entitlements.active['<key>']` check depends on it. **(3)** Apple's sandbox compresses 30-day trials to ~3 minutes; the trial-display state is hard to test in sandbox because it converts to paid before you can verify the UI. Trust the code path (`periodType === 'TRIAL'`) and skip the sandbox verify.

  Additional Pro-state UI shipped during this step (uncommitted): `hooks/usePurchases.ts` now uses module-scoped state (single RC config, single listener, all consumers share entitlement snapshot — previously each `usePurchases()` callsite had its own `useState` so post-purchase state only updated locally); full entitlement snapshot cached in `AsyncStorage` (`tv_is_pro` key, full JSON not just boolean) so Profile renders the complete Pro card on launch without a flicker through intermediate states; Profile Pro card shows plan + price + renew/trial/cancel state via `formatProSubtitle()`, Manage Subscription deep-links to `https://apps.apple.com/account/subscriptions`; Settings rows filter `subscription` row out when Pro and `manage` row out when not Pro; PaywallModal "Welcome to Pro" toast gated on `!result.alreadyActive` so it doesn't fire when re-tapping a plan you already own.
- [x] **Screenshots** for App Store listing (2026-05-29). All 5 generated via `ParthJadhav/app-store-screenshots` skill in `thriftvault-screenshots/` sibling folder, uploaded to ASC → iOS App 1.0 → App Previews and Screenshots → 6.9" iPhone Display slot (ASC auto-fills 6.5" / 6.7" / 6.3" / 6.1" from the 6.9" set).
- [x] **ASC metadata entered** (2026-05-29). Subtitle `Scan, flip, profit` (18 chars, was "Track flips, scan items, profit" 31 chars failing the 30-cap, swap mirrors the user journey and lets the app name carry the tracking implication). Description verbatim from `STORE_LISTING.md`. Keywords 89 chars (`thrift,resell,reseller,flip,haul,poshmark,depop,ebay,inventory,tracker,profit,goodwill,scan`). Promo Text 165 chars (updatable without re-review). Support URL `https://thriftvaultapp.com/#contact`, Marketing URL `https://thriftvaultapp.com`. Version `1.0.0`, Copyright `2026 ThriftVault LLC` (no © symbol, ASC adds it). Routing App Coverage File blank (nav apps only). Content Rights = No (user photos + AI-generated text + nominative-fair-use brand names are NOT third-party content). Age Rating questionnaire all None across all 7 steps → 4+. Pricing & Availability US + Canada (Canada: zero added compliance, ~10% TAM bump, no French required because Quebec Bill 96 only triggers if you actively market in Quebec). DSA setup skipped (not selling in EU; revisit when EU launch is on the table).

## Pre-production build

- [x] **Set `cli.appVersionSource` in `eas.json`** (2026-05-29). Set to `"remote"` (EAS-managed, recommended for solo dev; alternative `local` reads from `app.json`). Knocks out the EAS warning and locks in the source of truth for buildNumber.
- [x] **Upload `.env` keys to EAS Environment Variables (production scope)** (2026-05-30). All 4 keys added to EAS production scope: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_ANTHROPIC_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_API_KEY`. RC key already swapped to `appl_` in local `.env` on 5/27, so direct copy (no swap needed at upload time).
- [x] **Configure Sentry source-map upload for production** (2026-05-30). `SENTRY_ORG=chrisluhrsdesign`, `SENTRY_PROJECT=thriftvault`, `SENTRY_AUTH_TOKEN` (org-scoped, marked Sensitive) added to EAS Production env vars. `eas.json` production profile has no `SENTRY_DISABLE_AUTO_UPLOAD`, so plugin auto-uploads on build.

## Submit

- [x] **`eas build --profile production --platform ios`** (2026-05-30). Build `96ea8a83-19fb-4ad9-accb-1261f3daa203`, buildNumber **7**, v1.0.0. IPA: `https://expo.dev/artifacts/eas/jCSJUq9tp9aWtHfN3huwr2.ipa`. First attempt (`be3db102`) failed: Sentry source-map upload missing `SENTRY_ORG` / `SENTRY_PROJECT` in EAS production env (only `SENTRY_AUTH_TOKEN` loaded). Fixed by adding both vars; second build succeeded.
- [x] **`eas submit --platform ios`** (2026-05-30). Submission `30ec6d89-1051-42e7-b05f-1d9556c9b93f` succeeded. Build **#7** uploaded to App Store Connect. **Not TestFlight beta** — upload lands in ASC's build library (TestFlight tab in UI) while Apple processes; no testers added, no beta shipped. v1.0 goes straight to App Store review.

  **ASC API key incident:** First two submit attempts (`8dff93fc`, `bacedb2c`) failed 401 — manually uploaded key `5R4H56CK65` stored on EAS with Team/Roles **None** (validation warning ignored). Fix: delete key on expo.dev → Credentials → iOS → App Store Connect API Key, rerun submit, **Y** to generate fresh key. New key: `T64TPFN72R` (`[Expo] EAS Submit HMJurcy62d`, App Manager). RevenueCat's separate key `5R4H56CK65` left intact in ASC.

- [x] **Wait for Apple binary processing** (~5-10 min) (2026-05-30). Build **7** processed, status Ready to Submit.
- [x] **Attach build to App Store version 1.0.0** (2026-05-30). Build **7** selected on Distribution → 1.0.0.
- [x] **Attach 3 subscriptions** to the version (`monthly`, `three_month`, `annual`) — already in ASC.
- [ ] **Submit for Review**. Apple review ~24-48h typical.

## Already done

- [x] Apple Developer Program (Org enrollment, 2026-05-21)
- [x] Sentry DSN wired (2026-05-03)
- [x] Paywall modal UI, 3-plan picker with trial copy
- [x] RevenueCat code side (`hooks/usePurchases.ts`, `PaywallModal`, `monetization.ts`)
- [x] Privacy policy + Terms live at `thriftvaultapp.com/privacy-policy/` and `/terms/`
- [x] Store listing copy (`STORE_LISTING.md`)
- [x] Contact email migrated to `contact@thriftvaultapp.com`
