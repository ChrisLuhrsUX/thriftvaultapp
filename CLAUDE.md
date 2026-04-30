# ThriftVault

## Project Overview

ThriftVault is a mobile-first thrift reselling app built with Expo + React Native. Thrifters can scan items, track inventory, and estimate resale profit. All data is local — no backend.

## Agent Safety

See [SAFETY.md](SAFETY.md) — never-run list, confirm-before list, and recovery playbooks. Hard enforcement in `.claude/settings.json`. The agent treats both as load-bearing.

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
- **Anti-counterfeit** — "Reselling this?" disclaimer on Verify authenticity blocks (`scan.tsx`, `detail.tsx`). TOS Section 4 prohibits counterfeit use; live on GH Pages.
- **Invested = lifetime cost basis** — stats reducer accumulates `invested += paid` for every item regardless of status (selling doesn't reduce invested).

### Business State

- **Apple Developer** — Individual enrollment active ($99/yr, enrolled 2026-03-28). D-U-N-S 145002422. Emailed Dev Support 2026-04-26 requesting Individual → Org conversion. They replied 2026-04-29 asking for founder confirmation, legal entity name in Roman chars, and D-U-N-S; Chris replied same day (sole founder, ThriftVault LLC, 145002422). Awaiting next step.
- **ThriftVault LLC** — Formed in TN ~2026-04-16, EIN issued. Chris signs as "Chris Luhrs, Member, ThriftVault LLC." Annual overhead: ~$400/yr TN ($300 annual report due April 1 + $100 min franchise) + 6.5% excise on net earnings. Legal docs: `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\`.
- **Pre-launch follow-ups:** (1) Export 1024×1024 PNG icon; update three `app.json` icon/splash/favicon paths. (2) D-U-N-S → new Org Apple Developer enrollment; fill `ascAppId` + `appleTeamId` in `eas.json`.

### Session — 2026-04-29
- **`ALTERED FACTORY BASE` clamps extended to 5 categories** (`services/gemini.ts`) — Mirrors 4/26 pants + 4/27 tops clamps. Ceilings: dresses $200, skirts $140, shorts $120, swimwear $120, non-sneaker shoes $200 (floors $40/$30/$25/$25/$40). Skirts/shorts/swimwear keyword-gated via name/sub regex (no enum value); non-sneaker shoes gate on `!isSneakerText` so prompt-only sneaker tiers ($120/$180/$260) survive. Dresses/skirts respect `isExceptionalDenim` for the $300 override. Mirrored tiers in `PROMPT` and `HANDMADE_SUFFIX` with unlock vocabulary that matches the regex.
- **Agent safety guardrails** (`.claude/settings.json`, `SAFETY.md`, `CLAUDE.md`) — Triggered by Cursor/Opus 4.6 prod-wipe incident. Three layers: (1) project-local `settings.json` hard-denies EAS prod ops, prebuild, force-push, hard-reset, clean -f, branch -D, cloud CLIs (gcloud/aws/fastlane/railway/heroku/firebase/supabase), DB CLIs (psql/mysql/mongo*/redis-cli/sqlite3), destructive migration ops (prisma migrate reset / db push --force-reset, sequelize db:drop / undo:all, knex rollback --all, drizzle-kit drop, typeorm schema:drop), and inline-Node bypass (`node -e` / `--eval` / `-p`); asks on EAS dev/preview ops, global npm installs, and non-destructive migration variants. (2) `SAFETY.md` (8 sections): never-list, ask-list, recovery playbooks (.env loss, force-push, bad submit, bad prebuild, DB/migration disaster, AsyncStorage.clear, bad OTA), code-level destructive patterns (the gap settings.json can't enforce), backup discipline, 5-step API key rotation. (3) CLAUDE.md pointer surfaces SAFETY.md every session. Settings load on session start, so smoke-test in a new session.
- **Ops docs** (`LAUNCH_OPS.md`, `DEV_OPS.md` — both new) — Solo launch playbook + release engineering ref. Source of truth for monitoring cadence, hotfix paths, version policy, secrets, smoke test, TestFlight flow.
- **Haul titles** (`context/InventoryContext.tsx`, `app/(tabs)/index.tsx`, `app/haul-detail.tsx`) — Optional per-haul title via side-car `tv_haul_titles: Record<string,string>` (date → title) since hauls are derived. Context API `haulTitles` + `setHaulTitle(date, title)`; 60-char cap; blank deletes. Cleanup hook in `removeItem` prunes when no items remain for a date. Pencil (`create-outline`) on haul-detail header opens modal reusing storeModal styles. Title-as-hero / date-as-subtext when set; date-as-hero when blank. Search matches title.

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

### Compressed Sessions — 2026-04-12 to 2026-04-26
*Older than 4 days; full notes summarized below. Major decisions consolidated into "Key Decisions" above.*

- **Altered pants overpricing fix (4/26)** — `services/gemini.ts`: pants tier added to `ALTERED FACTORY BASE EXCEPTION` (light paint $40–$70; skilled $80–$140 unbranded / $100–$160 branded; $180 ceiling). Code clamp in `runScanPipeline` (`isAlteredPants = bottoms && custom && !denim`). Pattern reused 4/27 (tops), 4/29 (5 categories).
- **Sticky-rescan ratchets removed (4/26)** — Removed `Math.max(updated, prev)` from `handleConfirmHandmade`/`confirmHandmade`/`rescanWrong` in scan.tsx + detail.tsx. User-initiated rescans now honor fresh AI verdicts (lower or higher); intentional ratchet was defeating every clamp.
- **Saved-for-later prompt dismissals (4/26)** — `SavedScanItem` gained `promptCustomDismissed?` + `promptWrongScanDismissed?`; `handleSaveForLater` snapshots, `openSavedItem` restores. Pre-fix saved items still pop once.
- **Dark mode warmth pass (4/26)** — `theme/colors.ts` shifted dark surfaces toward amber/Edison-bulb (cream/surface/surfaceVariant/blush/lavender), primary text → warm ivory `#EDE7DF`. Brand teal `vintageBlueDark` held — any darker drops below WCAG AA on `onPrimary`. All ratios stay ≥14:1.
- **Stats strip Vault → Profile (4/26)** — Removed Invested/Profit/Active strip from `app/(tabs)/index.tsx`; added Total Invested row to Profile. Reasoning: stats are global, not per-view filtered.
- **Detail "Add photos" pill (4/26)** — Pill below carousel (`surfaceVariant` bg, `vintageBlueDark` icon+text, height 34) beat every overlay-on-photo variant tried. Pattern: overlays fight photo content; chip-language pills below media don't.
- **Scan tap-to-fullscreen (4/26)** — Post-result, camera box opens swipeable fullscreen viewer (fade Modal). Disabled condition: `!result && stagedPhotos.length > 0` so box becomes tappable post-result.
- **Hauls empty + Unlisted badge (4/26)** — Inline "New Haul" CTA on empty Hauls view. Unlisted badge teal → `surfaceVariant` so Unlisted=grey, Listed=teal, Sold=green are visually distinct in grid scan.
- **UX_AUDIT 7.5/10 + flagged-not-fixed (4/26)** — Refreshed from 7/10 (4/02). 5 unfixed pricing risks flagged: (1) altered base categories beyond pants [fixed 4/29], (2) open-ended "+" tiers, (3) no stacking guard between crystal/trend/vintage/hyped boosts, (4) trending-handmade boost prompt-only excluded, (5) confidence not tied to range width.
- **POST_LAUNCH pottery entry (4/26)** — Added pottery/ceramics/glass/woodturning/metalwork pricing accuracy alongside furniture. Same shape: maker-tier block, signature/marks detection, ceramic condition rules, `POTTERY EXCEPTION` to prevent labor formula overpricing hobbyist mugs.
- **Red flag false positives on upcycled garments (4/24)** — `services/gemini.ts`: added `UPCYCLE EXEMPTION` (isCustom = true → garment weirdness alone can't redFlag). Narrowed `ALL-OVER DIGITAL PRINT` (requires pictorial; excludes classic textile repeats — cherry prints, gingham, paisleys, animal prints). Narrowed `AI-GENERATED PHOTO` (added construction guard, social media UI overlays exempt, dropped "err on the side of flagging" for this branch).
- **Code cleanup pass (4/24)** — `tsc --noEmit --noUnusedLocals --noUnusedParameters` surfaced dead code. Removed unused imports/locals across 7 files; deleted orphaned `constants/Colors.ts` + `components/Themed.tsx`. Held `handleShare`, `handleRemoveFromHaul`, `onPhaseChange`, `server` (still wired to future work). tsconfig flags NOT added — would break future scaffolding.
- **PaywallModal 5 features (4/24)** — Expanded 4 → 5 bullets, added "Counterfeit & scam alerts on every scan", led first bullet with "Unlimited AI scans, pricing & unlimited vault" (anti-cap differentiator). Removed duplicate `$4.99/mo` subtext from Monthly plan card.
- **Duplicate matching v1 strict (4/24)** — Replaced 60% overlap with exact match OR (≥3 tokens equal sorted sets) + category/sold/30-day filter. Loosened to overlap coefficient + stop words 4/26; rewritten as weighted multi-signal score 4/27.

- **Red Flag UX + persistence bugs (4/23)** — Added AI-photo detection as third red-flag condition (sentinel `"stock-photo"` in `redFlags` triggers banner without rendering a bullet; UI filters it). Banner moved to top of scan card, Yes/No prompts suppressed when `hasRedFlags`, red border on camera box via outer wrapper View. Persistence bugs fixed: `sanitizeSnapshot` was stripping `redFlags` on rehydrate; both rescan paths in detail.tsx were dropping `authFlags`+`redFlags`; rescan profit strings used raw template literals instead of `formatMoney()`. Rescan-survives-clear: `clearResultAndPhoto` now calls `abortControllerRef.current?.abort()`; functional `setResult` discards late results. Type safety: chip deselect changed from `'' as any` to `'other'`/`'unlisted'`. Accessibility labels pass: 37 → 169 attributes across 9 files (chips with `selected`, toggles with `expanded`, tab role on switcher, all camera/action/modal/legal-link controls).
- **Red Flag system inception (4/22)** — Added `redFlags?: string[]` field + dedicated `RED FLAG DETECTION — HARD RULE` prompt block (separate from `authFlags` after embedding-in-authFlags failed; Gemini ignored it alongside luxury checks). `blush` banner with `flag` icon in scan.tsx + detail.tsx; red badge on vault grid items. Heavily iterated 4/23–4/28.
- **Pre-launch compliance pass (4/21)** — Legal docs (`terms.html` + `privacy-policy.html`) updated for LLC + TN law + Sentry disclosure. `app.json` `minimumOsVersion: "15.1"`. `eas.json` created (dev/preview/production). PaywallModal: Restore Purchases added (Apple requirement), `/3 mo` formatting, "Popular" badge dropped, period stacked below price. Profile "Upgrade to Pro" moved above the fold.
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

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md) — single source of truth for scoped todos and unscoped ideas.
