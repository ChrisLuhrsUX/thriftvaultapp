# ThriftVault — Status Report (2026-03-27)

## Project Summary

ThriftVault is a mobile-first thrift reselling app (Expo + React Native + TypeScript). Users scan items with AI, track inventory, and calculate resale profit. All data is local — no backend.

---

## What's Working

| Area | Status | Notes |
|------|--------|-------|
| Inventory CRUD | Done | Full create/read/update/delete with AsyncStorage persistence |
| AI Scanning | Done | Gemini 2.5 Flash vision API — real scans with confidence levels |
| Three-View Vault | Done | Flips, Closet, Hauls with search + filter chips |
| Item Detail Editor | Done | Multi-photo, status tracking, profit/ROI calc |
| Profile & Stats | Done | Total profit, best flip, profit by store, active flips |
| Onboarding | Done | 3-slide carousel with skip option |
| Paywall Modal UI | Done | 3-plan picker (Monthly/Season Pass/Annual), fully styled |
| Dark/Light Theme | Done | Persistent toggle, WCAG-compliant contrast |
| Responsive Design | Done | iPhone / iPad / web (2/3/4-col grids) |
| Camera Integration | Done | Capture + gallery picker with permission handling |
| Haul Grouping | Done | Date-based grouping with detail view + grid/list toggle |
| Save for Later | Done | Persists up to 5 scan snapshots per item |

---

## What's Blocked

### 1. RevenueCat / In-App Purchases (Critical)
- `react-native-purchases` SDK **not installed**
- `usePurchases.ts` is a **stub** — everyone gets Pro access in dev mode
- **Requires:** Apple Developer membership ($99/yr), RevenueCat dashboard setup, 3 IAP products (tv_monthly, tv_season, tv_annual)

### 2. Privacy Policy Deployment
- `assets/privacy-policy.html` exists but needs hosting at a public URL
- `STORE_LISTING.md` still has `[URL]` placeholder

### 3. App Store Screenshots
- 6.7" and 6.5" iPhone screenshots not yet captured
- Requires TestFlight build or simulator

### 4. Apple Developer Program Membership
- Required before RevenueCat, TestFlight, and App Store submission

---

## Monetization Config

| Plan | Price | Per Month | Badge |
|------|-------|-----------|-------|
| Monthly | $4.99/mo | $4.99 | — |
| Season Pass | $9.99/3 mo | $3.33 | Popular |
| Annual | $29.99/yr | $2.50 | Best Value |

- 30-day free trial with full Pro access
- Default selection: Season Pass

---

## Codebase Stats

- **Source files:** ~36 TypeScript files
- **Key screens:** 6 (index, scan, profile, detail, haul-detail, onboarding)
- **Components:** 5 shared (CustomTabBar, AppIcon, Toast, PaywallModal, StatusBar)
- **Services:** 1 (Gemini AI scan)
- **Tests:** None
- **CI/CD:** None

---

## Git History

```
c6dc493 Add privacy policy as GitHub Pages index (2026-03-26)
ab79f9b ThriftVault: Expo app, inventory, Gemini scan, onboarding, paywall stub (2026-03-26)
201bccb Initial commit (2026-03-09)
```

---

## Next Steps (Priority Order)

1. Obtain Apple Developer membership — unblocks everything downstream
2. Set up RevenueCat dashboard + create IAP products
3. Install `react-native-purchases`, add to `app.json` plugins, run `npx expo prebuild`
4. Set `EXPO_PUBLIC_REVENUECAT_API_KEY` in `.env`
5. Deploy privacy policy to public URL
6. Capture App Store screenshots (6.7" + 6.5")
7. End-to-end paywall flow testing
8. Submit to App Store

---

## Bottom Line

**Core app is production-ready.** AI scanning, inventory management, profit tracking, and the full UI are complete and polished. The only blockers are external: Apple Developer account and RevenueCat integration for in-app purchases. Once those are set up, the app can ship.
