# RevenueCat Setup Guide

## 1. App Store Connect — Create your app listing

- Sign into [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- Create your app (bundle ID from `app.json`)
- You need the app listing to exist before you can create subscriptions

## 2. App Store Connect — Create subscription products

- Go to your app → Subscriptions → create a **Subscription Group** (e.g. "ThriftVault Pro")
- Add 3 subscriptions inside that group:
  - `tv_monthly` — $4.99/mo
  - `tv_season` — $9.99/3mo
  - `tv_annual` — $29.99/yr
- Fill in display names, descriptions, and localization for each
- Set up a **Paid Apps agreement** in App Store Connect → Business (bank account + tax info) — subscriptions won't work without it

## 3. RevenueCat dashboard — Create project & configure

- Sign up at [revenuecat.com](https://www.revenuecat.com)
- Create a new project → add an **Apple App Store** app
- Paste your **App Store Connect shared secret** (App Store Connect → your app → App Information → App-Specific Shared Secret → Generate)
- Note your **RevenueCat Public API Key** (this goes in your `.env` as `EXPO_PUBLIC_REVENUECAT_API_KEY`)

## 4. RevenueCat dashboard — Map products

- Create an **Entitlement** called `pro`
- Attach all 3 product IDs (`tv_monthly`, `tv_season`, `tv_annual`) to that entitlement
- Create an **Offering** called `default`
- Add a **Package** for each plan inside that offering, pointing to the matching product ID

## 5. Install the SDK locally

```bash
npm install react-native-purchases
```

## 6. Add the plugin to `app.json`

- Add `react-native-purchases` to the Expo plugins array

## 7. Prebuild

```bash
npx expo prebuild
```

- This generates native iOS project files that include the RevenueCat native module
- From this point on, you can't use Expo Go — you'll need a **dev client** or **TestFlight build**

## 8. Add your API key to `.env`

```
EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxxxxxx
```

## 9. Wire up `usePurchases.ts`

- Hook already exists — make sure `Purchases.configure({ apiKey })` runs on app startup and that `subscribe()` calls the real RC purchase flow

## 10. Test with a Sandbox account

- In App Store Connect → Users and Access → Sandbox → create a **Sandbox Apple ID**
- On your test device, sign into that sandbox account under Settings → App Store → Sandbox Account
- Sandbox subscriptions renew on accelerated schedules (monthly = every 5 min, etc.)

## 11. Build & test on device

```bash
npx expo run:ios
# or create a TestFlight build via EAS
```

---

**Blocker:** Step 2 requires the Paid Apps agreement (bank/tax) to be fully set up, which can take a day or two to process. Everything else chains off having real product IDs in App Store Connect that RevenueCat can see.

---

**Note:** `constants/monetization.ts` currently uses plan IDs `monthly`, `season`, `annual`. When creating products in App Store Connect (Step 2) and mapping them in RevenueCat (Step 4), make sure the IDs match — either update `monetization.ts` to `tv_monthly` / `tv_season` / `tv_annual`, or use the shorter names in App Store Connect. They just need to be consistent across all three places.
