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

### Session — 2026-04-15
- **Scan card section reorder** — both `scan.tsx` (scan result) and `detail.tsx` (AI Insights) now render in the order: Verify authenticity → Scan history → Upcycle ideas → Delete scan (scan.tsx has no history/delete). Previously upcycle came before auth.
- **Gemini 2.0 Flash fallback retired** (`services/gemini.ts`) — 2.0 Flash now returns `404: no longer available to new users`. Swapped `GEMINI_MODEL_FALLBACK` to `gemini-2.5-flash-lite` (still a different quota pool from `gemini-2.5-flash`, image-capable). Updated inline comment and the error string label (`Gemini 2.0:` → `Gemini 2.5 Lite:`).
- **RevenueCat readiness audit** — Apple Developer Program accepted, App Store Connect app created. Verified `hooks/usePurchases.ts` is fully wired (real SDK calls, not a stub) and `PaywallModal` calls `subscribe(activePlan.id)`. Code side is 100% ready. Remaining blockers are all dashboard/infrastructure: Paid Apps agreement (1–2 day process), 3 subscription products in App Store Connect, RevenueCat project + entitlement + offering, `npm install react-native-purchases`, `app.json` plugin, `.env` key, `npx expo prebuild`. Expo Go on iPhone 13 breaks permanently after prebuild — must switch to dev client or TestFlight.
- **`MVP.md` updated** — added a 9-step RevenueCat sequence under the blocking section with the Expo Go warning flagged on step 8.
- **Claude Sonnet 4.5 fallback wired** (`services/gemini.ts`) — added `callAnthropic()` using the Messages API (`https://api.anthropic.com/v1/messages`, `claude-sonnet-4-5`, `anthropic-version: 2023-06-01`). Inserted into `callWithFallback` after Gemini 2.5 Flash-Lite. Fallback chain is now **Gemini 2.5 Flash → Gemini 2.5 Flash-Lite → Claude Sonnet 4.5**. OpenAI/GPT-4o-mini branch removed entirely — `OPENAI_KEY`, `OPENAI_URL`, `callOpenAI()` all deleted; rationale: GPT-4o-mini vision is noticeably weaker than Gemini/Claude for brand-tag/fabric/hardware detail, and three providers is enough coverage. Estimated Claude fallback cost ~$0.017/scan (~$15–20 per 1,000 scans), only hit when both Gemini tiers fail. Key: `EXPO_PUBLIC_ANTHROPIC_API_KEY` in `.env`. Error string on total failure now reads `Gemini 2.5: ... | Gemini 2.5 Lite: ... | Claude Sonnet 4.5: ...`.

