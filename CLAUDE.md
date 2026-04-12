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

### Session — 2026-04-12

- **Sold-state zombie bug fixed** — marking a flip sold via "Mark as Sold" (or via the status chip) wasn't updating Flips stats correctly. Root cause in `app/detail.tsx`: `saveAndBack` parsed the stale `soldStr` text-field (still `''` from initial mount) and overwrote the just-set `soldPrice` with `null`, leaving `status: 'sold'` + `soldPrice: null` — a zombie state the stats reducer skipped in both branches. Fix: sync the text-field strings at every programmatic write site — `handleMarkSold` sets `soldStr`, `confirmHandmade`/`rescanWrong` set `resaleStr` when ratcheting, and the 'sold' status chip's select/deselect path now mirrors `handleMarkSold` (defaults soldPrice to resale on select, clears both on deselect).
- **Invested = lifetime cost basis** — `app/(tabs)/index.tsx` stats reducer changed: `invested += paid` now runs for every flip regardless of status, so selling a $10 item for $20 leaves Invested at $10 and adds $10 to Profit. Previously invested dropped by `paid` on sell.
- **Duplicate photos on rescan fixed** — `updateExistingFromScan` in `app/(tabs)/scan.tsx` was merging photos with `existingPhotos.filter(uri => !newUris.includes(uri))`, which could never match because `persistPhotos` copies each staged photo to a freshly timestamped file in docDir. Rewrote to dedup staged photos by **file size** (via `FileSystem.getInfoAsync`) before persisting — against existing item photos AND against other staged photos. Dupes of existing photos get reused in the snapshot's `sourceImageUris` instead of re-persisted.
- **My Vault tab icon** — `components/CustomTabBar.tsx` changed from `folder-open` to `shirt` (Ionicons) to match the thrift/clothing context.

### Session — 2026-04-10

- **Handmade detection overhaul** — restructured `isCustom` prompt in `services/gemini.ts` to evaluate FIRST before other guidelines; added clothing-specific upcycle visual tells (mismatched seam thread, unexpected hem lengths, hardware mismatch, fabric grain direction, altered waistbands/collars/sleeves); flipped false-case logic to "confident factory-made only"; removed "be conservative with prices" which was suppressing detection.
- **Gemini output token budget doubled** — `MAX_OUTPUT_TOKENS` raised from 8192 to 16384; longer prompt was causing thinking tokens to exhaust output budget before JSON arrived, breaking handmade rescan.
- **Staged photo X button fix** — moved `overflow: hidden` from thumb container back to container (for image clipping); repositioned X badge to `top: 2, right: 2` so it sits inside the corner cleanly instead of floating awkwardly outside.
- **Dev error logging** — added `console.log` to handmade rescan and wrong-scan rescan catch blocks in `scan.tsx` for easier debugging.

### Session — 2026-04-09

- **Empty state redesign** — replaced bare icon+text with ghost card preview (2 skeleton item cards) in Flips/Closet empty state; shows new users what a populated vault looks like. New headlines: "Your first find is one scan away" (Flips), "Keep what you love in one place" (Closet). Hauls empty state: icon swapped to `bag-handle-outline`, headline updated to "Your haul history lives here". Filter empty state unchanged. All changes in `app/(tabs)/index.tsx`; new styles: `emptyGhostRow`, `emptyGhostCard`, `emptyGhostImg`, `emptyGhostLine`, `emptyGhostLineSm`.

### Session — 2026-04-07

