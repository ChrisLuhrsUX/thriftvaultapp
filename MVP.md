# ThriftVault — MVP Launch Checklist

## Blocking (must ship — in order)

- [ ] **Screenshots** — 6.7" and 6.5" iPhone (needs simulator or TestFlight build)
- [ ] **Apple Developer Program** — $99/yr membership required before any of the below is possible
- [ ] **RevenueCat subscriptions** — requires Apple Developer membership first. Then: `npm install react-native-purchases`, add plugin to `app.json`, set `EXPO_PUBLIC_REVENUECAT_API_KEY` in `.env`, run `npx expo prebuild`. Create products `tv_monthly` / `tv_season` / `tv_annual` in App Store Connect + RevenueCat dashboard (entitlement: `pro`, offering: `default`). Hook code already written in `hooks/usePurchases.ts`

## Post-Launch

- [ ] **Platform filter in Vault** — filter by eBay / Poshmark / etc.

## Done

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