### Session — 2026-04-14
- **Jean pricing overhaul** (`services/gemini.ts`) — upcycled jeans were pricing $130–$390 (real comps $35–$110). Root cause: generic handmade labor formula applied to denim, where the market prices finished look not labor hours; `patchwork`/`visible mending` in the trending-handmade list compounded it.
- **Added 6 denim brand tiers** to the brand-tier block (mass-market, premium, Y2K, vintage Big E, luxury, unbranded) — previously Levi's/Wrangler/etc. had no tier at all.
- **`DENIM EXCEPTION`** block added to `PROMPT` and `HANDMADE_SUFFIX`: when `category === 'denim' && isCustom`, ignore labor formula, price by finished look ($25–$140 with $140 hard ceiling / $220 for vintage Big E or named creator). Trending-handmade boost explicitly disabled for denim.
- **Trending-handmade list cleaned**: removed `patchwork`, qualified `visible mending` to non-denim, added `tufting, punch needle` (those are genuinely *underpriced* by the old formula).
- **Post-process clamp** in `runScanPipeline` — belt-and-suspenders backstop. If `parsed.category === 'denim' && isCustom && resaleHigh > 140`: proportionally scales both ends down, floors low at $25. `resaleLow`/`resaleHigh` flipped from `const` to `let`.
- **`ALTERED FACTORY BASE EXCEPTION`** added to `PROMPT` and `HANDMADE_SUFFIX` — when a factory-made base (sneaker/hoodie/tee/jacket/bag/cap) has hand-added surface decoration (paint, patches, studs, embroidery) rather than from-scratch construction, ignore the labor-hour formula and price as `base brand tier + 30–60% customization premium`. Hard caps: painted sneakers $120 unbranded / $180 branded / $260 hyped silhouettes; altered hoodies $60/$90/$130; custom bags/caps $40/$80. Exception explicitly excludes genuine from-scratch handmade (crochet, knit, fiber art still use labor formula).
- **`CONDITION ADJUSTMENT`** added to `PROMPT` and `HANDMADE_SUFFIX` — applies to all items, handmade or factory. Reduces both low and high by 30–50% for visible damage (stains, non-decorative holes, heavy pilling, broken hardware, scuffed leather, tarnish); 15–25% for moderate wear; NWT commands top of range; unclear condition = no adjustment.
- **Brand hallucination bug fixed** — scanner was inventing brands on unbranded items by pattern-matching aesthetic (reported case: upcycled rhinestone flare jeans → falsely labeled "Vigoss"). Two fixes in `PROMPT`: (1) JSON schema template at line 25 changed from `"name": "Brand + Item Name"` to a version that makes brand conditional ("prepend brand ONLY if a label/logo/tag is visibly readable"); (2) old soft rule replaced with a `BRAND IN NAME — HARD RULE` requiring the model to be able to point to the specific region where a brand mark is visible, plus an explicit anti-inference clause and a `COMMON HALLUCINATION TRAPS` gallery (Y2K rhinestone flares ≠ Vigoss/Miss Me/Rock Revival, chunky sneakers ≠ Nike/Adidas, workwear ≠ Carhartt, etc.). Upcycled items explicitly don't inherit a guessed base-garment brand.
- **Gemini 2.0 Flash fallback added** (`services/gemini.ts`) — `callGemini` now takes a URL parameter; `callWithFallback` tries 2.5 Flash with overload retries, then 2.0 Flash once (separate quota pool), then OpenAI if keyed. A 2.5 overload no longer exhausts into a busy toast — 2.0 picks up. Error messages now carry all three provider causes.
- **Legal disclaimers wired in** — one-line fine print at bottom of scan result card (`scan.tsx`) and AI Insights accordion (`detail.tsx`): *"AI estimates — actual resale and authenticity not guaranteed"*. 10px mauve, centered, no box. `assets/terms.html` Section 6 (warranties) expanded to explicitly cover authenticity/counterfeit indicators; Section 7 (liability) expanded with four specific loss scenarios + "sole remedy = discontinue"; new Section 8 (no financial advice) and Section 9 (third-party brands/trademarks). **Live TOS needs a GH Pages push to update.**
- **Post-launch docs split** — scoped todos and unscoped ideas moved out of `MVP.md` and `CLAUDE.md` into `POST_LAUNCH.md` as the single source of truth. Scoped list re-sorted by post-launch impact (feedback channel / landing page / ASO / Android at the top, polish and tech debt at the bottom).
- **Post-Launch — only one remaining pathology:**
  1. **High ceilings ($500–$2000) lack an auth gate** — a misidentified "Tiffany-style" could still output $2000. Condition fix above covers most of the risk (a beat-up "luxury" now gets penalized); residual gap is Gemini hallucinating a brand on a pristine item. Lower priority than the other two.