- **Verify authenticity collapsed by default** — section was always-expanded on both scan card (`scan.tsx`) and item detail (`detail.tsx`); now collapses by default matching the upcycle ideas pattern. Added `authExpanded` state (default `false`) to both screens with chevron toggle.
- **Gemstone & fine jewelry pricing** — rewrote Gemini scan prompt (`services/gemini.ts`) to add 13 jewelry/gemstone-specific pricing tiers: costume jewelry ($5–$20), sterling silver ($15–$60), gold-filled ($20–$65), solid gold ($40–$200+), fine jewelry with diamonds ($80–$500+), precious gemstones ($60–$400+), platinum (+30–50%), designer jewelry houses like Tiffany/Cartier ($100–$2000+), accessible designer ($25–$120), estate/antique (+40–80%), celebrity collabs (+20–50%), and crystal-embellished clothing (+30–60% over brand base).
- **Jewelry suggestedPaid guidance** — added note that thrift stores underprice precious metals/stones; jewelry `suggestedPaid` can be $5–$100+ even when resale is high.
- **Platform context updated** — eBay now includes fine jewelry (GIA certs, brand boxes); Etsy now includes estate jewelry.
- **Jewelry auth flag examples** — added 3 jewelry-specific authenticity checks: hallmark stamps, stone inclusions (real vs. CZ/glass), and metal weight test.

### Session — 2026-04-06

- **Authenticity detection (detail.tsx)** — added "Verify authenticity" section to item detail AI Insights accordion, matching scan card pattern; shows `authFlags` from active snapshot between upcycle section and scan history button; uses `vintageBlueDark` color scheme with bullet rows.
- **Saved toast bug fixed** — `saveAndBack()` in `detail.tsx` was always showing "Saved" toast on back navigation even with no changes; now only calls `updateItem` and shows toast when `hasEdited` is true or prices actually changed.
- **Haul detail UX overhaul** — removed chevron arrow from list rows (trash was already rightmost); removed per-item delete buttons from both list and grid views (delete from item detail instead); status badge hidden in list view (72px image too small); resale price moved to right side of list row in green (`profit` color); grid footer shows green resale amount only (no "Resale" label); no cost shown in either view.
- **Scan state persistence** — confirmed already implemented: `tv_pending_scan` key persists result, stagedPhotos, placeholderImageUri, and prompt dismiss flags; restored on mount, cleared on any terminal action (Buy & Track, Add to Closet, Save for Later, Skip).
- **Expo version locked** — staying on Expo 54; cannot upgrade to 55 due to Expo Go version ceiling on iPhone 13.

### Session — 2026-04-05

- **Performance audit + fixes** — full app-wide performance review; all HIGH and MEDIUM issues resolved.
- **InventoryContext single-pass migration** — replaced 5 sequential `.map()` passes (intent, status, date, sanitize, activeSnapshot) with a single combined pass; eliminates 4 redundant full-array traversals on every load.
- **Stats single-pass** — replaced multi-filter `useMemo` in `index.tsx` with a single `for...of` loop computing `count`, `invested`, `profit`, and `active` in one pass.
- **Stable style references** — memoized `centeredContent` and `flatListStyle` in `index.tsx` to prevent new object references each render; removed inline style objects from JSX in `scan.tsx` and `detail.tsx`.
- **`resizeMode="cover"` audit** — added missing prop to all `<Image>` components across `index.tsx`, `scan.tsx`, and `detail.tsx` to prevent runtime scaling overhead.
- **`getItemPhotos()` helper** — extracted repeated 4x photo URI ternary in `detail.tsx` into a single top-of-file helper function; eliminates duplicate logic.
- **StyleSheet entries for inline styles** — moved inline `flexDirection: 'row'` wrappers and `recentImgPlaceholder` style into `StyleSheet.create` blocks in `scan.tsx` and `detail.tsx`.
- **TypeScript clean** — `npx tsc --noEmit` confirmed zero new errors introduced; only pre-existing `react-native-purchases` module errors remain (RevenueCat not yet installed).

### Session — 2026-04-04

