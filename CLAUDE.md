# ThriftVault

## Project Overview

ThriftVault is a mobile-first thrift reselling app built with Expo + React Native. Thrifters can scan items, track inventory, and estimate resale profit. All data is local — no backend.

## Tech Stack

- **Framework:** Expo 54, React 19.1, React Native 0.81.5
- **Language:** TypeScript 5.9
- **Routing:** Expo Router 6 (file-based)
- **State:** React Context API + AsyncStorage
- **Fonts:** Playfair Display (headings) + DM Sans (body) via `@expo-google-fonts`
- **Icons:** Expo Ionicons via `AppIcon.tsx`
- **No backend** — inventory is local; **Gemini** powers AI scan; paywall/export are partially stubbed until RevenueCat

## Dev Commands

```bash
cd C:\Users\Chris\Downloads\ThriftVault\thriftvaultapp
npx expo start        # dev server
# then: w = web, a = Android emulator, scan QR = Expo Go on phone
```

## Project Structure

```
thriftvaultapp/
├── app/
│   ├── _layout.tsx          # Root layout: fonts, providers, Stack nav
│   ├── index.tsx            # Entry: checks onboarding flag, routes accordingly
│   ├── onboarding.tsx       # 3-slide carousel onboarding
│   ├── detail.tsx           # Item detail/edit screen (route: /detail?itemId=)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab layout (3 tabs + CustomTabBar)
│       ├── index.tsx        # My Vault — inventory grid + search/filter
│       ├── scan.tsx         # Scan — Gemini AI scan + recent adds
│       └── profile.tsx      # Profile — stats, settings, upgrade button
├── components/
│   ├── CustomTabBar.tsx     # Custom bottom nav (elevated center Scan button)
│   ├── AppIcon.tsx          # Ionicons wrapper
│   ├── Toast.tsx            # Animated toast notification
│   ├── PaywallModal.tsx     # Subscription modal (UI only)
│   └── StatusBar.tsx        # Top bar with live time display
├── context/
│   ├── InventoryContext.tsx # Inventory state + AsyncStorage persistence
│   └── ToastContext.tsx     # Toast state (auto-dismiss 2.6s)
├── hooks/
│   └── useResponsive.ts     # Apple HIG breakpoints (phone <744px, tablet 744-1023px, tabletLarge >=1024px)
├── theme/
│   ├── index.ts             # Main theme export (colors, typography, spacing, shadows, radius)
│   ├── colors.ts            # Color palette
│   └── typography.ts        # Font families + sizes
├── types/
│   └── inventory.ts         # Item, ItemCategory, ItemStatus, Platform, ScanScenario types
└── constants/
    ├── seedItems.ts         # Default placeholder image URL + legacy demo name migration
    ├── monetization.ts      # TRIAL_DURATION_DAYS (free trial before paywall)
    └── Colors.ts            # Legacy light/dark color constants
```

## Navigation

```
/ (index.tsx)
├── /onboarding → /(tabs) after completion
├── /(tabs)/          → My Vault (inventory grid)
├── /(tabs)/scan      → Scan screen
├── /(tabs)/profile   → Profile screen
└── /detail?itemId=   → Item detail editor
```

## State Management

- **InventoryContext** — inventory array, CRUD ops, auto-persists to AsyncStorage (`tv_inv`)
- **ToastContext** — ephemeral toast message, auto-dismisses after 2.6s
- **AsyncStorage keys:** `tv_inv` (inventory JSON), `tv_onboarding_done` ("1" string), `tv_trial_started_at` (ISO date string when wired for 30-day trial), pro unlock flag TBD with RevenueCat
- First launch starts with **empty inventory**; data is only what users add

## Design System (`theme/`)

### Colors


