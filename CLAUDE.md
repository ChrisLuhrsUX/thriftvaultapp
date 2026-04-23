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

### Key Decisions (consolidated)

- **Scan UX** — Camera = single-shot (scans immediately on capture); library = multi-photo. Bulk scan rejected (overwhelming). Single-scan loop is right UX. Item caps rejected (bad UX, leads to negative reviews).
- **AI fallback chain** — Gemini 2.5 Flash → Gemini 2.5 Flash-Lite → Claude Sonnet 4.5. GPT-4o-mini removed (weaker vision). Keys: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_ANTHROPIC_API_KEY`. Estimated Claude fallback ~$0.017/scan; only hits when both Gemini tiers fail. Retry delays: 3s/8s.
- **Handmade pricing rules** (all in `services/gemini.ts` prompt) — `DENIM EXCEPTION` (finished-look pricing, $140 ceiling); `ALTERED FACTORY BASE EXCEPTION` (base tier + 30–60% customization premium, no labor formula); `CONDITION ADJUSTMENT` (30–50% for visible damage, 15–25% moderate wear); `BRAND IN NAME — HARD RULE` + `COMMON HALLUCINATION TRAPS` to prevent brand invention on unbranded items.
- **iOS minimum = 15.1** — Expo 54 + expo-camera + expo-image-picker floor. Covers iPhone XS→16 Pro Max. Portrait-locked, no tablet.
- **Background scan** — iOS suspends network requests after brief grace period when backgrounded. Result appears on return. Full fix requires iOS Background Fetch entitlement — deferred post-launch.
- **RevenueCat** — Code is 100% ready (`hooks/usePurchases.ts`, `PaywallModal`). Blockers are all infrastructure: Paid Apps agreement, 3 App Store Connect products, RevenueCat dashboard, `npm install react-native-purchases`, `app.json` plugin, `.env` key, `npx expo prebuild`. **Expo Go breaks permanently after prebuild** — must switch to dev client or TestFlight. See `MVP.md` for 9-step sequence.
- **Anti-counterfeit** — "Reselling this?" disclaimer on Verify authenticity blocks (`scan.tsx`, `detail.tsx`). TOS Section 4 prohibits counterfeit use. **Needs GH Pages push to go live.**
- **Invested = lifetime cost basis** — stats reducer accumulates `invested += paid` for every item regardless of status (selling doesn't reduce invested).

### Business State

- **Apple Developer** — Individual enrollment active ($99/yr, enrolled 2026-03-28). D-U-N-S submitted ~2026-04-17 (~1–2 week turnaround). Once D-U-N-S arrives: enroll new **Org** account ($99/yr) so App Store seller = "ThriftVault LLC" — cannot convert individual → org.
- **ThriftVault LLC** — Formed in TN ~2026-04-16, EIN issued. Chris signs as "Chris Luhrs, Member, ThriftVault LLC." Annual overhead: ~$400/yr TN ($300 annual report due April 1 + $100 min franchise) + 6.5% excise on net earnings. Legal docs: `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\`.
- **Pre-launch follow-ups:** (1) Push updated legal docs to GH Pages (LLC name + TN law + Sentry — done in code, not yet pushed). (2) Export 1024×1024 PNG icon; update three `app.json` icon/splash/favicon paths. (3) D-U-N-S → new Org Apple Developer enrollment; fill `ascAppId` + `appleTeamId` in `eas.json`.

### Session — 2026-04-23 (continued)
- **AI photo red flag detection** — Added third red flag condition to Gemini prompt: detects AI-generated photos (diffusion smearing, CG fabric texture, impossible shadows, bleeding edges, garbled environmental text, anatomical errors). Does NOT flag professional product photos, flat lays, model shots, or social media screenshots. Uses sentinel string `"stock-photo"` in `redFlags` to trigger banner without showing a bullet. UI filters `"stock-photo"` before rendering bullets in both `scan.tsx` and `detail.tsx`.
- **Red flag UX** — Banner moved to top of scan card (right after name/price/description). Yes/No prompts (handmade, wrong scan) suppressed when `hasRedFlags`. Red border on camera box via outer wrapper View (bypass `overflow:hidden`). Subtitle updated to "This item or photo may be fake or AI-generated."
- **Bug fix: rescan survives clear** — Clearing during an in-flight rescan now aborts the request immediately (`abortControllerRef.current?.abort()` in `clearResultAndPhoto`) and resets rescan flags. Both rescan handlers wire `AbortController` signal to API calls. Functional `setResult(prev => prev === null ? null : ...)` discards late-arriving results if already cleared.

### Session — 2026-04-23
- **Bug fix: `redFlags` lost on restart** — `sanitizeSnapshot` in `InventoryContext.tsx` extracted `authFlags` but not `redFlags`. Red flag warnings were silently stripped every time the app rehydrated from AsyncStorage. Fixed: now extracts and returns `redFlags` alongside `authFlags`.
- **Bug fix: rescans dropped `authFlags` + `redFlags`** — `confirmHandmade` and `rescanWrong` in `detail.tsx` created new `ItemScanSnapshot` objects without including `authFlags` or `redFlags` from the AI result. Fixed: both now include them, matching `scan.tsx` behavior.
- **Bug fix: `formatMoney` missing in rescan profit strings** — `detail.tsx` used raw `$${low}–$${high}` instead of `formatMoney()` for rescan profit display. Four-figure items showed `$1000` instead of `$1,000`. Fixed in both `confirmHandmade` and `rescanWrong`.
- **Type safety: chip toggles** — Category, platform, and status chip deselect used `'' as any` which violates `ItemCategory`/`ItemStatus` types. Fixed: category deselects to `'other'`, status deselects to `'unlisted'`.
- **Dead code cleanup** — `constants/Colors.ts` → `components/Themed.tsx` → `app/+not-found.tsx` was an unused Expo boilerplate chain. Rewrote `+not-found.tsx` to use real theme; `Colors.ts` and `Themed.tsx` are orphaned (safe to delete).
- **Accessibility labels pass** — Added `accessibilityLabel`, `accessibilityRole`, and `accessibilityState` across all interactive elements. 37 → 169 attributes across 9 files. Covers: all chips (with `selected` state), toggles (with `expanded` state), camera controls, action buttons, modals, navigation, tab switcher (with `tab` role), plan cards, legal links. Sufficient for App Store review; Dynamic Type and Reduce Motion are post-launch polish.

### Session — 2026-04-22
- **Red Flag system** — New `redFlags?: string[]` field on `ScanScenario` + `ItemScanSnapshot`. Dedicated `RED FLAG DETECTION — HARD RULE` section in Gemini prompt (separate from `authFlags`) detects all-over sublimation prints and AI-generated artwork on garments. Prompt uses aggressive "err on the side of flagging" language matching `isCustom` enforcement pattern. Initial attempt embedding AI detection in `authFlags` failed — Gemini ignored it alongside luxury brand checks. Separate field + hard rule fixed it.
- **Red Flag UI** — Non-collapsible `blush` banner with filled `flag` icon + `loss` accent in both `scan.tsx` and `detail.tsx`, placed above listing suggestions. Subtitle: "This item may be fake or use AI-generated artwork." Red circle + white flag badge on item cards in vault grid (`index.tsx`) for at-a-glance visibility.
- **`authFlags` reverted** — Back to luxury/designer-only criteria. AI print detection lives exclusively in `redFlags`.

### Session — 2026-04-21
- **Legal docs updated** — `terms.html` + `privacy-policy.html` now name "ThriftVault LLC", add TN governing law section, and disclose Sentry crash reporting. Privacy policy date corrected March → April 2026. **Still needs GH Pages push.**
- **`app.json`** — Added `minimumOsVersion: "15.1"` (matches Expo 54 + expo-camera floor). Icon is still a `.jpg` — Apple requires 1024×1024 PNG; needs manual export before submission.
- **`eas.json` created** — dev/preview/production profiles. Fill `ascAppId` + `appleTeamId` once Org account is live.
- **PaywallModal** — Added Restore Purchases button (Apple requirement; was missing). Added "Haul tracking & profit analytics" to features list. Fixed Season Pass period string (`/ 3 mo` → `/3 mo`). Switched features from `ScrollView` to `View`. Stacked period below price in plan cards to prevent text wrapping. Removed "Popular" badge from Season Pass (no data yet).
- **Profile screen** — "Upgrade to Pro" button moved from bottom of scroll to just below header (visible on load).
- **detail.tsx scan card** — Description (`sub`) now renders above handmade pill/prompt, matching scan.tsx order.

### Session — 2026-04-19
- **Sentry wired** (`_layout.tsx`, `app.json`) — `@sentry/react-native` installed, plugin added, `Sentry.wrap(RootLayout)` wraps root. `enabled: !!EXPO_PUBLIC_SENTRY_DSN` so it's inert until DSN is set. Full native crash reporting activates after prebuild (same session as RevenueCat). `metro.config.js` created with `unstable_enablePackageExports: true` to fix ESM resolution error.
- **Launch timeline** — Waiting on D-U-N-S (submitted 2026-04-17) before Org Apple Developer enrollment. Will not launch under individual account (LLC liability protection). Realistic target: early-to-mid May if D-U-N-S fast, late May otherwise.
- **Scan card expanded by default** (`detail.tsx`) — `useEffect` was overriding `useState(true)` with `fromScan === '1'`; fixed to always `true`.
- **Confidence label wired then removed** — added `getConfidencePresentation` label below insights header for low/medium; removed after user flagged awkward placement. Inline confidence text in header retained.
- **"AI Insights" → "Insights"** (`detail.tsx`) — cleaner label, AI implied by scan context.
- **Closet cards** — removed cost display (`Cost $X`) from item cards in Closet view.
- **Haul cards** — removed "spent" from caption line; caption now shows stores + profit only; conditionally hidden when both are empty to fix blank space under date.
- **Android readiness** — `ANDROID.md` created; assessed as not ready (missing package, versionCode, PNG adaptive icon, EAS config, Play account, RevenueCat Google Play). iOS-first launch confirmed.
- **Expo 54 longevity** — safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 ships and 54 is dropped from EAS.

### Session — 2026-04-17
- **Background scan fix** (`scan.tsx`) — removed `abortControllerRef.current?.abort()` from AppState background handler (was killing successful scans). Added `pendingRetryRef.current = false` before `setResult(geminiResult)` in both success paths.
- **`scanStatusPill` background** — `terraLight` invisible over dark camera overlay; fixed to `surface`.
- **Handmade auto-rescan removed** (`services/gemini.ts`) — was two sequential Gemini calls (~30s). Single-pass fix via prompt ("Your price output is final"). Scan time ~10s.
- **Price range commas** — switched to `formatMoney()` for four-figure ranges (`$600–$1,200`).

### Session — 2026-04-16
- **Slide-down modal animation fixes** — PaywallModal, scan history sheet, fullscreen image overlay: all use `animationType="none"` + manual `translateY` spring; dismiss animates to 700 then closes.
- **Item detail IA** — Status order unchanged (Date → Category → Store → Platform → Status → Notes). Status + Platform belong together.

### Session — 2026-04-15
- **Gemini 2.0 Flash retired** — `GEMINI_MODEL_FALLBACK` → `gemini-2.5-flash-lite`.
- **Claude Sonnet 4.5 wired** as third fallback in `callWithFallback`.

### Session — 2026-04-14
- **Jean pricing** — 6 denim brand tiers; `DENIM EXCEPTION` + post-process clamp in `runScanPipeline` ($140 ceiling, $25 floor).
- **Legal disclaimers** (`scan.tsx`, `detail.tsx`) — "AI estimates — actual resale and authenticity not guaranteed." TOS Sections 6–9 expanded. **Needs GH Pages push.**

### Session — 2026-04-13
- **`callWithFallback` shared helper** — non-overload errors fall through to next provider immediately. `isOverloadError` exported for "AI is busy" toast.
- **Flips/Closet scroll reset** — FlatList `key` includes `view` so tab switch mounts fresh list at top.

### Session — 2026-04-12
- **Sold-state zombie fixed** (`detail.tsx`) — sync `soldStr`/`resaleStr` at every programmatic write site.
- **Duplicate photos on rescan** — deduped by file size (`FileSystem.getInfoAsync`).

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md) — single source of truth for scoped todos and unscoped ideas.