- **Multi-photo scan UX fixes** — removed empty dotted placeholder square from staged strip (upload button is enough); cancel button during scanning now uses frosted glass pill matching design system; staged photo thumbnails hidden after scan completes (strip is pre-scan only); X button added to clear all staged photos; first selected photo is always the thumbnail; auto-scroll to top when result is cleared.
- **Camera = single-shot, library = multi-photo** — shutter now scans immediately on capture (no staging); upload button (library picker) is the only multi-photo path; removed upload button, staged counter, staged strip, and Scan pill from live camera overlay.
- **"Is this scan wrong?" dismiss persists to detail** — lifted `customDismissed` and `wrongScanDismissed` out of `ScanResultCard` into `ScanScreen`; on item creation, flags are written to `tv_prompt_dismissed_<id>` so detail screen loads with correct dismissed state.
- **Toast hugs text** — replaced `left: 40, right: 40` with `alignSelf: 'center'` + `maxWidth: 80%` in `Toast.tsx`.
- **Cost field UX fixes** — cost input auto-saves on back navigation (flushes `paidStr`/`resaleStr`/`soldStr` in `saveAndBack`); cost input auto-scrolls into view on focus using `measureLayout` against `mainScrollRef`.
- **Haul remove item** — per-item remove button in haul detail (list: `trash-outline` in terra; grid: frosted glass circle). Removes item from haul by clearing `item.date` — item stays in vault.
- **Improved scan pricing** — replaced vague pricing guidance with brand-tier benchmarks (fast fashion → luxury), platform-specific context (Depop/Poshmark/eBay/Etsy), trend premiums (+20–40%), and explicit "do not default to low end" instruction. Handmade pricing now uses labor-hours × hourly rate ($15–$25/hr) + materials + uniqueness premium instead of crude "2–4x materials" heuristic.
- **Upcycle prompt hardening** — banned bleach dye, tie-dye, cropping, patches, pins, generic embroidery. Added internal 4-question reasoning step (material, construction, era, trend) before writing ideas. Ideas must only be suggestable because of the specific photo.
- **Rescan bumps item to top** — `updateExistingFromScan` sets `updatedAt: Date.now()` on the item; flips/closet sort uses `updatedAt ?? id` so rescanned items float to top.
- **Scan price display fix** — scan card now shows midpoint (`$39`) as headline with range (`$25–$52`) as smaller secondary text, matching what gets saved as `item.resale` on the detail page.

### Session — 2026-04-03

- **Upcycle ideas improved** — rewrote both the inline `upcycle[]` instruction in `PROMPT` and the standalone `UPCYCLE_PROMPT` (now `buildUpcyclePrompt()`) to remove example technique lists (which caused Gemini to anchor and recycle the same 3 ideas). New prompts instruct Gemini to reason about the item's specific material, construction, and era before suggesting. Refresh uses temperature 0.9 for creative variety; main scan stays at 0.1. `refreshUpcycleIdeas()` now accepts optional `itemContext: { name?, category? }` so the model has text context alongside the image. Call sites in `scan.tsx` and `detail.tsx` pass item name/category on refresh.
- **Multi-photo scan** — users can now stage 1–3 photos of the same item before scanning. Selecting a photo no longer auto-triggers a scan; instead photos accumulate in a `stagedPhotos: string[]` array. A thumbnail strip appears in the camera box showing staged photos with remove buttons and a "Scan (N)" button. Counter badge shows "1/3", "2/3", "3/3". Camera stays open between captures for quick front/back/label shots. Library picker supports multi-select up to remaining slots. `scanWithGemini()` now accepts `string | string[]`; Gemini and OpenAI API calls receive all images as multiple `inline_data`/`image_url` parts in a single request. When >1 photo is provided, a multi-photo context suffix is injected. All staged photos are persisted to document directory and saved to `item.photos[]`. `ItemScanSnapshot` gains `sourceImageUris?: string[]` alongside the existing `sourceImageUri` for backward compat. `sanitizeSnapshot` updated to parse `sourceImageUris` and migrate old data.

### Session — 2026-04-02