### Session — 2026-04-13
- **Gemini scan provider hardening** (`services/gemini.ts`) — replaced duplicated retry loops in `runScanPipeline` and `refreshUpcycleIdeas` with shared `callWithFallback` helper. Key change: non-overload Gemini errors (e.g. 400, auth failures) now fall through to OpenAI immediately instead of throwing — previously only 429/503/529 triggered fallback. Final error includes both provider causes for diagnosis: `"All scan providers failed — Gemini: API 503: ... | OpenAI: key not configured"`.
- **Gemini retry delays increased** — 2s/4s → 3s/8s to give Gemini more breathing room during load spikes.
- **`isOverloadError` exported** — used in `scan.tsx` catch blocks to show `"AI is busy — try again in a moment"` toast specifically on 503/overload, vs generic "Couldn't rescan" for other failures.
- **OpenAI fallback not configured** — `EXPO_PUBLIC_OPENAI_API_KEY` is not set; Gemini is the only provider. When Gemini is overloaded the retry loop exhausts and users see the busy toast.
- **Flips/Closet shared scroll position fixed** (`index.tsx`) — switching between Flips and Closet kept the other tab's scroll offset because both rendered through a single `FlatList` whose `key` (`items-${numColumns}`) didn't include the active view. Fix: `key` now includes `view` (`items-${view}-${numColumns}`), so React mounts a fresh list (scrolled to top) on tab switch. Hauls was unaffected because it already renders a separate `FlatList`.

### Session — 2026-04-12
- **Sold-state zombie fixed** (`detail.tsx`) — `saveAndBack` parsed stale `soldStr` text-field and nulled `soldPrice` after "Mark as Sold", leaving `status: 'sold'` + `soldPrice: null` that stats reducer skipped. Fix: sync text-field strings (`soldStr`/`resaleStr`) at EVERY programmatic write site — `handleMarkSold`, `confirmHandmade`, `rescanWrong`, and `'sold'` status chip select/deselect.
- **Invested = lifetime cost basis** — stats reducer in `index.tsx` accumulates `invested += paid` for every flip regardless of status. Selling $10 → $20 leaves Invested $10, adds $10 Profit (previously invested dropped on sell).
- **Duplicate photos on rescan** — `updateExistingFromScan` dedupes staged photos by **file size** (`FileSystem.getInfoAsync`) against existing item photos AND other staged photos. Earlier `uri` filter never matched because `persistPhotos` copies to freshly timestamped file. Dupes reused in snapshot's `sourceImageUris`.
- **Hauls sort chips** — All/Recent/This month → Newest/Oldest sort-direction chips.
- **Post-launch tech debt** in `MVP.md`: (1) stock-count for makers/bulk sellers; (2) switch to `expo-image` to fix haul thumbnail reload on view-mode switch (ternary FlatList unmount at `index.tsx:619` causes RN `Image` to re-decode from disk on remount).

### Session — 2026-04-10
- **Handmade detection overhaul** — `services/gemini.ts` `isCustom` evaluates FIRST before other guidelines; added clothing upcycle visual tells (mismatched seam thread, unexpected hem lengths, hardware mismatch, fabric grain, altered waistbands/collars/sleeves); false-case flipped to "confident factory-made only"; removed "be conservative with prices" which was suppressing detection.
- **`MAX_OUTPUT_TOKENS` doubled** 8192 → 16384 — thinking tokens were exhausting output budget before JSON arrived, breaking handmade rescan.

### Session — 2026-04-09
- **Empty state redesign** (`index.tsx`) — Flips/Closet show ghost card preview (2 skeleton cards). Hauls icon → `bag-handle-outline`.

### Session — 2026-04-07
- **Authenticity section collapsed by default** on scan card + item detail, matching upcycle pattern.
- **Jewelry pricing tiers** — `services/gemini.ts` prompt got 13 jewelry/gemstone tiers (costume → sterling → gold-filled → solid gold → diamonds → precious stones → platinum → designer houses like Tiffany/Cartier → accessible designer → estate/antique → celebrity collabs → crystal-embellished clothing). Rule: thrift stores underprice precious metals/stones → jewelry `suggestedPaid` can be $5–$100+ even at high resale. eBay platform context adds fine jewelry (GIA certs, brand boxes); Etsy adds estate jewelry. Auth flags: hallmark stamps, stone inclusions, metal weight.

