# ThriftVault

## Project Overview

ThriftVault is a mobile-first thrift reselling app built with Expo + React Native. Thrifters can scan items, track inventory, and estimate resale profit. All data is local, no backend.

## Agent Safety

See [SAFETY.md](docs/SAFETY.md), never-run list, confirm-before list, and recovery playbooks. Hard enforcement in `.claude/settings.json`. The agent treats both as load-bearing.

## Tech Stack

- **Framework:** Expo 54, React 19.1, React Native 0.81.5
- **Language:** TypeScript 5.9
- **Routing:** Expo Router 6 (file-based)
- **State:** React Context API + AsyncStorage
- **Fonts:** Playfair Display (headings) + DM Sans (body) via `@expo-google-fonts`
- **Icons:** Expo Ionicons via `AppIcon.tsx`
- **No backend**, inventory is local; **Gemini** powers AI scan; paywall/export are partially stubbed until RevenueCat

## Dev Commands

```bash
cd C:\Users\Chris\Downloads\ThriftVault\thriftvaultapp
npx expo start --dev-client   # dev server, dev client on iPhone 13 auto-connects on same Wi-Fi
# w = web (still works for landing-page-style preview)
# native = open ThriftVault dev client on phone, NOT Expo Go (RC native module breaks Expo Go)
```

**Native changes** (new native dep, `app.json` plugin edits, icon swap) require a fresh dev-client build: `eas build --profile development --platform ios` → install via QR. JS-only changes hot-reload via Metro.

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
│       ├── index.tsx        # My Vault, inventory grid + search/filter
│       ├── scan.tsx         # Scan, Gemini AI scan + recent adds
│       └── profile.tsx      # Profile, stats, settings, upgrade button
├── components/              # CustomTabBar, AppIcon, Toast, PaywallModal, StatusBar, WebSidebar
├── context/                 # InventoryContext (tv_inv), ToastContext (2.6s auto-dismiss)
├── hooks/                   # useResponsive (Apple HIG breakpoints: phone <744 / tablet 744-1023 / tabletLarge ≥1024)
├── services/gemini.ts       # AI scan pipeline + prompt + clamps
├── theme/                   # index.ts, colors.ts, typography.ts
├── types/inventory.ts       # Item, ItemCategory, ItemStatus, Platform, ScanScenario
└── constants/               # seedItems, monetization (TRIAL_DURATION_DAYS), Colors (legacy)
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

- **InventoryContext**, inventory array, CRUD ops, auto-persists to AsyncStorage (`tv_inv`)
- **ToastContext**, ephemeral toast message, auto-dismisses after 2.6s
- **AsyncStorage keys:** `tv_inv` (inventory JSON), `tv_onboarding_done` ("1"), `tv_trial_started_at` (ISO date), `tv_haul_titles` (Record), `tv_prompt_dismissed_${id}`, pro unlock flag TBD with RevenueCat
- First launch starts with **empty inventory**; data is only what users add

## Design System (`theme/`)

### Colors

