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

- **Apple Developer** — Individual enrollment active ($99/yr, enrolled 2026-03-28). D-U-N-S issued 145002422. Emailed Apple Developer Support 2026-04-26 requesting Individual → Organization conversion (used their dedicated category; 1–2 business day response). If Apple can convert in-place, new enrollment not needed. If not, must create new Apple ID + re-enroll as Org ($99/yr).
- **ThriftVault LLC** — Formed in TN ~2026-04-16, EIN issued. Chris signs as "Chris Luhrs, Member, ThriftVault LLC." Annual overhead: ~$400/yr TN ($300 annual report due April 1 + $100 min franchise) + 6.5% excise on net earnings. Legal docs: `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\`.
- **Pre-launch follow-ups:** (1) Push updated legal docs to GH Pages (LLC name + TN law + Sentry — done in code, not yet pushed). (2) Export 1024×1024 PNG icon; update three `app.json` icon/splash/favicon paths. (3) D-U-N-S → new Org Apple Developer enrollment; fill `ascAppId` + `appleTeamId` in `eas.json`.

### Session — 2026-04-28
- **Red flag yes/no prompt** (`types/inventory.ts`, `app/(tabs)/scan.tsx`, `app/detail.tsx`, `app/(tabs)/index.tsx`, `context/InventoryContext.tsx`) — User had no escape hatch when the AI red-flagged a real item. Added `promptRedFlagDismissed` + `redFlagDismissed` (transient, on `ScanScenario` only — not on `ItemScanSnapshot`, mirrors the `correction` field pattern). "Look fake to you?" Yes/No row inside the red-flag banner; tapping No drops the camera-box red border and renders the result as a normal scan card (we initially shipped a "Possibly fake — dismissed" pill, then ripped it — user wanted clean dismissal). Dismissal persists per-item via the existing `tv_prompt_dismissed_${id}` key with two new fields: `redFlagPrompt` (hides the prompt row) and `redFlagBanner` (collapses the banner). `sanitizeSnapshot` already extracts `redFlags`. Vault grid (`index.tsx`) reads all `tv_prompt_dismissed_${id}` keys via `AsyncStorage.multiGet` inside `useFocusEffect`; the resulting `redFlagDismissedIds` Set hides the red-flag badge on cards where `redFlagBanner: true`. Re-reads on tab focus so dismissals from detail screen show up immediately. Suppression of handmade/wrong-scan prompts now ties to `redFlagBannerActive = hasRedFlags && !redFlagDismissed` — collapsed banner unblocks those prompts again.
- **Live multi-photo scan** (`app/(tabs)/scan.tsx`) — `handleCapturePhoto` no longer auto-scans the first shot. Capturing now stages the photo (up to `MAX_STAGED_PHOTOS = 5`), keeps the camera live, light haptic per shot. New live-overlay layout: counter pill `N/5` top-left (reused dead style `stagedCounterPos` + `stagedCounterInner`), bottom row `[flip][shutter][scan]` — flip moved from `right: 20` → `left: 20`, new `cameraOverlayScan` at `right: 20`. Scan button only renders when `stagedPhotos.length > 0`. Auto-scan fires when count hits 5/5 via a `useEffect` watching `stagedPhotos.length` and calling `handleScanStagedRef.current()` to dodge stale closures (gated on `cameraActive`, `!result`, `!scanningRef.current` — only triggers from live mode, not library upload). Existing in-flight Cancel handles bailout. In-camera thumbnail strip was tried at `bottom: 90` but ripped — competed with shutter visually and most native camera apps don't show the roll while shooting. Counter alone communicates state. Static-mode `stagedStripOverlay` (visible when camera is closed) untouched, retains × buttons for management. Dead `stagedAddMore` and `stagedStripCamera` styles deleted.
- **Yes/No prompt haptics** (`app/(tabs)/scan.tsx`, `app/detail.tsx`) — `Haptics.selectionAsync()` (soft tick) on every Yes/No tap across handmade, wrong-scan, and red-flag prompts. Wrapped at the prop pass-through in scan.tsx (six handlers including the Yes-paths whose downstream rescan handlers also emit Light impact — selection tick fires synchronously, impact fires after the rescan kicks off). Inline on the six detail.tsx button onPress handlers.
- **Duplicate modal false positives** (`app/(tabs)/scan.tsx` `scoreItemAgainstResult`) — Modal was firing for "same category + same color, otherwise unrelated" items. Failure mode: garment-noun stop-wording shrinks names to 2–3 distinctive tokens, so a single color match (e.g. "red") produces `2.0 / 3.5 = 0.57` and the +0.10 colorMatch bonus pushes to 0.67, over the 0.55 threshold. Added a distinct-match floor: track `Set<string>` of matched tokens; if `matchedTokens.size < 2 && !brandMatch`, clamp final score to `DUPLICATE_BORDERLINE_MIN` (0.40). Below threshold but still inside the size-check fallback queue so a literal photo re-scan can still promote to 0.99. Brand match is the lone single-token override (Nike↔Nike inside the same category is highly distinctive). Sparse-token rescue floor at `aTokens.length <= 1 && bTokens.length <= 1` stays.
- **Red flag prompt false positives** (`services/gemini.ts`) — A real photo of a pink ruffled umbrella was triggering AI-GENERATED PHOTO. Tightened two clauses in the AI-PHOTO bullet list: (1) "Fabric texture that looks CG-rendered" now requires a SECOND artifact in the same image (smear, impossible shadow, edge bleed, or garbled environmental text) — saturated solid colors, smooth synthetic fabrics (satin/taffeta/polyester/vinyl), and uniformly-dyed garments alone no longer qualify. (2) Expanded the "do NOT flag based on garment" guard to explicitly enumerate radial/concentric symmetry, ruffles, pleating, smocking, accordion folds, fan/petal/flower silhouettes, voluminous tulle/taffeta layering, parasol/umbrella shapes — all real fashion design that the model was reading as "neural-network repetition."
- **Rescan "AI confident in prior price" toast removed** (`services/gemini.ts`, `types/inventory.ts`, `app/(tabs)/scan.tsx`, `app/detail.tsx`) — Ripped the entire `'same'` verdict path. User explicitly tapping "Wrong scan" then being told "AI confident in prior price" is bad UX, especially because the original price was often the wrong one they were challenging. `correction` type narrowed to `'lower' | 'higher'`. `runScanPipeline`: within the 5%/$2 noise tolerance the new (drifted) prices stand with no toast and no price-lock; outside tolerance fires the lower/higher toast as before. `RESCAN_CORRECTION_SUFFIX` prompt drops `'same'` from valid verdicts and tells the model to commit to a direction. `toastForCorrection` reduced to two cases.
- **Denim exceptional-construction override** (`services/gemini.ts`) — Default `$140` denim ceiling and `$180` handmade-top ceiling under-priced rare elaborate franken-construction (lattice/woven denim, sculpted halter/corset/bustier, deconstructed couture, quilted denim into new silhouettes — Etsy/Depop comps reach $150–$300). Considered raising the ceiling globally and removing it; both were wrong because Gemini has a track record of over-pricing once code-side caps are removed. Chose a narrow keyword-gated exception. Two-tier code clamp in `runScanPipeline`: `isExceptionalDenim = isCustomScan && isDenimBaseText && isExceptionalText`, where `isDenimBaseText` matches `\b(denim|jeans?)\b` and `isExceptionalText` matches `\b(lattice|woven|sculpt(ed|ural)|corset|bustier|halter|deconstructed|couture|frankenstein(ed)?|quilt(ed)?)\b` — both case-insensitive on `name + sub`. Both `denim` AND `tops` category clamps respect the override (cap 300 vs 140/180 default), so the AI's category choice doesn't matter — denim halter classified under `tops` still gets the override. Vocabulary in regex MIRRORS the prompt so prompt and clamp stay in sync; the prompt explicitly tells Gemini to use those exact words in `sub` to unlock the higher band. User-confirmed working: lattice denim halter now prices `$150–$250` (was capped at $85–$140).
- **Haul "Store for this haul" modal** (`app/haul-detail.tsx`) — Added Cancel button below Apply (tertiary style, mauve text, no background, `paddingVertical: sm`, `marginTop: sm`). Modal previously could only be dismissed via backdrop tap.

### Session — 2026-04-27
- **Duplicate detection rewrite** (`app/(tabs)/scan.tsx`) — Replaced overlap-coefficient name matcher with weighted multi-signal score. Token classes: brand (×3), color (×2), material (×1.5), multicolor/generic (×1). Bonuses: +0.15 brand match, +0.10 color match. Penalty: -0.30 color conflict (skipped if either side is multicolor/floral/striped — those are too noisy). Sparse-token rescue floor of 0.6 lets "Red T-Shirt"/"Red Cotton Tee" match. Threshold dropped 0.70 → 0.55 because the pool now includes `result.sub` and historical `scanSnapshots[].sub` (catches AI naming variance across rescans — the dominant failure mode behind "obvious duplicates not detected"). `handleDuplicateChoice` is now async — drops the 30-day age gate (sold-only filter remains), scores every non-sold item, falls back to chunked image-size match against `scanSnapshots[0].sourceImageUri` for borderline scores. Image-size hit auto-promotes to score 0.99 and overrides the category gate. Picker modal's `isOldOrSold` 90-day greying-out kept as defense-in-depth on the update side.
- **Altered halter top overpricing** (`services/gemini.ts`) — Mirror of 2026-04-26 pants fix. Halter/tank/crop/blouse/cami fell through to labor-hour formula + uniqueness + trending boost, hitting $225+. Updated `PROMPT` and `HANDMADE_SUFFIX` `ALTERED FACTORY BASE EXCEPTION` to enumerate "halter tops, tank tops, crop tops, blouses, camis" alongside hoodies/tees. Added `HANDMADE TOP CEILING` clause: $180 hard cap also applies to from-scratch crochet/knit/sewn handmade tops. Post-process clamp `isAlteredTop = parsed.category === 'tops' && isCustomScan` mirrors pants — $180 ceiling, $30 floor. Code clamp is the load-bearing fix; prompt-only ceilings have a track record of being ignored.
- **Wrong-scan rescan correction logic** (`services/gemini.ts`, `app/(tabs)/scan.tsx`, `app/detail.tsx`, `types/inventory.ts`) — Tapping "Wrong scan" used to blindly call Gemini with the same photo and no prior context, producing near-identical results. New `correction: 'lower' | 'higher' | 'same'` verdict system: rescan paths pass prior `ScanScenario` as a new optional arg to `scanWithGemini`/`rescanAsHandmade`; `RESCAN_CORRECTION_SUFFIX(prior)` packs prior name/sub/category/prices/confidence into the prompt with a re-examination checklist (brand, condition, era, material, category, custom). Post-process reconciliation in `runScanPipeline` after the existing clamps: derives actual direction from price delta with 5%/$2 noise tolerance, **forces prior prices when verdict is `'same'`** (prevents AI drift while claiming "no change"), trusts new prices on `'lower'`/`'higher'`, reconciles claimed-vs-actual mismatches by trusting prices over labels. Toasts: "AI lowered the price" / "AI raised the price" / "AI confident in prior price". `correction` is transient — added to `ScanScenario` only, NOT `ItemScanSnapshot`; detail.tsx builds new snapshots field-by-field so it doesn't leak into persistence. Detail also gained a `parseProfitRange` regex helper to recover low/high from the snapshot's formatted `profit` string since `ItemScanSnapshot` doesn't store raw price numbers.
- **Package version alignment** — Ran `npx expo install --fix` during a debugging session (turned out to be WiFi off, not packages). Net changes: `@sentry/react-native` 8.8.0 → ~7.2.0 (major downgrade — v8 has breaking native bridge changes for newer RN; v7 is what Expo 54 / RN 0.81.5 expects), plus patch bumps to `expo-image-picker`, `expo-linking`, `expo-web-browser`, `@react-navigation/native`. Bundle re-exports cleanly post-downgrade. Removes the startup compat warnings going forward.

### Session — 2026-04-26
- **Altered pants overpricing fix** (`services/gemini.ts`) — Hand-painted/applique pants returning $200–$400 because `ALTERED FACTORY BASE EXCEPTION` only listed hoodies/tees/jackets and bags/caps; pants fell through to jacket-tier pricing. Added pants tier in both main `PROMPT` and `HANDMADE_SUFFIX`: light paint $40–$70; skilled paint/dense applique $80–$140 unbranded / $100–$160 branded; hard ceiling $180. Also added post-process clamp in `runScanPipeline` (mirrors denim clamp pattern) — `isAlteredPants = category === 'bottoms' && isCustomScan && !isDenim`, scales down to $180/$40 if `resaleHigh > 180`. Code clamp matters because this codebase has a track record of Gemini ignoring prompt-only rules until backed by code (red flags, denim clamp).
- **Sticky-rescan bug — ratchets removed** (`app/(tabs)/scan.tsx`, `app/detail.tsx`) — Rescan flows used `Math.max(updated, prev)` and `newResale > item.resale` guards so an inflated initial scan could never be corrected by rescan. Even had a `// ratcheted prices` comment — intentional, but it defeated every clamp. Removed in 3 sites: `handleConfirmHandmade` in scan.tsx, `confirmHandmade` and `rescanWrong` in detail.tsx. User explicitly tapping "Yes handmade" or "Wrong scan" is a request for a fresh AI verdict; we now honor it (lower or higher).
- **Saved-for-later loses prompt dismissals** (`app/(tabs)/scan.tsx`) — Tapping "No" on handmade/wrong-scan prompts then saving for later, the prompts pop up again on reopen. `SavedScanItem` didn't carry the dismissal flags. Added `promptCustomDismissed?` and `promptWrongScanDismissed?` to type; `handleSaveForLater` snapshots both into the saved object; `openSavedItem` restores them. Items saved before this change still pop once.
- **Duplicate matching loosened — overlap coefficient + stop words** (`app/(tabs)/scan.tsx`) — Equal-sorted-token-sets was too strict; same item scanned twice with different AI names ("Red Petal Layered Black Lace" vs "Red Petal Skirt Black Lace One-Shoulder") never matched because token counts differed. New approach: `isSimilarName` uses overlap coefficient ≥ 70% (intersection / min set size) with ≥2 distinctive tokens both sides. Added `DUPLICATE_STOP_WORDS` set filtering generic garment nouns (dress, skirt, hoodie, jeans, etc.) + filler (and, with, the). Item TYPE is already disambiguated by category filter, so garment nouns are pure noise. Colors/brands/eras/style descriptors kept (distinguishing). Iteration history: 60% overlap (loose, false positives) → equal sorted sets (too strict) → Jaccard ≥ 70% (union punishes asymmetric counts) → overlap coefficient ≥ 70% with stop words (current). Trade-off accepted: same-category brand+color pairs ("Nike Red Hoodie" vs "Nike Red Jacket") may now prompt — annoying but recoverable via "Create New", whereas missed duplicates create dirty inventory.
- **Dark mode warmth pass** (`theme/colors.ts`) — Pushed all dark surfaces toward amber/Edison-bulb warmth. `cream` `#1F1B18` → `#211A14`, `surface` `#292320` → `#2C221A`, `surfaceVariant` `#342D28` → `#372C22`, `blush`/`blushDeep`/`lavender` shifted similarly, primary text `charcoal` `#E8E4E1` → `#EDE7DF` (warm ivory vs grey-white). Brand teal unchanged. Contrast ratios all stay ≥14:1 WCAG AA. Also held `vintageBlueDark` (`#3F7B77`) identical in both modes — barely clears 4.67:1 against `onPrimary`, so any darkening drops below AA.
- **Stats strip moved from Vault → Profile** (`app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`) — Removed Invested/Profit/Active strip from My Vault flips header. Profile already had Total Profit + Active Listings; added new "Total Invested" row at top of Your Stats section using `wallet-outline` icon. Cleaned up unused `stats` useMemo from index.tsx. Reasoning: stats are global metrics, not per-view filtered data — Profile is the right home for them.
- **Detail "Add photos" pill** (`app/detail.tsx`) — Replaced floating top-right camera-icon button on the gallery with a centered pill below the carousel: `surfaceVariant` background, `vintageBlueDark` icon + text, `radius.full`, height 34, matching the filter chip language. Iteration loop: dark overlay → frosted glass white → solid teal → frosted glass charcoal icon → frosted glass teal icon → solid teal → frosted glass — every variant fought with photo content. Final: pill below gallery means no overlay, no photo conflict, consistent with chip system.
- **Scan tap-to-fullscreen** (`app/(tabs)/scan.tsx`) — When a scan result is showing, tapping the camera box now opens a fullscreen photo viewer (fade Modal, swipeable pages for multi-photo scans, close button + tap-to-dismiss, `photoBackground` overlay). Mirrors the detail screen viewer minus edit actions. Added `photoViewerVisible` state, `useWindowDimensions`, four new styles. Disabled condition changed from `!!result || stagedPhotos.length > 0` to `!result && stagedPhotos.length > 0` so the box becomes tappable post-result.
- **Hauls empty state + Unlisted badge differentiation** (`app/(tabs)/index.tsx`) — Empty Hauls view now has an inline "New Haul" CTA button (matched Flips/Closet pattern). Unlisted badge background changed from same teal as Listed to `surfaceVariant` (warm grey) so the three states (Unlisted=grey, Listed=teal, Sold=green) are visually distinct in grid scan.
- **Apple Developer account conversion** — Emailed Apple Developer Support requesting Individual → Organization conversion (dedicated support category, 1–2 business day response). median.co article suggests this may be possible via support; awaiting confirmation. If they can convert in-place: no new Apple ID or re-enrollment needed. If not: new Apple ID + new Org enrollment ($99/yr) required.
- **UX_AUDIT.md refreshed** — 7/10 (2026-04-02) → 7.5/10 (2026-04-26). Added strengths: accessibility pass, safety/trust layer, scan history, full-screen viewer. Marked fixed: Hauls empty state, grid differentiation, dark mode warmth. Remaining unfixed weaknesses: generic onboarding, increased scan card density, profile depth, action discoverability.
- **Audit flagged but NOT fixed** — (1) Other altered base categories (skirts, shorts, dresses, swimsuits, non-sneaker shoes) have no caps in `ALTERED FACTORY BASE EXCEPTION` — could fall through same way pants did. (2) Open-ended "+" tiers (luxury $80–$500+, fine jewelry $100–$2000+, vintage Levi's $60–$250+, luxury denim $80–$400+). (3) No stacking guard between crystal/gemstone (+30–60%), trend (+20–40%), vintage (+30–60%), and 2× hyped low — can compound. (4) Trending-handmade boost is prompt-only excluded from denim/altered bases, no code enforcement. (5) Confidence not tied to range width. User chose pants-only scope; revisit if complaints surface.
- **POST_LAUNCH addition** — Added "Pottery & small craftsmanship price range accuracy" alongside existing "Furniture price range accuracy" entry. Same shape: clothing-tuned prompt mis-prices pottery/ceramics/glass/woodturning/metalwork, needs maker-tier block, signature/marks detection, ceramic-specific condition rules, and its own `POTTERY EXCEPTION` to prevent labor formula overpricing hobbyist mugs.

### Session — 2026-04-24
- **D-U-N-S issued — 145002422.** Unblocks new Apple Developer **Organization** enrollment for ThriftVault LLC. Next: create a separate Apple ID (cannot reuse the individual's), verify D&B name/address match the TN LLC registration exactly, then enroll Org at developer.apple.com/programs/enroll. Approval typically 1–3 business days after Apple's automated D-U-N-S lookup matches.
- **Red flag false positives on upcycled garments** (`services/gemini.ts`) — Patchwork/Frankenstein items (e.g. Nike panel + cherry-print panel hand-spliced) were being flagged as AI-generated photos or "all-over sublimation print" dropship. Three prompt fixes: (1) added `UPCYCLE EXEMPTION` block — if `isCustom = true`, garment "weirdness" alone cannot trigger any redFlag; (2) narrowed `ALL-OVER DIGITAL PRINT` to require pictorial content (tattoo flash, illustrations, photoreal art) and explicitly excluded classic textile repeats (cherry prints, ditzy florals, gingham, polka dots, paisleys, animal prints, monograms); (3) narrowed `AI-GENERATED PHOTO` — added "do not flag based on garment construction" guard, added "social media UI overlays" to the do-not-flag list, dropped the "err on the side of flagging" directive for this branch (still applies to AI-GENERATED ARTWORK only).
- **Strict duplicate matching for Buy & Track** (`app/(tabs)/scan.tsx`) — Old `isSimilarName` used 60% token overlap; "Nike Red Hoodie" matched "Nike Red Jacket" (false update prompt). Replaced with: exact normalized match OR (≥3 tokens both sides AND equal sorted token sets). `handleDuplicateChoice` filter tightened: category match now required (no `!result.category` escape), sold items excluded, items older than 30 days excluded (parsed via `new Date(item.date)`). When confidence is low, scan silently creates new instead of prompting.
- **Code cleanup pass** — Ran `tsc --noEmit --noUnusedLocals --noUnusedParameters` to surface dead code. Removed unused imports/locals across 7 files (`profile.tsx` `useRouter`+`router`, `detail.tsx` `getConfidencePresentation`, `haul-detail.tsx` `BlurView`, `Toast.tsx` `View`, `CustomTabBar.tsx` `descriptors`, `PaywallModal.tsx` `theme` prop on `PlanCard`, `theme/index.ts` `bg` param on `shadowsFor`). Deleted orphaned `constants/Colors.ts` + `components/Themed.tsx` (legacy Expo boilerplate, zero inbound refs). Held: `handleShare` (commented-out share button), `handleRemoveFromHaul` (haul UI not yet wired), `onPhaseChange` (scan progress hook), `server` param (platform variant signature). `tsconfig` flags **not** added — would break future scaffolding.
- **PaywallModal feature list** (`components/PaywallModal.tsx`) — Expanded FEATURES from 4 → 5 bullets to communicate value props the app actually ships: added "Counterfeit & scam alerts on every scan" (covers `authFlags` + `redFlags`) and re-worded the first bullet to lead with "Unlimited AI scans, pricing & unlimited vault" (anti-cap differentiator). Also removed duplicate `$4.99/mo` subtext from Monthly plan card (made `perMonth` optional in `PlanOption`); subtext now renders only on Season Pass and Annual where the effective $/mo differs from the headline price.

### Session — 2026-04-23
- **AI photo red flag detection** — Added third red flag condition to Gemini prompt: detects AI-generated photos (diffusion smearing, CG fabric texture, impossible shadows, bleeding edges, garbled environmental text, anatomical errors). Does NOT flag professional product photos, flat lays, model shots, or social media screenshots. Uses sentinel string `"stock-photo"` in `redFlags` to trigger banner without showing a bullet. UI filters `"stock-photo"` before rendering bullets in both `scan.tsx` and `detail.tsx`.
- **Red flag UX** — Banner moved to top of scan card (right after name/price/description). Yes/No prompts (handmade, wrong scan) suppressed when `hasRedFlags`. Red border on camera box via outer wrapper View (bypass `overflow:hidden`). Subtitle updated to "This item or photo may be fake or AI-generated."
- **Bug fix: rescan survives clear** — Clearing during an in-flight rescan now aborts the request immediately (`abortControllerRef.current?.abort()` in `clearResultAndPhoto`) and resets rescan flags. Both rescan handlers wire `AbortController` signal to API calls. Functional `setResult(prev => prev === null ? null : ...)` discards late-arriving results if already cleared.
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

### Compressed Sessions — 2026-04-12 to 2026-04-19
*Older than 7 days; full notes summarized below. Major decisions consolidated into "Key Decisions" above.*

- **Sentry + ESM fix (4/19)** — `@sentry/react-native` wired in `_layout.tsx` (`Sentry.wrap(RootLayout)`, `enabled: !!EXPO_PUBLIC_SENTRY_DSN` — inert until DSN set). `metro.config.js` created with `unstable_enablePackageExports: true` to fix Sentry's ESM resolution. Native crash reporting activates after prebuild.
- **Android readiness (4/19)** — `ANDROID.md` created; assessed as not ready (missing package, versionCode, PNG adaptive icon, EAS config, Play account, RevenueCat Google Play). iOS-first launch confirmed.
- **Expo 54 longevity (4/19)** — safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

- **Modal animation pattern (4/16)** — All slide-down modals (PaywallModal, scan history sheet, fullscreen image) use `animationType="none"` + manual `translateY` spring; dismiss animates to 700 then closes. Apply this pattern to any new sheet/modal.
- **Item detail IA locked (4/16)** — Field order: Date → Category → Store → Platform → Status → Notes. Status + Platform intentionally adjacent.
- **Background scan fix (4/17)** — Removed `abortControllerRef.current?.abort()` from AppState background handler (was killing successful scans mid-flight). `pendingRetryRef.current = false` set before `setResult(geminiResult)` in both success paths.
- **Handmade single-pass (4/17)** — Removed auto-rescan-as-handmade (two sequential Gemini calls, ~30s). Single-pass via prompt directive "Your price output is final." Scan time back to ~10s.
- **`callWithFallback` shared helper (4/13)** — Non-overload errors fall through to next provider immediately. `isOverloadError` exported for "AI is busy" toast. Used by Gemini → Gemini Flash-Lite → Claude Sonnet 4.5 chain (Sonnet 4.5 wired 4/15, Gemini 2.0 Flash retired same day).
- **Denim pricing system (4/14)** — 6 brand tiers in prompt; `DENIM EXCEPTION` block + post-process clamp in `runScanPipeline` ($140 ceiling, $25 floor). Pattern reused for altered-pants clamp (4/26).
- **Money formatting** — `formatMoney()` for 4-figure ranges (`$600–$1,200`) (4/17). `formatMoneyWithSign()` for profit display.
- **Sold-state zombie fix pattern (4/12)** — Sync `soldStr`/`resaleStr` string state at every programmatic write site in `detail.tsx`. Photo dedup on rescan via `FileSystem.getInfoAsync` size comparison.
- **FlatList scroll reset on tab switch (4/13)** — Include `view` in FlatList `key` so each tab mounts a fresh list at top.
- **Style fix (4/17)** — `scanStatusPill` background `terraLight` was invisible over dark camera overlay; switched to `surface`.
- **Legal disclaimers (4/14)** — "AI estimates — actual resale and authenticity not guaranteed" added in `scan.tsx`/`detail.tsx`. TOS Sections 6–9 expanded. **Still needs GH Pages push.**

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md) — single source of truth for scoped todos and unscoped ideas.