### Session — 2026-04-06
- **Authenticity section in item detail** — `detail.tsx` AI Insights accordion shows `authFlags` from active snapshot between upcycle and scan history.
- **Saved toast only fires on change** — `saveAndBack` gates `updateItem`/toast on `hasEdited` or price diff.
- **Haul detail UX** — no chevron, no per-item delete (delete from item detail instead), status badge hidden in list (72px too small), resale right-aligned in `profit` green. No cost shown.
- **Scan state persistence** — `tv_pending_scan` persists result + stagedPhotos + placeholderImageUri + dismiss flags; restored on mount, cleared on any terminal action (Buy & Track, Add to Closet, Save for Later, Skip).

### Session — 2026-04-05
- **Performance audit** — all HIGH/MEDIUM fixed. InventoryContext: 5 sequential `.map()` passes (intent, status, date, sanitize, activeSnapshot) → single combined pass on load. Stats: multi-filter `useMemo` in `index.tsx` → single `for...of` loop. Memoized `centeredContent`/`flatListStyle` refs in `index.tsx`. Added `resizeMode="cover"` to all `<Image>`. `getItemPhotos()` helper extracted in `detail.tsx`. `tsc --noEmit` clean (only pre-existing `react-native-purchases` errors remain).

### Session — 2026-04-04
- **Camera = single-shot, library = multi-photo** — shutter scans immediately on capture (no staging); library picker is the only multi-photo path. Staged strip visible pre-scan only. First selected photo is always thumbnail.
- **Prompt dismiss persists across item creation** — `customDismissed`/`wrongScanDismissed` lifted from `ScanResultCard` into `ScanScreen`; on item creation, flags written to `tv_prompt_dismissed_<id>` so detail screen loads with correct state.
- **Cost field auto-save** — `paidStr`/`resaleStr`/`soldStr` flushed on back in `saveAndBack`; auto-scrolls into view on focus via `measureLayout` against `mainScrollRef`.
- **Haul remove item** — clears `item.date`; item stays in vault.
- **Scan pricing** — brand-tier benchmarks (fast fashion → luxury), platform-specific context (Depop/Poshmark/eBay/Etsy), trend premiums (+20–40%), explicit "do not default to low end". Handmade pricing = labor-hours × $15–$25/hr + materials + uniqueness premium (replaced crude "2–4x materials" heuristic).
- **Upcycle prompt hardened** — banned bleach dye, tie-dye, cropping, patches, pins, generic embroidery. Internal 4-question reasoning step (material/construction/era/trend) before writing ideas.
- **Rescan bumps item to top** — `updateExistingFromScan` sets `updatedAt: Date.now()`; flips/closet sort uses `updatedAt ?? id`.
- **Scan price display** — headline = midpoint (`$39`), secondary = range (`$25–$52`), matching `item.resale` saved.

### Session — 2026-04-03
- **Upcycle prompt rewritten** — removed example technique lists from inline `PROMPT` and standalone `buildUpcyclePrompt()` (was causing Gemini to anchor and recycle same 3 ideas). Instructs reasoning over material/construction/era before suggesting. Refresh uses temperature 0.9 (scan stays 0.1). `refreshUpcycleIdeas()` accepts `itemContext: { name?, category? }` for text context alongside image.
- **Multi-photo scan foundation** — `scanWithGemini()` accepts `string | string[]`; Gemini + OpenAI APIs receive multiple `inline_data`/`image_url` parts in single request; multi-photo context suffix injected when >1. All staged photos persisted to doc dir → `item.photos[]`. `ItemScanSnapshot.sourceImageUris?: string[]` added alongside existing `sourceImageUri`; `sanitizeSnapshot` migrates old data.