| Token | Value | Use |
| --- | --- | --- |
| `cream` | `#F8F1E9` | App background |
| `vintageBlue` / `vintageBlueDark` / `vintageBlueDeep` | logo fabric (#6B9E9A) | Primary UI: CTAs, tabs, active states |
| `profit` | green | Money: profit, sold, $ amounts |
| `terra` | `#C97C5D` | Secondary accent |
| `charcoal` | `#3C2F2F` | Primary text |
| `mauve` | `#9B8A8A` | Muted text |
| `lavender` | `#E8D9E0` | Light accent (e.g. dividers) |
| `surfaceVariant` | `#E8E2DC` | Inactive chip/pill background and borders (warm neutral, not purple) |
| `blush` | `#FFEFEF` | Light pink background |

### Typography

- Display (30px, PlayfairDisplay 700), page titles
- h1/h2, section headings
- body (15px, DMSans 400), main text
- caption (13px, DMSans 400), secondary text
- label (10px, DMSans 600), tags, badges

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

- Web / no-photo scan, shows a toast; scan requires a photo (Gemini on native with camera or library)
- Paywall, modal shows plans but `subscribe()` just shows a toast
- Notifications toggle, UI only

## Debug Tips

- Reset onboarding: `AsyncStorage.removeItem('tv_onboarding_done')` then reload
- Clear inventory: `AsyncStorage.removeItem('tv_inv')` then reload

## AI Scan, Chosen API

**Google Gemini Flash**, vision API for scan feature
- Free tier: ~1500 req/day, 15 RPM
- Cost after free tier: ~$0.075/1M tokens (~$0.0001 per scan / ~260 tokens in + ~100 tokens out)
- Key: get from [aistudio.google.com](https://aistudio.google.com)
- `scan.tsx` calls `scanWithGemini(photoUri)` when a photo is available

## Monetization Model

**Free 30-day trial → subscription (3 tiers)**

### Philosophy
- App exists to help thrifters make money, the app pays for itself
- Subscription justified by ongoing AI scan costs and continuous value delivery
- Season Pass is a unique hook for seasonal thrifters (Q4 holiday, back-to-school, etc.)

### Free trial
- **30-day trial**, **full Pro feature set** for `TRIAL_DURATION_DAYS` from trial start (unlimited AI scan, full vault, hauls, etc.). Not a limited "free tier" during trial. Trial start: when onboarding finishes or first app open; persist ISO timestamp in AsyncStorage.
- After trial ends → PaywallModal → pick a plan

### Subscription tiers
| Plan | Price | Effective $/mo | Notes |
|------|-------|----------------|-------|
| Monthly | $4.99/mo | $4.99 | Flexibility |
| Season Pass | $9.99/3 mo | $3.33 | Aligned to thrift seasons (3-month blocks) |
| Annual | $29.99/yr | $2.50 | Best value |

### Implementation (not yet built)
- RevenueCat / StoreKit for auto-renewable subscriptions
- Persist trial start (`tv_trial_started_at`) and/or rely on RevenueCat for entitlement
- PaywallModal when `now > trialStart + TRIAL_DURATION_DAYS` and no active subscription
- Restore Purchases button in profile settings (required by Apple)

## Session Notes

### Key Decisions (consolidated)

- **Scan UX**, Camera = single-shot (scans on capture); library = multi-photo. Camera also stages up to `MAX_STAGED_PHOTOS = 5` with `[flip][shutter][scan]` row + `N/5` counter; auto-scans at 5/5. Bulk scan and item caps both rejected (bad UX).
- **AI fallback chain**, Gemini 2.5 Flash → Gemini 2.5 Flash-Lite → Claude Sonnet 4.5 via shared `callWithFallback`. Non-overload errors fall through immediately. Keys: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_ANTHROPIC_API_KEY`. Claude fallback ~$0.017/scan; only when both Gemini tiers fail. Retry delays: 3s/8s.
- **Pricing clamps** (all in `services/gemini.ts` `runScanPipeline`), `DENIM EXCEPTION` ($140 ceiling, $25 floor; finished-look pricing); `ALTERED FACTORY BASE EXCEPTION` across pants/tops/dresses/skirts/shorts/swimwear/non-sneaker shoes (base tier + 30–60% premium, no labor formula); `HANDMADE SEWN-FABRIC TOP EXCEPTION` (sewn-fabric $25–$120; crochet/hand-knit/cottagecore $30–$180); `HANDMADE PANTS EXCEPTION` (sewn-fabric $30–$160; crochet/hand-knit/macrame $50–$220, TikTok-spiking); `isExceptionalDenim` override = $300 (matches `lattice|woven|sculpt|corset|bustier|halter|deconstructed|couture|frankenstein|quilt`); `BOOST STACKING` clamp (≥3 boost buckets and not luxury → per-category ceilings); `confidenceFromRangeWidth()` downgrades confidence when range >3.0× / >4.0×.
- **Prompt rules**, `BRAND IN NAME, HARD RULE` + `COMMON HALLUCINATION TRAPS` prevent brand invention; `RED FLAG DETECTION, HARD RULE` (separate from `authFlags`); `UPCYCLE EXEMPTION` (isCustom alone can't redFlag); `RESCAN_CORRECTION_SUFFIX(prior)` packs prior verdict for wrong-scan rescan; `Q2 2026 ACTIVE SPIKES` line; "knit" disambiguation requires `hand[-\s]?knit` or other handmade-craft signal to route to craft tier.
- **Tier-aware rounding**, `roundDisplayPrice()` in `utils/currency.ts`: <$200→$5, <$500→$10, <$1000→$25, ≥$1000→$50. Applied at source in `runScanPipeline`.
- **Money formatting**, `formatMoney()` for 4-figure ranges (`$600–$1,200`); `formatMoneyWithSign()` for profit display.
- **Before/After photo recognition**, Position-agnostic across staged 1–5 set. ≥1 "before" slot → `beforeAfterDetected: true` + forces `isCustom` + altered-base tier. On single-photo rescans, falls back to `priorResult?.beforeAfterDetected`. Persists on `ScanScenario` and `ItemScanSnapshot`. UI: pill alongside Handmade.
- **Red Flag system**, `redFlags?: string[]` field; sentinel `"stock-photo"` triggers banner without bullet (UI filters). `blush` banner with `flag` icon; red badge on vault grid. UI splits banner copy via `classifyRedFlags()` (`services/gemini.ts:54–74`): all-verification flags (PARTICLEBOARD MASQUERADE, HIDDEN ODOR, BEDBUG INDICATORS, STRUCTURAL DAMAGE prefixes) render teal "Worth verifying" + "Inspect in person before paying high prices." + single "Got it" dismiss; mixed or counterfeit flags keep red "Red Flags" + "may be fake or AI-generated." + Yes/No "Look fake to you?". Persists per-item via `tv_prompt_dismissed_${id}`.
- **Duplicate detection**, Weighted multi-signal score (brand×3, color×2, material×1.5, multicolor/generic×1; +0.15 brand, +0.10 color match, -0.30 color conflict). Threshold 0.60 (raised 5/15 from 0.55). Sparse-token rescue floor 0.6. `!brandMatch && matchedTokens.size < 3` clamps to 0.40 (tightened 5/08 from `< 2`; 2-token color+material overlaps were sailing through). Stop-words extended 5/15 with era markers (vintage/retro/y2k/2k/deadstock/og/90s/80s/70s/60s/2000s/nineties/eighties/seventies/sixties) and condition tokens (condition/used/nwt) so 3-token era+color generic overlaps no longer clear the floor. Image-size fallback against `scanSnapshots[0].sourceImageUri` auto-promotes to 0.99.
- **Rescan correction**, `correction: 'lower' | 'higher'` (no `'same'` toast). Within 5%/$2 tolerance no toast/no price-lock. Wrong-scan rescan updates `cat` from `result.category` (guarded against `'other'`). User rescans honor fresh AI verdicts (no `Math.max` ratchet).
- **iOS minimum = 15.1**, Expo 54 + expo-camera + expo-image-picker floor. Covers iPhone XS→16 Pro Max. Portrait-locked, no tablet.
- **Background scan**, iOS suspends network ~5–30s after backgrounding. AppState handler + `handleScanStaged` finally make the failure path *look* seamless (continuous spinner, no false toast, retry threads in on resume). Real fix is a `UIApplication.beginBackgroundTask` Expo native module, deferred to `POST_LAUNCH.md` (requires prebuild → ends Expo Go).
- **RevenueCat**, Code is 100% ready (`hooks/usePurchases.ts`, `PaywallModal`). Blockers all infrastructure: Paid Apps agreement, 3 ASC products, RevenueCat dashboard, `npm install react-native-purchases`, `app.json` plugin, `.env` key, `npx expo prebuild`. **Expo Go breaks permanently after prebuild**, switch to dev client. See `MVP.md` for 9-step sequence.
- **Sentry**, `@sentry/react-native` 7.2.0 wired in `_layout.tsx` (`Sentry.wrap(RootLayout)`, `enabled: !!EXPO_PUBLIC_SENTRY_DSN`, `sendDefaultPii: false` + breadcrumb redactor on `ui.input`/`ui.click`). `metro.config.js` has `unstable_enablePackageExports: true` for ESM. DSN live in `.env`; native crash reporting activates after prebuild. TestFlight cut from launch plan (insufficient tester pool).
- **Anti-counterfeit**, "Reselling this?" disclaimer on Verify authenticity blocks (`scan.tsx`, `detail.tsx`). TOS Section 4 prohibits counterfeit use; live on GH Pages.
- **Modal animation pattern**, All slide-down modals (PaywallModal, scan history sheet, fullscreen image) use `animationType="none"` + manual `translateY` spring; dismiss animates to 700 then closes.
- **Item detail IA**, Field order: Date → Category → Store → Platform → Status → Notes. Status + Platform intentionally adjacent.
- **Invested = lifetime cost basis**, stats reducer accumulates `invested += paid` for every item regardless of status (selling doesn't reduce invested).
- **Stats placement**, Total Invested on Profile; removed from Vault (stats are global, not per-view filtered).
- **FlatList scroll reset**, Include `view` in FlatList `key` so each tab mounts fresh at top.

### Business State

- **Apple Developer**, Organization enrollment active ($99/yr; officially migrated from Individual to Organization 5/21). D-U-N-S, team ID, account email tracked outside repo.
- **ThriftVault LLC**, Formed in TN, EIN issued. Annual overhead: ~$400/yr TN ($300 annual report + $100 min franchise) + 6.5% excise on net earnings. Legal docs tracked outside repo.
- **Pre-launch follow-ups:** (1) Export 1024×1024 PNG icon (current `thriftvault_logo_v2.png` is 834×836 with alpha + circular frame, fails App Store specs); update `app.json` icon/splash/Android adaptive/web favicon (4 paths). (2) Fill `ascAppId` + `appleTeamId` in `eas.json` with the new Org team ID.
- **Expo 54 longevity**, safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

### Session, 2026-05-29
- **GRAPHIC TEXT IN NAME HARD RULE shipped** (`services/gemini.ts`, ~50 prompt lines, commit `39c71a9`). Visible printed/embroidered slogans (song lyric / religious phrase / motivational / joke / political) on apparel must lead `name` field VERBATIM in double quotes, e.g. `"Jesus Take the Wheel" Graphic Raglan Tee`. Subordinates to BRAND IN NAME (brand wordmark first, slogan second when both present: `Levi's "Be Kind" Cropped Tee`). Cutoff/partial text: complete only if single-plausible-completion + recognizable phrase + high confidence; otherwise `"Visible Portion..."` ellipsis (acceptable: "Jesus Take the Whe" to "Wheel"; NOT acceptable: "Live Lau" to "Laugh" because Launch/Laundry/Laugh are all plausible). No artist/band/movie inference from slogans ("Jesus Take the Wheel" is NOT a Carrie Underwood Tee). Clear slogans are OPPOSITE of AI-art red flag (AI-art flag is misspellings/fused letters/nonsense). Edge cases: non-Latin scripts verbatim (no translation), back-only prints still lead name, multi-line collapse to single line with spaces, decorative gothic illegible fonts omit + note in sub, only large/focal text triggers rule (not pocket monograms). **Pattern lesson**: resale buyers search Depop/Poshmark on exact phrase strings; quoted lead makes the listing match those searches; an honest ellipsis beats a wrong completion.
- **Per-tier scan telemetry** (`services/gemini.ts`, `app/(tabs)/scan.tsx`, `app/detail.tsx`, commit `39c71a9`). New `AiTier` type exported (`'gemini-flash' | 'gemini-flash-lite' | 'claude-sonnet'`); new `onTier` callback wired through `callWithFallback` and out via `scanWithGemini` / `refreshUpcycleIdeas` / `rescanAsHandmade`. 7 scan-completion sites (primary, rescan_handmade, rescan_wrong, upcycle_refresh in scan.tsx; rescan_handmade_detail, rescan_wrong_detail, upcycle_refresh_detail in detail.tsx) now `Sentry.captureMessage('scan_completed', { tags: { tier, multi, scope }, extra: { duration_ms, photo_count, flow }})`. Primary scan failure path tagged same. Internal-only per `feedback_no_ai_provider_names` (telemetry exemption). Lets us measure tier hit-rates, mean duration per tier, and failure tier in Sentry dashboards without exposing provider names anywhere user-facing.
- **Scan timer UI** (`app/(tabs)/scan.tsx`, commit `39c71a9`). "Searching" loader text gained live elapsed counter ("Searching · 0:14"). New `elapsedSeconds` state ticks every 1s while `scanning === true`; tabular-nums + 40px right-side fixed-width prevents jitter. Mirrored in both camera + library render branches.
- **Profile profit-by-store "Not set" bug fix** (`app/(tabs)/profile.tsx`, commit `8c41665`). User reported "Not set" pinning as best store even after assigning a real store to a haul (which DID propagate to inventory via `updateItemsByDate`). Root cause: sort was pure `b.profit - a.profit` and "Not set" with multiple sold items always outranked single-sale named stores. Fix: extracted `NOT_SET_STORE_LABEL = 'Not set'` module constant, sort pins "Not set" bucket to bottom regardless of profit, hides "Best store" badge when row IS "Not set", new `namedStoreStats` filter gates the "You make more profit from X than Y" comparison copy and powers its strings so an unnamed store never shows in the ranking copy. Empty-stat placeholders also normalized (`,` to `formatMoney(0)` for Invested / `'None yet'` for Total Profit + Best Single Flip).
- **Haul thumbnail empty-slot placeholders** (`app/(tabs)/index.tsx`, commit `8c41665`). Rebuilt thumb grid so missing-image items still occupy their slot. Iteration changed from `thumbItems.filter(i => !!i.img).map(...)` to fixed `[0,1]` (2-up) / `[0,1,2,3]` (4-up) index map; missing-image slots render `surfaceVariant` placeholder cell with `images-outline` icon (24px for 2-up, 20px for 4-up). Solves the 2-find haul with one image previously rendering as a single image in a 2-cell grid (visual stutter).
- **Inventory flow polish** (`app/(tabs)/index.tsx`, `app/(tabs)/scan.tsx`, commit `8c41665`). Vault Hauls tab manual "New Haul" Button + empty-state action commented out (hauls auto-grouped only). "Scan with AI" CTA copy on 2 empty-state buttons demoted to "Scan" per `feedback_no_ai_provider_names`. `handleAddToCloset` route push dropped `manual: '1'` (was auto-removing the item on save-back if user didn't edit). Scan-to-closet commit (`commitDuplicate` in scan.tsx): when `pendingIntent === 'closet'`, fieldUpdates force `intent: 'closet' as const` + zero `resale` (was polluting closet items with scan's resale value).
- **detail.tsx state-leak + live-typing fixes** (`app/detail.tsx`, commit `8c41665`). (1) `hasEdited.current = false` + `priceInitialized.current = false` reset on `id` change (`useEffect([id])`) so prior-item flags don't leak into the next detail mount; (2) `update()` now sends delta to `updateItem(prev.id, updates)` instead of full `next` (no merge thrash through context); (3) `saveAndBack` commits pending name edit when `editingName` is true and trimmed value differs (was silently dropped on back-press); (4) `paidNum` / `paidEntered` derive from current `paidStr` via `paidFromInput`, so profit + ROI display update LIVE while typing instead of waiting for blur.
- **ASC metadata + screenshots uploaded**. Walked through every remaining ASC field: Description (verbatim from `STORE_LISTING.md`); Keywords 89 chars (`thrift,resell,reseller,flip,haul,poshmark,depop,ebay,inventory,tracker,profit,goodwill,scan`); Promo Text 165 chars; Support URL `https://thriftvaultapp.com/#contact`; Marketing URL `https://thriftvaultapp.com`; Version `1.0.0`; Copyright `2026 ThriftVault LLC` (no © symbol, ASC adds it); Routing App Coverage File blank (nav apps only); Content Rights = No (user photos + AI-generated text + nominative-fair-use brand names are NOT third-party content); Age Rating questionnaire all None across all 7 steps → 4+; Pricing & Availability US + Canada (Canada: zero added compliance, ~10% TAM bump, no French required for App Store listing in v1 because Quebec Bill 96 only triggers if you actively market in Quebec). DSA setup skipped (not selling in EU). All 5 screenshots uploaded via ParthJadhav skill (sibling folder), to ASC iOS App 1.0 → App Previews and Screenshots → 6.9" iPhone Display slot (auto-fills 6.5"/6.7"/6.3"/6.1"). Subtitle "Track flips, scan items, profit" (31 chars) FAILED ASC's 30-cap; swapped to **"Scan, flip, profit"** (18 chars), which mirrors the user journey and lets the app name carry the tracking implication. **Pattern lesson**: ASC subtitle cap is literal not soft; mirror-the-journey beat value-prop-trio because the app name (`ThriftVault: Scan to Flip`) already carries half the trio's meaning.
- **`eas.json cli.appVersionSource = "remote"`** (`eas.json`). Item 3 of LAUNCH_BLOCKERS Pre-production build done. Remote-managed version numbers, EAS server is source of truth. Items 4 (production EAS env vars incl. RC `test_` to `appl_` swap) and 5 (Sentry source-map config `SENTRY_ORG` + `SENTRY_PROJECT` + `SENTRY_AUTH_TOKEN`) remain user-side dashboard work.
- **Misc doc updates**. `docs/STORE_LISTING.md` screenshot #3 copy reverted from "Every trip, a *haul.*" to "Your thrift day, *remembered.*". `docs/POST_LAUNCH.md` background-scan item: removed prebuild-blocker note (prebuild already shipped 5/27); remaining work is the native module + a fresh EAS dev build for the native dep change. `docs/LAUNCH_BLOCKERS.md` Screenshots item marked done with note about ParthJadhav skill in sibling folder + 6.9" iPhone slot.

### Session, 2026-05-28
- **Landing site cleanups** (`index.html`, 2 pushed commits). Removed Facebook link from header nav (`eda11d3`). Moved TikTok icon from header nav to footer (`60a0ebd`): deleted `.header-socials` CSS + DOM block, added `.footer-socials` (36×36 circle, `cream-warm` hover bg) positioned between footer wordmark/tagline and the © / Terms / Privacy meta row. Header `topbar` grid stays `1fr auto 1fr`; right column is now empty but the centered nav stays centered because both 1fr columns size symmetrically regardless of content. Privacy/terms reviewed against shipped surfaces (Gemini→Claude fallback, RC, Sentry, AsyncStorage, LLC entity, "Last updated: May 2026"); no updates needed. AI provider names left in legal docs (overrides `feedback_no_ai_provider_names.md` for legal sub-processor disclosure context).
- **Doc directory reorg** (`docs/` NEW, commit `ed43118`, not pushed). `git mv` of 17 MD files from repo root into `docs/`. Renamed spaced `ThriftVault Sold-Price Research Q2 2026 Snapshot.md` → `docs/PRICING_RESEARCH_Q2_2026.md`. `CLAUDE.md` and `PRICING_TIERS.md` intentionally stayed at root: CLAUDE.md is auto-loaded by Claude Code from root, and PRICING_TIERS.md is consumed by the weekly drift-watch routine `trig_0113xK23HSeSpB46ySDYJtBF` via a `raw.githubusercontent.com` URL — moving would silently break the routine until its prompt is updated. CLAUDE.md's 2 internal links (`SAFETY.md`, `POST_LAUNCH.md`) repointed to `docs/`. Sibling links within `docs/` (e.g., `LAUNCH_OPS.md` → `POST_LAUNCH.md`) resolve unchanged because relative links resolve within the same folder. **Pattern lesson**: when reorganizing files consumed by external automated agents (Claude Code's CLAUDE.md auto-load, scheduled routines' WebFetch), leave the load-bearing files at the original path; only move docs that have no external consumers.
- **Localization scoped as post-launch growth item** (`docs/POST_LAUNCH.md`). New scoped item after Android launch: `expo-localization` + i18n-js or react-i18next, start with Spanish (largest US bilingual market) + Portuguese (Brazil's Vinted/Enjoei scene). Flagged load-bearing scan-output translation question: Gemini system prompt is English-only today; localized scan output requires either prompting per locale or post-translation. Tier labels, red-flag banner copy, and pricing-band text are also load-bearing surfaces. Scope: 2-3 weeks for framework + Spanish, incremental per language after.
- **Single-item-from-multi-photo refactor for non-scan add paths** (`app/(tabs)/index.tsx:575-669`). User flagged inconsistency: Add to Closet / Add to Haul with N picked photos created N separate items (one photo each); scan flow correctly creates 1 item with up to 5 staged photos. This hurts free (post-trial) users hardest because the manual add paths are their only entry. Refactored `createHaulItems` → `createItemFromAssets`: copies all picked URIs into `photos[]` on ONE `Item` with stable filenames `item_${id}_${i}.jpg` (no collision risk since `id = Date.now() + i` per-item became `id = Date.now()` once), calls `addItem(newItem)` once. Both call sites (`handleStorePickerConfirm` for Haul, `handleAddToCloset` for Closet) now `router.push('/detail?itemId=X&manual=1')` after creation, mirroring `handleManualAdd`'s pattern. Dropped success toasts (detail screen is the visual confirmation). Removed unused `addItems` from `useInventory()` destructure. Empty-state "Add manually" path unchanged (already correct). Scan flow unchanged. Followed plan-mode workflow (AskUserQuestion clarified scope to all 3 manual paths, not just Closet). **Pattern lesson**: the free-user segment (post-trial, locked out of AI scan) only has manual add paths; UX inconsistencies in those paths disproportionately hurt them. Check whether scan-flow-quality features have equivalents in the manual paths during any UX audit.
- **`BottomSheetModal` keyboard avoidance fix** (`components/BottomSheetModal.tsx`). User screenshot showed store-picker "Other" custom-input + "Add to Haul" button hidden behind iOS keyboard after tapping "Other" — sheet was anchored to screen bottom via `justifyContent: 'flex-end'` with zero keyboard awareness. Extracted overlay contents into `sheetContent` variable shared between desktop (`<View>` overlay, unchanged) and mobile (`<KeyboardAvoidingView>` overlay with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, Android handles soft input natively via `windowSoftInputMode`). Fixes every consumer of `BottomSheetModal`, not just the store picker. **Pattern lesson**: bottom-sheet patterns anchored to `flex-end` need explicit keyboard avoidance — the sheet does NOT auto-lift on focus.
- **`feedback_expo_tunnel_ngrok` memory saved** (`MEMORY.md`). `npx expo start --dev-client --tunnel` consistently throws `CommandError: TypeError: Cannot read properties of undefined (reading 'body')` with link to status.ngrok.com — status page reports green, reinstalling `@expo/ngrok` global + local both don't fix. Root cause: ngrok requires authtoken; without it, client gets unexpected response shape and crashes on `.body`. Misleading error (points at status page, not auth). Fix is 2 min: signup at dashboard.ngrok.com, copy authtoken, `npx ngrok config add-authtoken <TOKEN>`, retry tunnel. Chris explicitly ruled out Personal Hotspot workaround so memory says don't lead with it. **Pattern lesson**: when an error message points at an external status page and the status page is green, the local config/auth is the real culprit; don't waste cycles reinstalling.
- **Scan tab "Launching June" version tag commented out** (`app/(tabs)/scan.tsx:2135`).
- **`docs/LAUNCH_OPS.md` + `docs/DEV_OPS.md` restructured for post-prebuild current state**. Pre-launch infra section marked Apple Org / Sentry DSN / RC sandbox / first dev-client-build as done (refs 5/21, 5/26, 5/27); still-pending items kept: `eas.json` `ascAppId` + `appleTeamId`, 1024×1024 icon export, production EAS env vars incl. RC `test_` to `appl_` swap, Sentry source-map prod config (`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`), `cli.appVersionSource`. DEV_OPS Local-dev-workflow flipped so post-prebuild is the current state ("npx expo start --dev-client" is the daily loop, Expo Go references demoted). TestFlight section header gained "Skipped for v1.0" note; Release-flow step 5 swapped TestFlight smoke test for dev-client smoke test. RevenueCat sandbox smoke-test item tagged verified 2026-05-27.
- **`docs/STORE_LISTING.md` metadata fixes**. App name corrected to "ThriftVault: Scan to Flip" (matches ASC entry; previously read "ThriftVault, Thrift Tracker"). Category changed from Finance (wrong fit, Apple's Finance bucket is banking/budgeting/taxes) to "Shopping (primary), Business (secondary)" because Shopping pulls thrift-discovery searches and Business catches reseller side-hustle intent. Screenshot #3 swapped from Paywall to Hauls; new copy "Every trip, a *haul.*" / Group finds by shopping trip. ROI, photos, and totals per stop. Paywall in App Store screenshots is optional per Apple, and dropping it usually lifts install rate (people self-select against pricing too early). Added `haul` to keywords (now 87/100 chars); intentionally excluded `scan` because it's already in app name + subtitle which ASC indexes automatically.
- **`docs/SCREENSHOTS.md` merged into `docs/STORE_LISTING.md`, deleted**. Stale SCREENSHOTS.md (8 screenshots, 6.7"+6.5" sizes, utilitarian "Track Every Flip" copy) conflicted with the current 5-screenshot 6.9"-only brand-aligned approach. Merged still-useful Figma layout / typography / export-naming / tips into STORE_LISTING.md as a "Capture & compose pipeline" section. User deleted SCREENSHOTS.md manually (`rm` blocked by `.claude/settings.json` permission setup).
- **Screenshot pipeline pivot, Figma to `ParthJadhav/app-store-screenshots` skill**. Installed in NEW sibling folder `C:\Users\Chris\Downloads\ThriftVault\thriftvault-screenshots\` via `npx skills add ParthJadhav/app-store-screenshots`, NOT inside `thriftvaultapp/`, because the skill scaffolds a Next.js project in cwd and would dump on top of the RN app. Skill flow: scaffolds minimal Next.js with single `page.tsx` generator + bundled iPhone mockup PNG, asks brand context (colors / fonts / style / slide count), renders advertisement-style screenshots, exports all required iOS sizes (6.9" / 6.5" / 6.3" / 6.1") + Google Play matrix in one pass. Author's own app (Bloom Coffee) ships Apple-approved using this skill. `find-skills` meta-skill also installed for future skill discovery. Usage: open NEW Claude Code session rooted at `thriftvault-screenshots/`, feed brand prompt with cream / vintageBlue palette + Playfair / DMSans + the 5 copy lines from STORE_LISTING.md. **Pattern lesson 1**: third-party skills scaffold into cwd, so install + run them in a clean sibling folder, never the main app directory. **Pattern lesson 2**: code-based generators beat hand-Figma for marketing artifacts when copy/brand iterations are likely, because re-runs are cheap; manual Figma wins only when one-shot pixel control matters more than iteration speed.
- **TikTok carousel posted, "Would you walk past this at Goodwill?"**. 2-image format: (1) thrift item from Goodwill, (2) ThriftVault scan result with resale caption. Hashtags `#thriftflip #goodwillfinds #reseller #depopseller #goodwill`; user swapped initial `#wouldyouwearit` for `#goodwill` after volume research (engagement-bait tags with low volume underperform specific high-volume tags that match the hook). Item scanned in the video was from another TikTok user's haul, NOT Chris's own; for App Store screenshots Chris will scan from his own closet because Apple flags copyrighted/trademarked product imagery in marketing. Screenshot #1 hero recommendation: Levi's denim (universal brand recognition, $25 to $60 healthy range, no counterfeit drama). Luxury items saved for screenshot #4 red-flag banner where they make contextual sense.
- **`-e` shortcut added to `feedback_short_answer.md` memory**. Means "explain simply": plain language, define dev jargon inline, walk through concepts as if for a non-engineer; length is whatever the explanation needs. Memory description updated to list all three shortcuts (`-sa`, `-da`, `-e`).

### Session, 2026-05-27
- **First EAS dev client build successful** (`eas.json`, `app.json`). Installed eas-cli, registered iPhone 13 UDID via `eas device:create`, generated Apple distribution cert + provisioning profile, built via `eas build --profile development --platform ios`. First attempt failed on Sentry source-map upload (`An organization ID or slug is required`); fixed by adding `SENTRY_DISABLE_AUTO_UPLOAD=true` to `eas.json:development.env`. Second build succeeded; dev client installed via QR, cert trusted in VPN & Device Management, iOS Developer Mode toggled on (required for sideloaded apps on iOS 16+), Metro connected on port 8082 (8081 stale from earlier session). Schema fix during the same chain: moved `ios.minimumOsVersion` from `app.json:ios` (no longer a valid field in modern Expo schema) to `expo-build-properties.ios.deploymentTarget`. CLAUDE.md Dev Commands switched from `npx expo start` (Expo Go) to `npx expo start --dev-client`; memory saved at `project_dev_client_workflow`. **Pattern lesson 1**: Sentry's expo plugin auto-runs source-map upload as a post-bundle build step; with no org/project configured it fails the build, not just warns. For dev builds, env-flag the upload off (`SENTRY_DISABLE_AUTO_UPLOAD=true`); for production, set `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` as EAS env vars. **Pattern lesson 2**: Expo schema fields rotate over SDK versions; if a previously valid field starts triggering `expo doctor` failure, search Expo changelog for the migration target (here, `minimumOsVersion` to `expo-build-properties.ios.deploymentTarget`).
- **Sandbox purchase test, end-to-end** (`.env`, RC dashboard + ASC config, `hooks/usePurchases.ts`). Swapped `.env` from `test_` to `appl_` RC key, restarted Metro with `--clear`, hit a chain of config gaps. (1) RC's App Store storefront had zero products (only Test Store had them, from the 5/26 onboarding wizard); uploaded App Store Connect API Key (`AuthKey_*.p8`, App Manager role, principle of least privilege) at the app-config scope so RC could import. In-App Purchase Subscription Key was already uploaded but is a different file with a different prefix; first attempt dropped the wrong `.p8` and RC rejected with `Invalid file name`. (2) Three ASC products imported with status `READY_TO_SUBMIT`, fine for sandbox. (3) Wired App-Specific Shared Secret + Apple Server-to-Server Notification URL (`https://api.revenuecat.com/v1/incoming-webhooks/app_store`, set as both Production and Sandbox URLs in ASC App Info). (4) `pro` entitlement was actually named `ThriftVault Pro` (with space + capitals); code in `hooks/usePurchases.ts` checked `info.entitlements.active['pro']` and always returned false. Replaced with a `PRO_ENTITLEMENT_ID = 'ThriftVault Pro'` constant. (5) Packages in `default` offering each had only the Test Store product wired; added the App Store product to each via Edit dialog (Monthly to `monthly`, Season Pass to `three_month`, Annual to `annual`, with the ASC product ID `annual` vs RC package identifier `yearly` asymmetry from 5/26 in play). After all that: real StoreKit sandbox purchase flow worked (`chrisluhrsdesign+sandbox@gmail.com`), receipt POST returned 200, RC dashboard reflected the active subscription, Pro UI flipped. **Pattern lesson 1**: RC's onboarding wizard creates Test Store products that are NOT auto-mirrored to the App Store storefront; products + entitlements + offering-package wiring must be redone for the App Store side, twice the work. **Pattern lesson 2**: RC entitlement identifier is locked at creation and uses whatever was typed in the wizard (`ThriftVault Pro`, not `pro`); document the exact string in a code constant because every `info.entitlements.active['<key>']` check depends on it. **Pattern lesson 3**: Apple sandbox compresses 30-day trials to ~3 minutes, so the `periodType === 'TRIAL'` branch in the Pro card UI is hard to visually verify; trust the code path and skip the sandbox verify on that branch.
- **`usePurchases` module-scoped state + AsyncStorage snapshot cache + Profile Pro card UI** (`hooks/usePurchases.ts`, `app/(tabs)/profile.tsx`, `components/PaywallModal.tsx`). Three issues compounded. (a) Each `usePurchases()` callsite (Profile, scan, PaywallModal) had its own `useState` for `isPro`, so post-purchase state only updated locally; refactored to module-scoped `_entitlement` + `_subscribers` set, RC configured exactly once, single `addCustomerInfoUpdateListener` shared across mounted consumers via a force-update trigger. (b) Full entitlement snapshot cached to AsyncStorage as JSON under `tv_is_pro` (key kept from old boolean-only cache); `_deserializeEntitlement` rejects non-object values so old `'1'`/`'0'` cached values fall through to the RC fetch instead of mishydrating. Eliminates the flicker through `Pro · Active` to `Monthly · Renews [date]` on cold launch. (c) Profile renders a Pro card when `isPro` is true: `formatProSubtitle()` returns `Free trial · Ends [date]` / `Monthly · $4.99 · Renews [date]` / `Monthly · $4.99 · Cancels [date]` depending on `periodType` and `willRenew`. Card tap deep-links to `https://apps.apple.com/account/subscriptions`. Settings rows filter out `subscription` when Pro and `manage` when not Pro. PaywallModal welcome toast gated on `!result.alreadyActive` so re-tapping a plan you already own closes the sheet silently. Render gated on `!purchasesLoading` to prevent the upgrade-button flash before AsyncStorage hydration completes. **Pattern lesson 1**: when multiple components call the same hook and the hook owns shared external state (RC entitlement), the natural reach for per-instance `useState` leaks; module-scoped state + subscriber set + force-update is the right shape. Lifting to React Context also works but adds a provider in `_layout.tsx`. **Pattern lesson 2**: cache the FULL snapshot, not just a boolean. Boolean-cached `isPro` flickers the Pro card through intermediate states on every launch because the cached state lacks the detail fields. **Pattern lesson 3**: defensive `_deserialize` that rejects unexpected shapes lets old cache schemas fall through without crashing hydration.
- **LAUNCH_BLOCKERS restructure** (`LAUNCH_BLOCKERS.md`). Marked First EAS dev client build + Run sandbox purchase test as done with incident detail inline. New **Pre-production build** section between Post-prebuild and Submit, with 3 items: (1) Set `cli.appVersionSource` in `eas.json` (currently unset, EAS warning today, required in a future release; pick `remote` or `local`); (2) Upload `.env` keys to EAS Environment Variables for production scope incl. the `test_` to `appl_` RC swap per `project_rc_test_key_swap` memory; (3) Configure Sentry source-map upload for production (`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` as EAS env vars on production profile). Share-as-image card moved from Post-prebuild to POST_LAUNCH.md (cosmetic polish, not launch-blocking).
- **App Store screenshot copy + Apple-Review-safe hedging** (`STORE_LISTING.md`). 5 screenshot copy drafts with Playfair-emphasis headline + DM Sans subhead: (1) scan result hero "Snap a tag. See the *flip.*"; (2) vault grid "Every find, *tracked.*"; (3) paywall "30 days *free.*"; (4) red-flag banner "Catch the *red flags.*" (hedged from initial "Spot fakes *before* you pay." which would be false advertising under Apple App Review rules, since the classifier raises flags but doesn't guarantee catching every fake); (5) profile stats "Numbers that make it *worth it.*". Capture pipeline noted: native iPhone 13 1170×2532 upscale ~1.13× in Figma to 1320×2868 (6.9" iPhone target, ASC auto-scales down). **Pattern lesson**: screenshot headlines that promise certainty (`Spot fakes`, `Detect counterfeits`) are App Review rejection bait; hedge to feature-accurate language (`Catch the red flags`, `A heads-up`) that mirrors what the app actually does.
- **Sentry GitHub App permission upgrade denied**. Sentry requested upgrade from read-only Contents to read + write Contents to enable Seer (their AI bug-fix agent) to open PRs. Denied. Same threat model as the 5/25 main-branch ruleset: AI-agent write access to repo contents is the exact attack surface the ruleset was set up to guard against. Sentry retains read-only; source-link, suspect commits, release tracking continue working. Revisit post-launch if Seer's value warrants the surface area.
- **TikTok marketing prompt drafted, saved to `tiktok.md`**. Wrote prompt for Claude for Chrome to research 10 viral photo-carousel TikTok ideas for ThriftVault in the reseller / side-hustle-thrifter niche with proof URLs and view counts from live browsing. First response returned format-level reasoning only (no actual browser nav, no real URLs, no @thriftvaultapp audit) despite explicit instructions; drafted follow-up prompt that forces step-by-step browser nav with stop conditions if browsing isn't enabled. Strategy itself is sound (shift from product-led "look what the app found" to audience-led "would you have flipped this?", serialize 3 anchor formats over 2 weeks instead of one-per-day) but needs verification before scaling. **Pattern lesson**: Claude for Chrome can return strategy-grade output without actually browsing if the prompt allows wiggle room; explicit "open URL X first, return view counts, stop if blocked" instructions are the discipline that forces real navigation.
- **Furniture form disambiguation HARD RULES added to `services/gemini.ts` FURNITURE PRICING block** (lines 518–665, +~250 prompt lines). Three new blocks: TABLE TYPE (7 forms coffee/end-side/nightstand/console/dining/counter/bar, height + room-context routing, Saarinen Tulip variant split into Side $400–$1200 / Coffee 36"-round $800–$1800 / Dining $1500–$3500, SIZE PENALTY length thresholds), CHAIR TYPE (3 binary tells wheels+gas-lift=office / mechanism=recliner / runners=rocker, 13 forms, Eames Lounge replica $200–$600 unrestored / $700 refurb as single carve-out exception to unattributed MCM $80–$300/$450 cap, Aeron Classic $300–$700 vs Remastered $500–$1400 split, AERON + EAMES LOUNGE authentication mini-rules, 4 worked examples), DESK TYPE (6 binary tells tambour=roll-top / drop-front+hutch=secretary / angled=drafting / adjustable base=standing / keyboard tray or monitor cutout=computer / mirror frame=vanity, 10 forms, 2 worked examples). Line 480 MCM authenticated tier extended with Papa Bear / PK22 / Womb / Egg / Swan / Series 7 / DSW/DSR/DCM / Aluminum Group / Pollock Executive / Bertoia / Emeco 1006 + new Modern ergonomic office subtier (HM Aeron/Embody, Vitra Cosm, Steelcase Leap V2/Gesture). Line 286 category guidance lists all table+chair+desk forms with per-category routing pointers. All bands anchor to existing FURNITURE PRICING platforms (FB Marketplace, Chairish, 1stDibs, Craigslist, eBay, AptDeco, OfferUp); no new buyer marketplaces. **Pattern lesson 1**: Plan-agent critique caught shipped-quality errors I'd have shipped solo (dining seat height 17–19" not 18–20", Noguchi/Nakashima MCM coffee $400–$3000+ not $300–$2000, Saarinen Tulip needs explicit variant split, Grailed is NOT an office-chair marketplace). **Pattern lesson 2**: free-form `name` field carries the subtype signal across all three furniture categories; no `tableForm` / `chairForm` / `deskForm` enum changes in `types/inventory.ts` needed. The model writes "Coffee Table" / "Office Chair" / "Roll-Top Desk" in `name` and that's the routing surface.
- **Drop-leaf coffee-table misclassification fix** (`services/gemini.ts:545–550`, 3 clause additions to existing TABLE TYPE DISAMBIGUATION ROUTING RULES list). User scanned a refurbished Ethan Allen oval drop-leaf coffee table; scan returned `name: "Ethan Allen Oval Drop Leaf Dining Table"` at $280 ($200–$450). Price accidentally close but name wrong. Added: (a) Leg-proportion heuristic (legs <50% of total height = coffee, 50–65% = side/end/nightstand, >70% = dining/console/counter/bar) — gives the model a 2D-photo-readable proxy for absolute height; (b) Drop-leaf / gateleg / Pembroke / butterfly-leaf rule (ignore leaves-up surface area which varies 2–3× between positions; route purely by height + leg proportions; most thrift-floor drop-leafs are coffee/side/accent, not dining); (c) Brand-association guard naming Ethan Allen / Bassett / Lane / Drexel / Pennsylvania House / Broyhill / Kincaid / Henkel Harris / Bob Timberlake / Hooker / American of Martinsville / Cushman / L. Hitchcock as brands that produced COFFEE + SIDE + DINING tables in the same Country / Heirloom / Old Tavern / Colonial / Shaker aesthetic — brand stamp alone is NOT a routing signal. User rescanned post-edit and confirmed fix (table now identified as Coffee Table). **Pattern lesson**: brand-association bias is a real model tiebreaker on ambiguous form; positive-evidence guards ("X brand produces all three forms in the same aesthetic") fix it more cleanly than negative rules.
- **Chair red-flag extensions** (`services/gemini.ts:877, 880`, prompt-only). MCM KNOCKOFF flag silhouette list extended with Aeron / Eames Aluminum Group / Soft Pad Management / Pollock Executive / Knoll Womb / Jacobsen Egg / Swan / Wegner Papa Bear / Bertoia Side / Emeco 1006; per-form authentication surfaces spelled out (HM/Knoll/Fritz Hansen/Cassina foil sticker for MCM lounges + dining, Eames Lounge 5-prong rosewood/walnut/santos palisander base, Aeron HM logo on base + Aeron yoke stamp + PostureFit SL adjuster + 8Z Pellicle mesh pattern, Bertoia/Emeco underside maker mark). STRUCTURAL DAMAGE flag extended with chair-specific failure modes: broken or seized recliner mechanism (lever hanging, footrest stuck, electric motor disconnected), failed gas-lift cylinder (chair fixed at one height or visible oil leak), sagging/torn Pellicle mesh, snapped spindle / broken stretcher / split back slat, missing castor wheel or broken castor lock, deep cat-scratched or pet-shredded upholstery with stuffing visibly exposed. EXHAUSTIVE LIST guardrail at line 798–799 intentionally locks five furniture red-flag categories (PARTICLEBOARD MASQUERADE, MCM KNOCKOFF, HIDDEN ODOR, BEDBUG INDICATORS, STRUCTURAL DAMAGE) so chair work fit WITHIN existing MCM KNOCKOFF + STRUCTURAL DAMAGE rather than coining new categories; no `RED_FLAG_KNOCKOFF_PREFIXES` array (lines 114–133) changes, no banner copy changes — the existing "Possible knockoff" copy is generic enough to cover both MCM lounges and Aeron without modification. **Pattern lesson**: the EXHAUSTIVE LIST guardrail is a deliberate constraint forcing new failure-mode coverage to extend existing categories. Working WITHIN it (extending prefix instructions + tell lists) is cleaner than expanding the prefix array + classifier + banner copy in lockstep, especially when the existing banner copy is already abstract enough.
- **Daily scan cap shipped** (`utils/scanCap.ts` NEW, `services/gemini.ts`, `app/(tabs)/scan.tsx`, `app/detail.tsx`). Local-only abuse mitigation against unbounded Gemini API cost from rogue scanning: `tv_scan_count_${YYYY-MM-DD}` AsyncStorage key (ISO via `toLocaleDateString('en-CA')` because en-US is M/D/YYYY), `DAILY_SCAN_CAP = 100`, `ScanCapError` class with friendly message "Daily scan limit reached. Resets at midnight." Gate inserted at the top of `scanWithGemini` / `refreshUpcycleIdeas` / `rescanAsHandmade`; increment AFTER successful return only (failures don't burn quota — the abuse threat model requires successful API responses, which is where the cost actually lands). UI: extended `ScanErrorKind` in `scan.tsx:68` with `'cap-reached'`, added hourglass-outline icon variant + cap copy in `getScanErrorCopy`; existing inline error card auto-renders the new kind through `classifyScanError`. Patched 6 secondary catch blocks (3 in `scan.tsx` for handmade rescan / wrong-scan rescan / upcycle refresh; 3 in `detail.tsx` for the same flows) to surface `ScanCapError.message` via toast instead of the generic "couldn't rescan, try again" fallback. POST_LAUNCH.md had scoped this as "~30 LOC + sheet"; reusing the existing inline error card saved ~50 LOC + a new BottomSheetModal component while preserving the same UX. Worst-case bound: ~$0.09/day Gemini on cap, ~$3.50/day if every fallback path triggers. **Pattern lesson 1**: abuse protection (API cost cap) is operationally distinct from feature gating (paywall); `feedback_no_item_caps.md` about tracker capacity does not apply. Cap is uniform across free + Pro tiers. **Pattern lesson 2**: when extending error-classification machinery (`ScanErrorKind`, `classifyScanError`, `getScanErrorCopy`), the secondary catch blocks that wrap user-triggered side-actions (rescan, upcycle refresh) commonly swallow the error message with a generic toast. Grep them out and patch each — the inline error card only covers the primary scan flow.

## Post-Launch Ideas

See [POST_LAUNCH.md](docs/POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