- **Share button commented out** — removed from kebab menu until wired up. Added to Post-Launch in `MVP.md`.
- **RevenueCat setup guide** — `REVENUECAT_SETUP.md` created. Product IDs (`monthly`/`season`/`annual`) must match App Store Connect + RevenueCat.
- **Profile stats redesign** — Total Profit and Best Single Flip moved into "Your Stats" card. Upgrade to Pro button moved to bottom of page.
- **Dark mode** — warm background tokens (`#1F1B18`, `#292320`), stronger accent colors, unified badge contrast, switcher + chip active states all `vintageBlueDark`. Fullscreen photo overlay fixed to `#1A1A1A`. Handmade/wrong-scan prompt colors updated (`terraLight`/`mauveLight`).
- **Notes keyboard dismiss bug fixed** — keyboard now only dismisses on upward scroll; `keyboardDismissMode="none"`.
- **Flips sorted newest first** — `filtered` useMemo sorts by `id` desc.
- **UX audit** — `UX_AUDIT.md` created. Rating: 7/10.
- **Scan history modal redesigned** — bottom sheet with thumbnail, profit, confidence, Handmade pill per row. Swipe-to-dismiss via `PanResponder` on handle. Manual spring animation, no Modal lag.
- **Handmade pill full-width bug fixed** — wrapped in `flexDirection: 'row'` container in `detail.tsx` and `scan.tsx`.
- **Dismissed state persistence bug fixed** — `confirmHandmade` no longer clears `wrongScanDismissed` or AsyncStorage after rescan.
- **AI scan description removed from header** — `activeSnapshot.sub` redundant in nav header; shown in AI Insights section.

### Session — 2026-04-01

- **Handmade detection expanded** — 4 new `isCustom` categories: fiber arts (crochet/knit/macrame/tufting — always `true`), visible mending/sashiko (always `true`), leather/shoe customization, handmade jewelry. Client-side keyword fallback (`detectCustomFromText`) overrides Gemini false negatives using 40+ regex terms.
- **Rescan as handmade** — `rescanAsHandmade(photoUri, signal?)` in `gemini.ts` appends handmade hint, re-prices for labor/uniqueness. Prices ratchet up only (`Math.max` across low/high/resale — never decrease).
- **"Is this handmade?" prompt** — Yes/No buttons on both scan card and item detail insights when `isCustom` is false. Yes triggers `rescanAsHandmade`, updates name + price + snapshot. Spinner while rescanning.
- **"Is this scan wrong?" prompt** — Yes/No on both scan card and item detail insights. Yes triggers context-aware rescan (`rescanAsHandmade` if handmade confirmed, else `scanWithGemini`). Creates new snapshot, updates name and price. No dismisses.
- **Cancel scan** — `AbortController` threaded through all `gemini.ts` fetch calls. Cancel button below spinner aborts silently, clears photo, no error toast.
- **Rescan price ratchet on existing items** — `updateExistingFromScan` updates item name alongside price only when resale goes up.
- **Handmade pill in item detail** — Proper pill style (blush bg, terra text) matching scan card. Always visible in insights; toggles between pill and "Is this handmade?" prompt.
- **Delete scan** — Trash button at bottom of scan insights. Confirmation alert, falls back to next snapshot or hides insights if last.
- **Fullscreen photo chrome toggle** — Tapping photo hides/shows close button, count pill, and action bar. Resets to visible on open.
- **Fullscreen action bar** — Dark scrim behind buttons, icon-above-label layout, `minHeight: 64`, vertical divider before Delete, Delete tinted red.
- **Dot indicator sync** — `galleryScrollRef` on main carousel; scrolls to correct photo immediately when fullscreen closes, no stale dot delay.
- **Yes/No tap targets** — All handmade/wrong-scan prompt buttons: `minHeight: 36`, `paddingHorizontal: 18`, body-size text.
- **Upcycle suggestions** — Gemini returns 3 upcycle ideas per scan (technique + aesthetic, no platform mentions). Collapsible "Upcycle ideas" section on scan card and item detail insights, terra-colored, with refresh button (`reload-outline`) visible only when expanded. `refreshUpcycleIdeas()` in `gemini.ts` uses a lightweight focused prompt — not a full rescan.
- **Prompt dismissed state persisted** — "Is this handmade?" and "Is this scan wrong?" dismissed state saved to AsyncStorage per item (`tv_prompt_dismissed_<id>`). Cleared on rescan. "Is this handmade?" also auto-dismissed if any snapshot on the item has `isCustom: true`.
- **Hardcoded color audit** — Added `overlayWhiteStrong`, `overlayWhiteMid`, `overlayWhiteLight` tokens to `theme/colors.ts`. All hardcoded hex/rgba values replaced with theme tokens across `detail.tsx`, `scan.tsx`, and `+not-found.tsx`.
- **Scan card ordering fix** — "Is this scan wrong?" moved directly under "Is this handmade?". `pillRow` changed to `flexDirection: column`. Removed "Estimated resale range" hint text.