### Session — 2026-04-02
- **RevenueCat setup guide** — `REVENUECAT_SETUP.md` created. Product IDs (`monthly`/`season`/`annual`) must match App Store Connect + RevenueCat.
- **Dark mode** — warm bg tokens (`#1F1B18`, `#292320`), stronger accents, unified badge contrast, switcher + chip active states all `vintageBlueDark`. Fullscreen photo overlay fixed `#1A1A1A`. Prompt colors → `terraLight`/`mauveLight`.
- **Notes keyboard** — dismisses only on upward scroll; `keyboardDismissMode="none"`.
- **Scan history modal** — bottom sheet with swipe-to-dismiss `PanResponder` on handle, manual spring animation (no Modal lag).
- **Flips sort** — by `id` desc (newest first).
- **UX audit** — `UX_AUDIT.md` created, 7/10.
- **Share button** commented out in kebab until wired up, logged in Post-Launch.
- **Profile** — Total Profit + Best Single Flip in "Your Stats" card; Upgrade to Pro at bottom.

### Session — 2026-04-01
- **Handmade categories expanded** — 4 new `isCustom` types: fiber arts (crochet/knit/macrame/tufting → always `true`), visible mending/sashiko (always `true`), leather/shoe custom, handmade jewelry. Client-side `detectCustomFromText` keyword fallback (40+ regex terms) overrides Gemini false negatives.
- **`rescanAsHandmade(photoUri, signal?)`** in `gemini.ts` appends handmade hint, re-prices for labor/uniqueness. Prices ratchet UP only (`Math.max` across low/high/resale — never decrease).
- **"Is this handmade?" / "Is this scan wrong?" prompts** — Yes/No on scan card + item detail when `isCustom` false. Yes triggers context-aware rescan (`rescanAsHandmade` if handmade confirmed, else `scanWithGemini`); creates new snapshot, updates name + price. Dismissed state persisted per item in `tv_prompt_dismissed_<id>`, cleared on rescan. "Is this handmade?" auto-dismissed if any snapshot on item has `isCustom: true`.
- **Cancel scan** — `AbortController` threaded through all `gemini.ts` fetch calls; aborts silently, no error toast.
- **Rescan ratchets existing items** — `updateExistingFromScan` updates name + price only when resale goes up.
- **Delete scan** — trash button in scan insights, falls back to next snapshot or hides if last.
- **Fullscreen photo overlay** — tap toggles chrome visibility. Action bar: icon-above-label, `minHeight: 64`, vertical divider before Delete, Delete tinted red.
- **Upcycle suggestions foundation** — Gemini returns 3 upcycle ideas per scan (technique + aesthetic, no platform mentions). Collapsible section on scan card + item detail, terra-colored. `refreshUpcycleIdeas()` uses focused prompt, not full rescan.
- **Hardcoded color audit** — `overlayWhiteStrong`/`Mid`/`Light` tokens added to `theme/colors.ts`; all hardcoded hex/rgba replaced in `detail.tsx`, `scan.tsx`, `+not-found.tsx`.

### Session — 2026-03-30
- **Handmade `isCustom` 6-category visual checklist** — hand-applied elements, dye work, structural rework, surface decoration, distressing, upcycling. Leans true when uncertain. Label: "Custom / Reworked" → "Handmade".
- **GPT-4o-mini fallback** — OpenAI when Gemini overloaded. Gemini retries 2x with backoff first. Key: `EXPO_PUBLIC_OPENAI_API_KEY`.
- **Price range scan** — `suggestedResaleLow`/`suggestedResaleHigh` replace single estimate; item creation uses midpoint.
- **"Paid" → "Cost"** — covers thrifters + makers. `paid: number | null`; new items default `null`.
- **Theme tokens added** — `vintageBlueLight`, `loss`, overlay, shadow. All hardcoded colors replaced app-wide.

