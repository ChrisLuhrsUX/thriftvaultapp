# Launch Blockers

Ordered punch list, dependencies respected. Tick top to bottom. Source of truth for "what's left before submit".

## Pre-prebuild (can run in parallel)

- [x] **Paid Apps agreement** accepted (2026-05-22).
- [x] **Tax form (W-9)** for ThriftVault LLC active (2026-05-22).
- [x] **Banking info** active (2026-05-23). LLC business account linked in App Store Connect → Agreements, Tax, and Banking.
- [x] **Register bundle ID in Apple Developer** (2026-05-22). `com.thriftvault.app` with In-App Purchase + Data Protection (defaults).
- [x] **Create app in App Store Connect** (2026-05-22). Name: "ThriftVault: Scan to Flip". Company Name: "ThriftVault LLC". SKU: `thriftvault-ios-1`. ascAppId: `6772308542`.
- [x] **Fill `eas.json:20-22`** with `ascAppId: 6772308542` + `appleTeamId: UG3X275FNX` (2026-05-22).
- [x] **Re-export app icon** (2026-05-22). `assets/logo/thriftvault_logo.png` is 1024×1024, 8-bit colormap (no alpha). All 4 paths in `app.json` repointed.

## After Paid Apps + Tax + Banking are live

- [ ] **Create 3 subscription products** in App Store Connect under a new Subscription Group named "ThriftVault Pro". Product IDs must match `constants/monetization.ts`: `monthly`, `season`, `annual`. Set prices ($4.99 / $9.99 / $29.99), trial duration (30 days), and localized descriptions.
- [ ] **RevenueCat dashboard setup**:
  - New project → add Apple App Store app
  - Paste App-Specific Shared Secret (App Store Connect → App Info → Generate)
  - Grab public API key (`appl_...`)
  - Create entitlement named `pro`
  - Create offering named `default`, add all 3 products as packages
- [ ] **Code wire-up**:
  - `npm install react-native-purchases`
  - Add `"react-native-purchases"` to `app.json` plugins array
  - Add `EXPO_PUBLIC_REVENUECAT_API_KEY=appl_...` to `.env`

## Irreversible step (Expo Go → dev client)

- [ ] **First EAS dev client build**. The moment `react-native-purchases` lands in `package.json` and `app.json` plugins (Code wire-up step above), Expo Go on iPhone 13 stops working because it doesn't bundle custom native modules. Dev workflow switches to a **dev client**: your app + Metro connection in one binary, built and installed on your phone.

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

- [ ] **Sandbox tester**. App Store Connect → Users and Access → Sandbox → create sandbox Apple ID. On device: Settings → App Store → Sandbox Account → sign in. Test full flow: trial start, upgrade, restore purchases, cancel.
- [ ] **Screenshots** for App Store listing. **Required size:** 6.9" iPhone at 1320×2868 px (iPhone 16 Pro Max); ASC auto-scales to fill smaller sizes. **Count:** 3–5 minimum (Apple's recommended floor), 10 max. First 3 are visible on the App Store browse card, put the strongest there. **Suggested order:** (1) scan result with price + range (hero), (2) vault grid, (3) paywall with 3 plans, (4) red-flag banner on a scan, (5) profile stats. **Capture on Windows:** native iPhone 13 screenshots are 1170×2532; upscale ~1.13× in Figma to fit 1320×2868 (UI re-renders cleanly, acceptable to reviewers). **Compose in Figma:** 1320×2868 artboard per screenshot, brand `cream` / `vintageBlue` bg, device frame from the Figma Community (search "iPhone 16 Pro mockup"), Playfair Display headline above the device + DM Sans subhead. Match landing page hangtag motif for visual consistency. Export PNG. Upload via ASC → App Information → App Store → Screenshots. **Avoid:** Apple-badge imitations, competitor names, copy misrepresenting features, screenshots that show real users' data.
- [ ] **Share-as-image card** (optional polish, gated on prebuild). `npx expo install react-native-view-shot expo-sharing`. Follow `SHARE_CARD_PLAN.md`.

## Submit

- [ ] **Swap AI-generated logo for human-made mark**. The current v2 icon is AI-illustrated, which contradicts the in-app AI-photo red flag system and invites brand call-outs (TikTok/Reddit screenshot bait). Commission a human illustrator ($50-200, 1-3 day turnaround on Fiverr / 99designs / contract). After swap, redo the icon re-export: 1024×1024 8-bit colormap, no alpha, all 4 `app.json` paths (icon / splash / Android adaptive / web favicon), and `components/WebSidebar.tsx:83`. Must land before the production build below.
- [ ] **`eas build --profile production --platform ios`**. Cloud build, ~15-30 min. Produces a signed `.ipa`.
- [ ] **`eas submit --platform ios`**. Uploads the `.ipa` to App Store Connect using the `ascAppId` + `appleTeamId` from `eas.json`. Then in ASC: attach screenshots, fill metadata, click Submit for Review. Apple review ~24-48h typical.

## Already done

- [x] Apple Developer Program (Org enrollment, 2026-05-21)
- [x] Sentry DSN wired (2026-05-03)
- [x] Paywall modal UI, 3-plan picker with trial copy
- [x] RevenueCat code side (`hooks/usePurchases.ts`, `PaywallModal`, `monetization.ts`)
- [x] Privacy policy + Terms live at `thriftvaultapp.com/privacy-policy/` and `/terms/`
- [x] Store listing copy (`STORE_LISTING.md`)
- [x] Contact email migrated to `contact@thriftvaultapp.com`