### Session — 2026-03-30

- **Handmade item detection expanded** — Gemini `isCustom` prompt expanded to 6-category visual checklist (hand-applied elements, dye work, structural rework, surface decoration, distressing, upcycling). Leans toward `true` when uncertain. Label renamed from "Custom / Reworked" to "Handmade".
- **GPT-4o-mini fallback** — OpenAI fallback when Gemini is overloaded. Gemini retries 2x with backoff first. Key: `EXPO_PUBLIC_OPENAI_API_KEY`.
- **Price range scan** — `suggestedResaleLow`/`suggestedResaleHigh` replace single estimate. Scan card shows `$X–$Y`; item creation uses midpoint.
- **"Paid" → "Cost"** — Covers both thrift buyers and custom makers. `paid: number | null` — new items default to `null`.
- **Theme token enforcement** — Added `vintageBlueLight`, `loss`, overlay, shadow tokens. Replaced all hardcoded colors app-wide.
- **UX polish** — Profit labels say `+$X profit`, icon-only frosted glass camera buttons, `hitSlop` on tab bar + upload button, toast width fix, notes keyboard scroll fix, previous scans button restyled as row.

### Session — 2026-03-28

- **Editable item names** — pencil icon on scan card and detail header toggles inline `TextInput` for renaming. Text still wraps; icon aligned flex-start.
- **Manual item add** — free users can add items without AI scan. Empty-state "Add manually" button + creates blank item with no preselected category/status/platform. Auto-focuses name field. If user backs out without editing, item is deleted (not saved).
- **AI scan paywall gating** — scan functions gated behind `isPro` check from `usePurchases`. `__DEV__` bypasses paywall for development.
- **App Store compliance fixes** — PaywallModal: Apple-required subscription disclosure + Privacy/Terms links. `terms.html` created. Privacy policy updated with RevenueCat disclosure. `app.json`: added `expo-image-picker` plugin, `buildNumber: "1"`, splash bg → `#F8F1E9`.
- **PaywallModal fixes** — selected plan card uses `surface` instead of `cream` (was invisible). Default plan changed from Season Pass to Monthly.
- **Gemini prompt improvements** — single most prominent item focus for multi-item photos, AI art/screenshot detection, bundle recommendation never says "not applicable".
- **Photo modal crash fix** — iOS modal dismiss race condition. Ref-based deferred action pattern: `pendingPhotoAction` ref stores choice, `onDismiss` fires it after full dismiss. Explicit permission requests added.
- **UX refinements** — platform/category/status chips now toggle-deselectable. Platform no longer preselected to Depop. Empty gallery is tappable. Removed "See all" from recents.
- **Profile additions** — Manage Subscription (Apple URL) and Send Feedback (mailto) settings rows.
- **Apple Developer Program** — $99/yr enrollment purchased, awaiting confirmation (up to 48hrs). Blocks RevenueCat + App Store submission.
- **Post-launch items added to MVP.md** — Android launch, landing page, social media, ASO, feedback channel, haul titles, affiliate links, platform filter.

### Session — 2026-03-26

- **Screenshots plan expanded** — SCREENSHOTS.md updated from 6 to 8 screenshots: Scan card, Scan screen, Flips, Flip item detail, Closet, Hauls, Profile, Onboarding. Haul grid view cut as redundant with Hauls.
- **App icon confirmed** — `assets/logo/thriftvault_logo.jpg` is already 1024×1024; checked off in MVP.md.
- **Privacy policy live** — GitHub Pages enabled at `https://chrisluhrsux.github.io/thriftvaultapp/`. Updated STORE_LISTING.md with live URL. Fixed fake `support@thriftvaultapp.com` → real `thriftvaultapp@gmail.com`. Checked off in MVP.md.

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