### Session — 2026-03-28
- **Editable item names** — pencil icon on scan card + detail header toggles inline `TextInput`.
- **Manual item add** — free users can add items without scan. Empty-state "Add manually" creates blank item with no preselects. Auto-focuses name. If user backs out without editing, item is deleted (not saved).
- **AI scan paywall gating** — scan fns gated on `isPro` from `usePurchases`. `__DEV__` bypasses.
- **App Store compliance** — PaywallModal Apple-required subscription disclosure + Privacy/Terms links. `terms.html` created. `app.json`: `expo-image-picker` plugin, `buildNumber: "1"`, splash bg `#F8F1E9`.
- **Gemini prompt** — single most prominent item for multi-item photos, AI art/screenshot detection, bundle recommendation never says "not applicable".
- **Photo modal iOS crash fix** — modal dismiss race condition. Ref-based deferred pattern: `pendingPhotoAction` ref stores choice, `onDismiss` fires after full dismiss.
- **Chip toggle-deselect** — platform/category/status chips deselectable; platform no longer preselected to Depop.
- **Profile additions** — Manage Subscription (Apple URL) + Send Feedback (mailto) settings rows.
- **Apple Developer Program** — $99/yr enrolled 2026-03-28; blocks RevenueCat + App Store submission.

### Session — 2026-03-26
- **Privacy policy live** — GitHub Pages `https://chrisluhrsux.github.io/thriftvaultapp/`. Real support email `thriftvaultapp@gmail.com`.
- **App icon** — `assets/logo/thriftvault_logo.jpg` is 1024×1024.
- **Screenshots plan** — 8 in SCREENSHOTS.md: Scan card, Scan screen, Flips, Flip item detail, Closet, Hauls, Profile, Onboarding.

### Session — 2026-03-24
- **App Store compliance audit** — display name `thriftvaultapp` → `ThriftVault`. Removed: stub Notifications setting, phantom paywall features list, "thousands of users" onboarding copy, export data refs entirely. "Continue as Guest" → "Skip".
- **Privacy fixes** — camera permission string discloses Gemini transmission; privacy policy removed false "immediately discarded" claim (accurately: Google may retain per API terms).
- **Unsplash placeholder removed** — `DEFAULT_ITEM_PLACEHOLDER_IMAGE` = empty string (external URL was IP + reliability risk); camera icon UI handles gracefully.
- **Monetization pivot** — reversed 3/23 decision. $1.99 one-time unlock → **subscription model** (Monthly $4.99, Season Pass $9.99/3mo, Annual $29.99/yr). Rationale: thrifters profit significantly from app, recurring value justifies recurring revenue. Season Pass aligned to 3-month thrift cycles.
- **PaywallModal rebuilt** — 3-plan selector cards, Season Pass pre-selected "Popular", Annual "Best Value". CTA "Start Free Trial".
- **`hooks/usePurchases.ts`** — lazy-loads `react-native-purchases`, stubs gracefully if not installed (dev = `isPro: true`). `subscribe(planId)`, `restorePurchases()`, real-time entitlement listener. Wired into PaywallModal + profile Restore Purchases.
- **Restore Purchases** — Apple-required; profile settings row.
- **Haul detail default** — grid (was list).
- **Onboarding offline copy** — clarifies AI scan requires internet, everything else offline.

### Session — 2026-03-23
- **Gemini 2.5 Flash scan live** — `services/gemini.ts`; `EXPO_PUBLIC_GEMINI_API_KEY` in `.env` (gitignored). Returns name, category, price estimates, confidence, 3 flip suggestions. Replaced `DEMO_SCAN_SCENARIO`.
- **Low-confidence indicator** — terra banner "Low resale data — price manually." Gemini sets confidence based on brand recognition + resale comp availability.
- **Scan robustness** — handles Gemini 2.5 `thought` parts (skipped), `responseMimeType: 'application/json'`, `resolveReadableUri` for Android `content://`, MIME inference from extension.
- **Stale closure fix** — `runScan` guard uses `scanningRef` (not `scanning` state) to prevent second scan silent failure.
- **Seed items removed** — InventoryContext no longer loads `SEED_ITEMS`; new users start empty.
- **iPhone-only MVP** — `supportsTablet: false`, `bundleIdentifier`, `ITSAppUsesNonExemptEncryption: false` in `app.json`.
- **Store listing drafted** — `STORE_LISTING.md` with app name, subtitle, description, keywords.
- **`bottoms` category added** — pants/leggings/joggers/shorts (non-denim).
- **`ItemScanSnapshot` type added** — stores scan history per item (`scanSnapshots` + `activeScanSnapshotId` on `Item`).
- **Rejected approaches (with rationale)**: (1) **Item caps** — bad UX, leads to negative reviews. (2) **Bulk scan** — stacking multiple result cards is overwhelming; single-scan loop is right UX. (3) **Original free + $1.99 one-time** model (later reversed 3/24) — rationale was Gemini ~$0.0001/scan (10k ≈ $1), cost doesn't justify subscriptions; user fatigue with subscription tools.

