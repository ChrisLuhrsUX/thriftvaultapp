# ThriftVault — Android / Play Store Readiness

iOS-first launch is the plan. This doc tracks everything needed to ship on Android after.

---

## Current State

| Area | Status |
|------|--------|
| `android.package` in app.json | Missing |
| `android.versionCode` in app.json | Missing |
| Adaptive icon (PNG) | Wrong format (.jpg) |
| `eas.json` Android build profile | Missing |
| Google Play Developer account | Not created |
| RevenueCat Google Play Billing | Not wired |
| Play Store listing copy | Not written |
| Play Store screenshots | Not made |

---

## `app.json` Fixes Needed

```json
"android": {
  "package": "com.thriftvault.app",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/logo/thriftvault_logo_android.png",
    "backgroundColor": "#7A9B94"
  },
  "permissions": [
    "CAMERA",
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "READ_MEDIA_IMAGES"
  ],
  "predictiveBackGestureEnabled": false
}
```

> Note: foreground adaptive icon must be `.png` with transparency, not `.jpg`.

---

## EAS Build (`eas.json`)

No `eas.json` exists yet. Needed before any Android build:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

---

## Google Play Developer Account

- One-time registration fee: **$25**
- Sign up at: play.google.com/console
- Register under **ThriftVault LLC** once D-U-N-S / Org Apple account is resolved (same entity)
- Unlike Apple, no annual renewal fee

---

## RevenueCat — Google Play Billing

The iOS RevenueCat setup (see `MVP.md`) does not cover Android. Separate steps required:

1. Create the same 3 subscription products in Google Play Console (`monthly`, `season`, `annual`)
2. In RevenueCat dashboard → add Google Play app to the same project
3. Link Google Play products to the existing `pro` entitlement / `default` offering
4. Add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to `.env`
5. Update `hooks/usePurchases.ts` to pass the Android key on the Android platform

---

## Play Store Listing Copy

Play Store has a different structure than App Store. Needs to be written separately.

| Field | Limit | Notes |
|-------|-------|-------|
| App name | 30 chars | "ThriftVault — Thrift Tracker" = 29 ✓ |
| Short description | 80 chars | Replaces App Store subtitle |
| Full description | 4,000 chars | No keyword field — keywords go in the description naturally |
| Category | — | Finance or Shopping (decide at submission) |

**Draft short description:**
> Track thrift flips, scan items, and estimate resale profit — all offline.

---

## Screenshots

Play Store requires at least 2 screenshots. Recommended sizes:

- **Phone:** 1080×1920 px (portrait) or 1920×1080 px (landscape)
- **Tablet:** optional but boosts visibility

Use the same screens as App Store (Vault, Scan, Detail, Profile) — just export at Android dimensions.

---

## Launch Sequence (when ready)

1. Fix `app.json` (package, versionCode, PNG adaptive icon)
2. Create `eas.json`
3. Create Google Play Developer account under ThriftVault LLC
4. Wire RevenueCat for Google Play Billing
5. `npx expo prebuild` (if not already done for iOS RevenueCat)
6. `eas build --platform android --profile production`
7. Upload `.aab` to Play Console internal track
8. Write Play Store listing copy + upload screenshots
9. Submit for review (Play review ~1–3 days, faster than Apple)