| Token                            | Value     | Use                        |
| -------------------------------- | --------- | -------------------------- |
| `cream`                          | `#F8F1E9` | App background             |
| `vintageBlue` / `vintageBlueDark` / `vintageBlueDeep` | logo fabric (#6B9E9A) | Primary UI: CTAs, tabs, active states |
| `profit`                         | green     | Money: profit, sold, $ amounts |
| `terra`                          | `#C97C5D` | Secondary accent           |
| `charcoal`                       | `#3C2F2F` | Primary text               |
| `mauve`                          | `#9B8A8A` | Muted text                 |
| `lavender`                       | `#E8D9E0` | Light accent (e.g. dividers) |
| `surfaceVariant`                 | `#E8E2DC` | Inactive chip/pill background and borders (warm neutral, not purple) |
| `blush`                          | `#FFEFEF` | Light pink background      |


### Typography

- Display (30px, PlayfairDisplay 700) — page titles
- h1/h2 — section headings
- body (15px, DMSans 400) — main text
- caption (13px, DMSans 400) — secondary text
- label (10px, DMSans 600) — tags, badges

### Spacing: `xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) section(32)`

### Radius: `sm(12) md(18) lg(24) xl(28) full(9999)`

### Shadows: iOS shadow props + Android elevation; use `...theme.shadows.sm`

## Data Types

```typescript
// types/inventory.ts
type ItemCategory = 'denim' | 'tops' | 'dresses' | 'outerwear' | 'shoes' | 'bags'
type ItemStatus = 'unlisted' | 'listed' | 'sold'
type Platform = 'Depop' | 'Poshmark' | 'eBay'

interface Item {
  id: number           // timestamp-based for new items
  name: string
  cat: ItemCategory
  paid: number         // cost basis
  resale: number       // target resale price
  soldPrice: number | null
  status: ItemStatus
  date: string         // toLocaleDateString('en-US')
  store: string
  platform: Platform
  notes: string
  img: string          // first/cover photo URI (kept for backward compat with grid)
  photos?: string[]    // all photos; img always mirrors photos[0]
  intent: ItemIntent
}

interface ScanScenario {
  name: string
  sub: string
  profit: number
  ideas: string[]
}
```

## Key Patterns

- **Styling:** React Native `StyleSheet` co-located in each file; theme object imported everywhere
- **Lists:** `FlatList` with `numColumns={2}` for inventory grid; horizontal `FlatList` for carousels
- **Performance:** `useMemo` for filtered lists, `useCallback` for persist functions
- **Forms:** `TextInput` + `Pressable` chip selectors in detail screen; `KeyboardAvoidingView` wraps form
- **Platform files:** `.web.ts` / `.ts` variants for `useColorScheme` and `useClientOnlyValue`
- **Safe area:** `useSafeAreaInsets` used throughout; min touch target 44px enforced via theme

## Stub / Unimplemented Features

- Web / no-photo scan — shows a toast; scan requires a photo (Gemini on native with camera or library)
- Paywall — modal shows plans but `subscribe()` just shows a toast
- Notifications toggle — UI only

## Debug Tips

- Reset onboarding: `AsyncStorage.removeItem('tv_onboarding_done')` then reload
- Clear inventory: `AsyncStorage.removeItem('tv_inv')` then reload
## AI Scan — Chosen API

**Google Gemini Flash** — vision API for scan feature
- Free tier: ~1500 req/day, 15 RPM
- Cost after free tier: ~$0.075/1M tokens (~$0.0001 per scan / ~260 tokens in + ~100 tokens out)
- Key: get from [aistudio.google.com](https://aistudio.google.com)
- `scan.tsx` calls `scanWithGemini(photoUri)` when a photo is available

## Monetization Model

**Free 30-day trial → subscription (3 tiers)**

### Philosophy:
- App exists to help thrifters make money — the app pays for itself
- Subscription justified by ongoing AI scan costs and continuous value delivery
- Season Pass is a unique hook for seasonal thrifters (Q4 holiday, back-to-school, etc.)

### Free trial:
- **30-day trial** — **full Pro feature set** for `TRIAL_DURATION_DAYS` from trial start (unlimited AI scan, full vault, hauls, etc.). Not a limited “free tier” during trial. Trial start: e.g. when onboarding finishes or first app open; persist ISO timestamp in AsyncStorage.
- After trial ends → PaywallModal → pick a plan

### Subscription tiers:
| Plan | Price | Effective $/mo | Notes |
|------|-------|----------------|-------|
| Monthly | $4.99/mo | $4.99 | Flexibility |
| Season Pass | $9.99/3 mo | $3.33 | Aligned to thrift seasons (3-month blocks) |
| Annual | $29.99/yr | $2.50 | Best value |

### Implementation (not yet built):
- RevenueCat / StoreKit for auto-renewable subscriptions
- Persist trial start (`tv_trial_started_at` or equivalent) and/or rely on RevenueCat for entitlement
- PaywallModal when `now > trialStart + TRIAL_DURATION_DAYS` and no active subscription
- Restore Purchases button in profile settings (required by Apple)

## Session Notes

### Session — 2026-03-24

- **App Store compliance audit** — full cross-analysis against Apple review guidelines. Fixed: app display name (`thriftvaultapp` → `ThriftVault`), removed stub Notifications setting, replaced phantom paywall features list with real features, removed "thousands of users" onboarding copy, changed "Continue as Guest" → "Skip", removed export data references entirely.
- **Privacy fixes** — camera permission string now discloses Gemini AI photo transmission. Privacy policy corrected: removed false "immediately discarded" claim about Gemini data; now accurately states Google may retain data per their API terms.
- **Unsplash placeholder removed** — `DEFAULT_ITEM_PLACEHOLDER_IMAGE` was an external Unsplash URL (IP + reliability risk). Changed to empty string; existing placeholder UI (camera icon) handles it gracefully.
- **Haul detail grid default** — haul detail view now defaults to grid instead of list.
- **Monetization model changed** — reversed decision from 3/23. Switched from $1.99 one-time unlock to **subscription model**: Monthly $4.99, Season Pass $9.99/3mo, Annual $29.99/yr. Rationale: thrifters profit significantly from the app; recurring value justifies recurring revenue. Season Pass aligned to natural 3-month thrift cycles (spring/summer/fall/holiday).
- **PaywallModal rebuilt** — 3-plan selector cards (Monthly / Season Pass / Annual), Season Pass pre-selected with "Popular" badge, Annual gets "Best Value" badge. CTA = "Start Free Trial". Fine print updates dynamically with selected plan.
- **`constants/monetization.ts` updated** — `PLANS` array with id, label, price, period, perMonth, badge. `DEFAULT_PLAN_ID = 'season'`.
- **`hooks/usePurchases.ts` written** — lazy-loads `react-native-purchases`, gracefully stubs if SDK not installed (dev mode = isPro true). `subscribe(planId)`, `restorePurchases()`, real-time entitlement listener. Wired into PaywallModal (spinner on purchase) and profile Restore Purchases setting.
- **Restore Purchases added to profile** — Apple-required; new settings row calls `restorePurchases()`.
- **MVP.md reordered** — blocking items now in submission order: Screenshots → Privacy policy → RevenueCat → App icon.
- **Scan spinner color** — `ActivityIndicator` on scan screen changed from `vintageBlue` to `vintageBlueDark`.
- **"Remove" → "Delete"** — photo remove button, alert title, and alert action in `detail.tsx` renamed to Delete for consistency.
- **Onboarding offline copy fixed** — "works offline" claim updated to clarify AI scan requires internet, everything else works offline.

### Session — 2026-03-23

- **Gemini 2.5 Flash scan live** — `services/gemini.ts` sends photo to Gemini 2.5 Flash vision API, returns item name, category, price estimates, confidence level, and 3 flip suggestions. Replaced `DEMO_SCAN_SCENARIO` with real API calls. API key stored in `.env` (gitignored) via `EXPO_PUBLIC_GEMINI_API_KEY`.
- **Scan confidence indicator** — low-confidence results show terra-colored banner: "Low resale data — price manually." Gemini sets confidence based on brand recognition and resale comp availability.
- **Scan robustness** — handles Gemini 2.5 thinking parts (skips `thought` blocks), `responseMimeType: 'application/json'` for clean JSON, `maxOutputTokens: 8192` to prevent truncation, `resolveReadableUri` for Android content:// URIs, MIME type inference from file extension.
- **Stale closure fix** — `runScan` guard changed from `scanning` state to `scanningRef` ref to prevent second scan from silently failing.
- **Clear button on scan** — frosted glass pill button overlaid on camera area after scan result; resets photo and result without scrolling to Skip. Matches shutter ring style.
- **Scan error UX** — toast changed to "Couldn't identify — try getting the label in frame" instead of generic "try again."
- **PaywallModal price fixed** — $5.99 → $1.99 to match monetization decision. Copy updated to reference 30-day trial.
- **Seed items removed from production** — `InventoryContext` no longer loads `SEED_ITEMS` on first launch; new users start with empty vault.
- **iPhone-only for MVP** — `supportsTablet: false` in `app.json`; added `bundleIdentifier` and `ITSAppUsesNonExemptEncryption: false`.
- **Store listing drafted** — `STORE_LISTING.md` with app name, subtitle, description, keywords, privacy policy link placeholder.
- **Privacy policy updated** — sections 2 and 4 updated to disclose Gemini API photo transmission.
- **MVP.md updated** — AI scan marked done, moved to blocking; export data dropped; iPad screenshots dropped.
- **`bottoms` category added** — new `ItemCategory` for pants, leggings, joggers, shorts (non-denim).
- **`ItemScanSnapshot` type added** — stores scan history per item with `scanSnapshots` and `activeScanSnapshotId` on `Item`.
- **Notifications toast softened** — "coming soon" → "not available yet."
- **Demo scan leak fixed** — "using demo scan" message removed from capture failure toast.
- **Monetization model finalized** — free app + $1.99 one-time unlock. **30-day trial = full Pro** (all features unlocked, not scan-only); after trial, $1.99 once to keep access. No subscriptions, no season pass, no item caps.
- **Gemini Flash cost analysis** — ~$0.0001 per scan (~260 tokens in + ~100 tokens out). 10,000 scans ≈ $1. Cost is negligible, doesn't justify subscriptions.
- **Pricing philosophy** — app exists to help thrifters make money, not extract money. No aggressive paywalls. Price so low nobody can say no. Users are fatigued of subscription-based tools.
- **No item caps** — decided against limiting number of items; bad UX, leads to negative reviews.
- **Rejected: subscriptions & season pass** — API costs too low to justify recurring charges. Simpler model = better UX and reviews.
- **Rejected: bulk scan** — stacking multiple result cards is overwhelming; single-scan loop is the right UX.

### Session — 2026-03-22

- **Performance: batch `addItems`** — new `addItems(items: Item[])` method in `InventoryContext` for bulk inserts with single AsyncStorage persist. Fixes race condition where N individual `addItem` calls in a loop could drop items.
- **Performance: FlatList optimization** — added `initialNumToRender={12}`, `windowSize={5}`, `removeClippedSubviews` to both items and hauls FlatLists in `index.tsx`.
- **Performance: memoized recents** — `scan.tsx` `recents` wrapped in `useMemo`.
- **Security audit** — no critical issues. Local-only app with zero network calls; AsyncStorage data runs through full sanitization pipeline; file system access limited to ImagePicker URIs → app document directory.
- **Store picker modal** — replaced `Alert.alert` with custom themed modal: preset chips (Goodwill, Salvation Army, Thrift Store, Savers, Plato's Closet) + "Other" with text input. Keyboard dismisses on tap outside.
- **Add to Closet button** — multi-photo button on Closet tab, same pattern as New Haul, uses `addItems` bulk method.
- **Post-scan navigation** — "Buy & Track" and "Add to Closet" in `scan.tsx` now push to `/detail` with the new item's ID instead of staying on scan screen.
- **PaywallModal** — updated from monthly/annual subscription to single one-time $5.99 unlock per market research. Removed plan picker UI, simplified to single CTA.
- **Hauls scroll unified** — hauls view now uses FlatList with `ListHeaderComponent` (search + chips + New Haul button) matching flips/closet pattern. Everything scrolls together.
- **Haul detail grid/list toggle** — added view mode toggle in haul-detail header. List view (default) = existing rows. Grid view = 2-column collage with photo tiles and name overlay.
- **Trash icon on photos** — detail screen photo remove badge changed from X (`close`) to trash icon (`trash-outline`).
- **Haul delete icon** — changed to `charcoal` to match header icon design system.
- **Profile footer removed** — "ThriftVault / Track your flips" footer removed from profile page.
- **Logo filename** — updated all references from `v2_thriftvault_logo.jpg` to `thriftvault_logo.jpg` (app.json, scan.tsx, WebSidebar.tsx).
- **Platform order** — reordered to thrift reseller popularity: Poshmark, Depop, eBay, Mercari, Facebook Marketplace, Vinted, Shopify.

### Session — 2026-03-21

- **iCloud backup warning:** One-time `Alert` on onboarding `finish()` — fires after `AsyncStorage.setItem(ONBOARDING_KEY)`, before routing to tabs. Frames local storage positively ("works offline, no account") while warning uninstall = data loss.
- **ItemStatus simplified:** `'in-progress'` and `'needs-work'` merged into `'unlisted'` — status flow is now `Unlisted → Listed → Sold`. Updated across `types/inventory.ts`, `detail.tsx`, `(tabs)/index.tsx`, `(tabs)/scan.tsx`, `(tabs)/profile.tsx`, `constants/seedItems.ts`, `CLAUDE.md`.
- **Listed badge color fixed:** Was yellow (`#FDE68A`/`#F59E0B`) with low-contrast text. Now `vintageBlueDark` bg + `onPrimary` white text in both card grid (`index.tsx`) and detail screen (`detail.tsx`).
- **MVP.md updated:** AI scan moved to Post-Launch; iCloud warning and status simplification marked done. No separate ROADMAP.md — MVP.md serves both purposes.
- **ItemStatus simplified:** `'in-progress' | 'listed' | 'sold' | 'needs-work'` → `'unlisted' | 'listed' | 'sold'`
- **Market research:** Full competitor/viability report added to `UX Research/ThriftVault Market Research Report (Brutal).md`. Key findings: Flippd is primary competitor; AI scan is #1 differentiator; local-only data is biggest liability; one-time purchase ($4.99-$7.99) recommended over subscription.
- **CLAUDE.md:** Session notes condensed to bullet-point format.
- **WCAG color contrast audit + fixes:** Audited all light/dark pairs. Fixed all failures in `theme/colors.ts`: teal scale darkened (vintageBlue #6B9E9A → #508C88, vintageBlueDark → #3F7B77, vintageBlueDeep → #2E6A66); profit #7FA878 → #4A7A44 (AA); terra #C97C5D → #8B4E30 (AA); mauve #9B8A8A → #706060 (AA). `onPrimary` light stays #FAF8F5 (white on vintageBlueDark = 4.60:1); dark mode onPrimary → #1C1B1F (6.83:1 on dark vintageBlueDark). Active chips use `vintageBlueDark` bg + `onPrimary` text (consistent with scan button and empty-state CTA).
- **Onboarding logo row removed:** `logoRow` (52px jpg + brand name text) removed — redundant and awkward at small size.
- **Nav animation fixed:** `onboarding` and `(tabs)` set to `animation: 'none'` in `_layout.tsx` — prevented unintended right-to-left slide on initial load.

### Session — 2026-03-11

- **Responsive design:** `hooks/useResponsive.ts` added — Apple HIG breakpoints (phone <744px, tablet 744-1023px, tabletLarge >=1024px); returns `gridColumns` (2/3/4), padding/max-width values, `isTablet`/`isTabletLarge`. All screens updated.
- **Error states:** `scan.tsx` handles camera permission denied (inline state + `Linking.openSettings()`) and capture failure (toast). `InventoryContext` logs storage write failures.
- **Multiple photos:** `Item.photos?: string[]` added; `img` always mirrors `photos[0]` for grid compat. Detail screen has paginated carousel, per-photo removal with confirmation, fullscreen modal with counter pill and "Set as cover" button.
- **Hauls search:** Search bar above filter chips in hauls view; searches `haul.date`, `haul.stores`, and item names.
- **Logo:** Updated to `v2_thriftvault_logo.jpg`.
- **Profile appearance toggle:** Restyled to chip design (`surfaceVariant` bg, `radius.full`, `mauve` text).