### Session — 2026-03-22
- **`addItems(items: Item[])` bulk method** in `InventoryContext` — single AsyncStorage persist. Fixes race where N individual `addItem` calls in loop could drop items.
- **FlatList perf** — `initialNumToRender={12}`, `windowSize={5}`, `removeClippedSubviews` on items + hauls lists.
- **Security audit** — clean. Local-only, zero network calls (pre-Gemini), sanitization pipeline on AsyncStorage, file system limited to ImagePicker → doc directory.
- **Store picker modal** — preset chips (Goodwill, Salvation Army, Thrift Store, Savers, Plato's Closet) + "Other" input. Replaced `Alert.alert`. Keyboard dismisses on tap outside.
- **Add to Closet button** — multi-photo on Closet tab, uses `addItems` bulk.
- **Post-scan nav** — Buy & Track / Add to Closet push to `/detail?itemId=` with new item's ID (not stay on scan).
- **Haul detail grid/list toggle** — list default (changed to grid on 3/24).
- **Platform order** — Poshmark, Depop, eBay, Mercari, Facebook Marketplace, Vinted, Shopify (thrift reseller popularity).

### Session — 2026-03-21
- **iCloud backup warning** — one-time Alert on onboarding `finish()` after `AsyncStorage.setItem(ONBOARDING_KEY)`, before routing. Frames local storage positively ("works offline, no account") while warning uninstall = data loss.
- **ItemStatus simplified** — `'in-progress' | 'listed' | 'sold' | 'needs-work'` → `'unlisted' | 'listed' | 'sold'`. Flow: Unlisted → Listed → Sold.
- **Listed badge** — was yellow low-contrast (`#FDE68A`/`#F59E0B`); now `vintageBlueDark` bg + `onPrimary` white text.
- **WCAG color contrast audit** — all failures fixed in `theme/colors.ts`: teal darkened (vintageBlue #6B9E9A→#508C88, Dark→#3F7B77, Deep→#2E6A66); profit #7FA878→#4A7A44 (AA); terra #C97C5D→#8B4E30 (AA); mauve #9B8A8A→#706060 (AA). Light onPrimary stays #FAF8F5 (4.60:1 on vintageBlueDark). Dark onPrimary → #1C1B1F (6.83:1). Active chips use `vintageBlueDark` bg + `onPrimary` text.
- **Nav animation fix** — `onboarding` and `(tabs)` set `animation: 'none'` in `_layout.tsx` to prevent unintended slide on initial load.
- **Market research** — `UX Research/ThriftVault Market Research Report (Brutal).md`. Flippd = primary competitor; AI scan = #1 differentiator; local-only data = biggest liability.

### Session — 2026-03-11
- **Responsive design** — `hooks/useResponsive.ts` with Apple HIG breakpoints (phone <744px, tablet 744-1023px, tabletLarge >=1024px); returns `gridColumns` (2/3/4), padding/max-width, `isTablet`/`isTabletLarge`.
- **Multiple photos** — `Item.photos?: string[]` added; `img` always mirrors `photos[0]` for grid compat. Detail screen: paginated carousel, per-photo removal confirmation, fullscreen modal with "Set as cover".
- **Error states** — `scan.tsx` handles camera permission denied (inline + `Linking.openSettings()`) and capture failure (toast). `InventoryContext` logs storage write failures.
- **Hauls search** — searches `haul.date`, `haul.stores`, item names.

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md) — single source of truth for scoped todos and unscoped ideas.
