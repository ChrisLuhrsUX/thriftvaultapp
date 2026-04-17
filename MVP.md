# ThriftVault — MVP Launch Checklist

## Blocking (must ship — in order)

- [x] **Apple Developer Program** — enrollment complete
- [x] **App Store Connect app created**
- [ ] **RevenueCat subscriptions** — code side 100% ready (`hooks/usePurchases.ts`, `PaywallModal`, `monetization.ts`). Remaining = dashboard clicks + prebuild. See full sequence below.
- [ ] **Screenshots** — 6.7" and 6.5" iPhone (simulator or TestFlight build)

### RevenueCat — remaining sequence

1. ~~**Paid Apps agreement**~~ ✓ — App Store Connect → Business → bank + tax info. Real bottleneck (1–2 days to process). Do this first; nothing else works without it.
2. **Create 3 subscription products** in App Store Connect under a new Subscription Group ("ThriftVault Pro"). Use IDs `monthly` / `season` / `annual` to match `constants/monetization.ts` (or rename `monetization.ts` to match `tv_*` — just pick one and stay consistent).
3. **RevenueCat dashboard** — new project, add Apple App Store app, paste App-Specific Shared Secret (App Store Connect → App Info → Generate). Grab the public API key.
4. **RevenueCat entitlement + offering** — entitlement named `pro`, offering named `default`, add all 3 products as packages.
5. `npm install react-native-purchases`
6. Add `"react-native-purchases"` to `app.json` plugins array.
7. Set `EXPO_PUBLIC_REVENUECAT_API_KEY=appl_...` in `.env`.
8. `npx expo prebuild` — ⚠️ **after this, Expo Go no longer works on iPhone 13.** Must use `npx expo run:ios` with a dev client or a TestFlight build. Permanent dev-workflow change.
9. **Sandbox tester** — App Store Connect → Users and Access → Sandbox → create a sandbox Apple ID. Sign into it on device under Settings → App Store → Sandbox Account. Test full purchase + restore flow.

Detailed version lives in `REVENUECAT_SETUP.md`.

## Post-Launch

See [POST_LAUNCH.md](POST_LAUNCH.md) — scoped todos and unscoped ideas live there.

## Done

- [x] **Manual item add** — "+" button in vault header creates blank item and opens detail screen for manual entry. Free users can track items without AI scan.
- [x] **Real AI scan** — Gemini 2.5 Flash vision API via `services/gemini.ts`
- [x] **Store listing** — `STORE_LISTING.md`
- [x] **Paywall modal UI** — 3-plan picker (Monthly / Season Pass / Annual), trial copy, plan-aware fine print
- [x] **App icon** — 1024×1024 for App Store (`assets/logo/thriftvault_logo.jpg`)
- [x] **Privacy policy** — live at `https://chrisluhrsux.github.io/thriftvaultapp/assets/privacy-policy.html`
- [x] Onboarding carousel with skip
- [x] Inventory CRUD with AsyncStorage persistence
- [x] Flips / Closet / Hauls three-view vault
- [x] Search + filter chips
- [x] Haul grouping and detail screen
- [x] Item detail editor (store, platform, status, notes, sold price)
- [x] Profit / ROI calculations
- [x] Profile stats (total profit, best flip, profit by store)
- [x] Light / dark theme toggle with persistence
- [x] Toast notifications
- [x] Custom tab bar + scan button
- [x] Camera UI on mobile (capture + library upload)
- [x] Save for Later on scan screen
- [x] Error states — camera permission denied UI, capture failure toast, storage write logging
- [x] Responsive design — iPhone + iPad (2/3/4-col grid, adaptive padding, max-width centering)
- [x] Username / avatar
- [x] Onboarding copy updated
- [x] Real item photos via ImagePicker
- [x] iCloud backup warning on onboarding completion
- [x] Simplified item status — Unlisted / Listed / Sold