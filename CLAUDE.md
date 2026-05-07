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

- **InventoryContext** — inventory array, CRUD ops, auto-persists to AsyncStorage (`tv_inv`)
- **ToastContext** — ephemeral toast message, auto-dismisses after 2.6s
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

### Philosophy
- App exists to help thrifters make money — the app pays for itself
- Subscription justified by ongoing AI scan costs and continuous value delivery
- Season Pass is a unique hook for seasonal thrifters (Q4 holiday, back-to-school, etc.)

### Free trial
- **30-day trial** — **full Pro feature set** for `TRIAL_DURATION_DAYS` from trial start (unlimited AI scan, full vault, hauls, etc.). Not a limited "free tier" during trial. Trial start: when onboarding finishes or first app open; persist ISO timestamp in AsyncStorage.
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

- **Scan UX** — Camera = single-shot (scans on capture); library = multi-photo. Camera also stages up to `MAX_STAGED_PHOTOS = 5` with `[flip][shutter][scan]` row + `N/5` counter; auto-scans at 5/5. Bulk scan and item caps both rejected (bad UX).
- **AI fallback chain** — Gemini 2.5 Flash → Gemini 2.5 Flash-Lite → Claude Sonnet 4.5 via shared `callWithFallback`. Non-overload errors fall through immediately. Keys: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_ANTHROPIC_API_KEY`. Claude fallback ~$0.017/scan; only when both Gemini tiers fail. Retry delays: 3s/8s.
- **Pricing clamps** (all in `services/gemini.ts` `runScanPipeline`) — `DENIM EXCEPTION` ($140 ceiling, $25 floor; finished-look pricing); `ALTERED FACTORY BASE EXCEPTION` across pants/tops/dresses/skirts/shorts/swimwear/non-sneaker shoes (base tier + 30–60% premium, no labor formula); `HANDMADE SEWN-FABRIC TOP EXCEPTION` (sewn-fabric $25–$120; crochet/hand-knit/cottagecore $30–$180); `isExceptionalDenim` override = $300 (matches `lattice|woven|sculpt|corset|bustier|halter|deconstructed|couture|frankenstein|quilt`); `BOOST STACKING` clamp (≥3 boost buckets and not luxury → per-category ceilings); `confidenceFromRangeWidth()` downgrades confidence when range >3.0× / >4.0×.
- **Prompt rules** — `BRAND IN NAME — HARD RULE` + `COMMON HALLUCINATION TRAPS` prevent brand invention; `RED FLAG DETECTION — HARD RULE` (separate from `authFlags`); `UPCYCLE EXEMPTION` (isCustom alone can't redFlag); `RESCAN_CORRECTION_SUFFIX(prior)` packs prior verdict for wrong-scan rescan; `Q2 2026 ACTIVE SPIKES` line; "knit" disambiguation requires `hand[-\s]?knit` or other handmade-craft signal to route to craft tier.
- **Tier-aware rounding** — `roundDisplayPrice()` in `utils/currency.ts`: <$200→$5, <$500→$10, <$1000→$25, ≥$1000→$50. Applied at source in `runScanPipeline`.
- **Money formatting** — `formatMoney()` for 4-figure ranges (`$600–$1,200`); `formatMoneyWithSign()` for profit display.
- **Before/After photo recognition** — Position-agnostic across staged 1–5 set. ≥1 "before" slot → `beforeAfterDetected: true` + forces `isCustom` + altered-base tier. On single-photo rescans, falls back to `priorResult?.beforeAfterDetected`. Persists on `ScanScenario` and `ItemScanSnapshot`. UI: pill alongside Handmade.
- **Red Flag system** — `redFlags?: string[]` field; sentinel `"stock-photo"` triggers banner without bullet (UI filters). `blush` banner with `flag` icon; red badge on vault grid; Yes/No "Look fake to you?" prompt suppressed when flags present. Persists per-item via `tv_prompt_dismissed_${id}`.
- **Duplicate detection** — Weighted multi-signal score (brand×3, color×2, material×1.5, multicolor/generic×1; +0.15 brand, +0.10 color match, -0.30 color conflict). Threshold 0.55. Sparse-token rescue floor 0.6. `matchedTokens.size < 2 && !brandMatch` clamps to 0.40. Image-size fallback against `scanSnapshots[0].sourceImageUri` auto-promotes to 0.99.
- **Rescan correction** — `correction: 'lower' | 'higher'` (no `'same'` toast). Within 5%/$2 tolerance no toast/no price-lock. Wrong-scan rescan updates `cat` from `result.category` (guarded against `'other'`). User rescans honor fresh AI verdicts (no `Math.max` ratchet).
- **iOS minimum = 15.1** — Expo 54 + expo-camera + expo-image-picker floor. Covers iPhone XS→16 Pro Max. Portrait-locked, no tablet.
- **Background scan** — iOS suspends network ~5–30s after backgrounding. AppState handler + `handleScanStaged` finally make the failure path *look* seamless (continuous spinner, no false toast, retry threads in on resume). Real fix is a `UIApplication.beginBackgroundTask` Expo native module — deferred to `POST_LAUNCH.md` (requires prebuild → ends Expo Go).
- **RevenueCat** — Code is 100% ready (`hooks/usePurchases.ts`, `PaywallModal`). Blockers all infrastructure: Paid Apps agreement, 3 ASC products, RevenueCat dashboard, `npm install react-native-purchases`, `app.json` plugin, `.env` key, `npx expo prebuild`. **Expo Go breaks permanently after prebuild** — switch to dev client. See `MVP.md` for 9-step sequence.
- **Sentry** — `@sentry/react-native` 7.2.0 wired in `_layout.tsx` (`Sentry.wrap(RootLayout)`, `enabled: !!EXPO_PUBLIC_SENTRY_DSN`, `sendDefaultPii: false` + breadcrumb redactor on `ui.input`/`ui.click`). `metro.config.js` has `unstable_enablePackageExports: true` for ESM. DSN live in `.env`; native crash reporting activates after prebuild. TestFlight cut from launch plan (insufficient tester pool).
- **Anti-counterfeit** — "Reselling this?" disclaimer on Verify authenticity blocks (`scan.tsx`, `detail.tsx`). TOS Section 4 prohibits counterfeit use; live on GH Pages.
- **Modal animation pattern** — All slide-down modals (PaywallModal, scan history sheet, fullscreen image) use `animationType="none"` + manual `translateY` spring; dismiss animates to 700 then closes.
- **Item detail IA** — Field order: Date → Category → Store → Platform → Status → Notes. Status + Platform intentionally adjacent.
- **Invested = lifetime cost basis** — stats reducer accumulates `invested += paid` for every item regardless of status (selling doesn't reduce invested).
- **Stats placement** — Total Invested on Profile; removed from Vault (stats are global, not per-view filtered).
- **FlatList scroll reset** — Include `view` in FlatList `key` so each tab mounts fresh at top.

### Business State

- **Apple Developer** — Individual enrollment active ($99/yr). Individual → Org conversion requested; awaiting Apple. D-U-N-S, team ID, account email tracked outside repo.
- **ThriftVault LLC** — Formed in TN, EIN issued. Annual overhead: ~$400/yr TN ($300 annual report + $100 min franchise) + 6.5% excise on net earnings. Legal docs tracked outside repo.
- **Pre-launch follow-ups:** (1) Export 1024×1024 PNG icon (current `thriftvault_logo_v2.png` is 834×836 with alpha + circular frame — fails App Store specs); update `app.json` icon/splash/Android adaptive/web favicon (4 paths). (2) Org Apple Developer enrollment; fill `ascAppId` + `appleTeamId` in `eas.json`.
- **Expo 54 longevity** — safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

### Session — 2026-05-07
- **Handmade labor-hour formula → finished-look tier ladders** (`services/gemini.ts` PROMPT path 1 + `HANDMADE_SUFFIX`) — root cause of "first scan overprices, rescan corrects": labor formula `materials + hrs × $25 + 30% uniqueness + 20–30% trending boost` consistently overshoots unknown-maker Depop comps by 30–80%. Removed entirely. Added 6 finished-look exceptions: HANDMADE OUTERWEAR ($35–$180), DRESS ($30–$200), SKIRT ($20–$140), BAG ($20–$140), ACCESSORY non-jewelry ($15–$120), FIBER-ART STANDALONE ($25–$300). Stripped all "+20–30% trending" / "+30% uniqueness" references across main prompt, suffix, and FINAL SANITY CHECK. Mirrors how SEWN-FABRIC TOP and HANDMADE JEWELRY exceptions already worked. See `feedback_handmade_pricing.md`.
- **FIRST-PASS ANCHORING rule** (`services/gemini.ts` PROMPT path 1 + `HANDMADE_SUFFIX`) — second root cause: model defaults to upper edge of any tier band on first scan because rescan path injects 3 corrective signals first scan lacks (prior verdict in context, forced condition re-exam, required `correction: lower|higher` direction). Fix: explicit "default position = band low + 30% width, NOT upper edge". Reserve upper third for explicit upper-tier signals (named maker, NWT, exceptional construction keyword, mint condition). CONDITION DEFAULT: assume "used-good" unless damage or tags visible. Worked example: HANDMADE DRESS moderate $50–$120 → default $50–$85.
- **Custom outerwear / bags / caps clamps** (`services/gemini.ts` `runScanPipeline`) — gap: existing clamps covered tops/pants/skirts/shorts/swim/shoes/dresses but not outerwear/bags/caps. Added `isCustomOuterwear` $180, `isCustomBag` $140, `isCustomCap` $80 (new `isCapText` regex `caps?|hats?|beanies?|trucker`). Caps cover altered factory bases AND from-scratch handmade.
- **MCM bypass on particleboard clamp** (`services/gemini.ts` `MCM_BRAND_RX`) — authenticated Saarinen Tulip / Knoll / Eames pieces with original laminate tops were getting clipped to $80. New regex (eames|knoll|herman miller|wegner|saarinen|cassina|vitra|nakashima|jacobsen|breuer|le corbusier|mies van der rohe|nelson|florence knoll|b&b italia|poltrona frau|minotti) bypasses `PARTICLEBOARD_RX` match.
- **Signed-vintage costume jewelry tier** (`services/gemini.ts` `SIGNED_COSTUME_RX`) — Trifari/Coro/Weiss/Haskell/Eisenberg/Hobé/Whiting & Davis/Sarah Coventry/Monet/Napier/Boucher/Hattie Carnegie/Kenneth Jay Lane/Jelly Belly were falling into the no-hallmark $30 cap. Prompt tier prices these $20–$120. New clamp branch caps $120, floor $20 (before terminal no-hallmark branch).
- **Y2K viral brands exempt from boost-stacking** (`services/gemini.ts` `LUXURY_EXEMPT_RX`) — Juicy Couture / Von Dutch / Ed Hardy / Baby Phat / Apple Bottoms hit 3+ boost buckets (era + embellishment + trend) on legit items per their own tier ($100–$200) and were getting clamped to $130 (tops). Added to luxury-exempt regex; name remains misleading post-change but call site only cares about "exempt from boost stacking".
- **Furniture refurb red-flag false positives** (`services/gemini.ts` FURNITURE RED FLAGS + SCREENSHOT/UI EXEMPTION) — refinished thrift-flip pieces (painted wood, TikTok screenshot photos) were triggering 3 false flags (stock-photo, HIDDEN ODOR, PARTICLEBOARD MASQUERADE) because model was reading BEFORE photo (raw weathered chest) as evidence of hidden defects in COVER (finished painted cabinet). New header rule: "evaluate every flag against COVER PHOTO, NOT before/in-progress photos. Weathered before-state = LABOR evidence, NOT hidden defects." PARTICLEBOARD: don't speculate about what's under paint or refinish; don't flag dovetail-jointed antique chests. HIDDEN ODOR exclusion expanded with painted/repainted/restained/limewashed/whitewashed wood and refinished antique chests — paint encapsulates and refinish strips the prior finish. SCREENSHOT/UI EXEMPTION: new bullet for furniture refurb / thrift-flip TikTok content (glossy paint and "too clean" looks ≠ AI generation).
- **Save-for-later race — in-flight scan clobbers loaded saved item** (`app/(tabs)/scan.tsx` `openSavedItem` + `handleScanStaged` + `handleConfirmHandmade`) — tapping a saved item while a scan/rescan was in flight let the scan's late `setResult(geminiResult)` overwrite the loaded saved item's data and stitch a mismatched session snapshot onto it. Two-part fix: (1) `openSavedItem` now aborts `abortControllerRef.current` and resets `scanning`/`scanningRef`/`pendingRetryRef`/rescan flags before restoring the saved scenario; (2) `if (controller.signal.aborted) return;` added immediately after the network awaits in `handleScanStaged` and `handleConfirmHandmade` (handleRescanWrong already had it) to close the race where the response already resolved on a microtask before the abort signal fired. Pattern lesson: an `abort()` doesn't help if the fetch already settled — every async-`setResult` path needs both the abort path AND a post-await `signal.aborted` guard.
- **Camo bolero overpricing — restructured-tops mis-routed to ALTERED FACTORY BASE** (`services/gemini.ts` multi-photo outcome routing line 736 + ALTERED FACTORY BASE EXCEPTION + HANDMADE SEWN-FABRIC TOP EXCEPTION + `HANDMADE_SUFFIX`) — real-world test: camo button-up cropped into bolero with restructured puff sleeves + tie knot, scan returned $60–$90 vs Gemini-research ground truth $35–$65. Two compounding root causes: (1) multi-photo BEFORE/AFTER classifier outcome routed all non-denim/non-furniture to ALTERED FACTORY BASE EXCEPTION, including structural restructures that belong in SEWN-FABRIC TOP; (2) ALTERED FACTORY BASE TOPS rule "$60 unbranded / $90 branded" was being read as a range $60–$90 rather than two point estimates. Fix in 4 spots: outcome routing now `else if category = "tops" AND alteration is STRUCTURAL → HANDMADE SEWN-FABRIC TOP EXCEPTION (most factory-base restructures with one-or-two added details land MODERATE $30–$60, not COMPLEX)`; ALTERED FACTORY BASE reframed as "SURFACE DECORATION ONLY" with structural alterations explicitly redirected, and the slash notation tightened to explicit ranges (light $25–$45 unbranded / $35–$60 branded; dense $40–$70 / $55–$90) with a "POINT ESTIMATES NOT a range to span" callout; SEWN-FABRIC TOP moderate band gained explicit example "button-up shirt cropped into bolero/shrug/cardigan with restructured or gathered/puff sleeves, raw-hem cut-and-finish, tie/knot closure conversion"; HANDMADE_SUFFIX mirrored throughout per the 5/02 port-to-both-paths lesson. Pattern lesson: any "$X / $Y" notation in pricing prompts risks being read as a range — write explicit bands or label point estimates.
- **Haul item sort — newest first** (`app/haul-detail.tsx` items memo + `app/(tabs)/index.tsx` hauls memo) — items inside a haul rendered in inventory's natural (oldest-first) order. Detail view now `inventory.filter(...).sort((a, b) => b.id - a.id)`; haul card's 4-thumb grid mirrored by sorting `items` in the hauls memo before push. Reasoning: active-haul "I just scanned that" feedback beats the theoretical "stable visual fingerprint" — users recognize hauls by date label + store + finds count, not thumbnail composition.

### Session — 2026-05-06
- **6 new pricing sub-tiers** (`services/gemini.ts` FACTORY ITEM PRICING) — Lululemon (Align $30–$100, Define $50–$185); Designer SLGs (LV wallets $80–$400, Hermès H belt $300–$1100, silk twill scarf $120–$600); Vintage graphic/band tees ($20–$220 standard tiers; grail-tier $500–$2000+ flagged as low-confidence/manual-research, not auto-priced — too rare to risk false positives on common band tees); Vintage sports jerseys (Mitchell & Ness $80–$300, Champion Reverse-Weave $40–$300); Doc Martens under Boots ($40–$300 across 1460/Jadon/MIE); Sunglasses ($25–$500+ across Ray-Ban/Oakley/designer/vintage). Two new COMMON HALLUCINATION TRAPS for vintage tees and sunglasses. Prompt-only.
- **Furniture false-positive red flags fixed** (`services/gemini.ts`) — wicker dresser scan was tripping HIDDEN ODOR ("smell-verify in person") and STRUCTURAL DAMAGE on a clean piece. HIDDEN ODOR now restricted to visibly upholstered fabric/leather/padded; hard surfaces (wood, wicker, rattan, metal, glass) explicitly exempt. STRUCTURAL DAMAGE now requires unambiguous visible damage (snapped leg, cracked frame, torn seat with springs, water staining/bubbling, mold) — patina or vintage-looking-but-intact does not trigger. Added "when in doubt, do NOT flag — false damage warnings erode trust."
- **Recent finds red flag badge** (`app/(tabs)/scan.tsx`) — was only on My Vault grid; now mirrors there. Same per-item dismissal logic via `tv_prompt_dismissed_${id}.redFlagBanner`, sized 11px to fit the 100×100 thumbnail.
- **Scan card corner clipping fix** (`app/(tabs)/scan.tsx` `cameraBox` + `cameraBgImage`) — dark spots were visible at the rounded corners. Image styles had `borderRadius: 24` while container had `borderRadius: 22` with `overflow: hidden`; image rounded MORE than container clipped, exposing the `charcoal` background through the gap. Removed redundant image borderRadius (let container's overflow handle clipping) and switched cameraBox bg from charcoal to cream so any future render edge case stays invisible.
- **Delete scan with confirmation + snapshot fallback** (`app/(tabs)/scan.tsx` `deleteActiveSessionSnapshot`) — original wired to `clearResultAndPhoto()` which wiped the entire session even when other snapshots existed. Now mirrors detail.tsx's `deleteActiveScan`: filters the active snapshot out of `sessionSnapshots`, switches to the next remaining one (sets it as active + `setResult(next.scenario)`), only clears everything if it was the last. Wrapped in `Alert.alert('Delete Scan', 'Remove this scan?')` matching detail's destructive-action pattern. Uses `sessionSnapshotsRef` + `activeSessionSnapshotIdRef` synced via `useEffect` so the Alert's async `onPress` reads current state at confirm-time, not button-tap-time. Block ordered after `clearResultAndPhoto` is declared to satisfy TS no-use-before-declare.
- **Multi-photo before/after classifier — false positive on multi-angle dolman** (`services/gemini.ts` `multiPhotoSuffix`) — 4 photos of a single finished pink-striped dolman top (front off-shoulder, back, side, modeled) were flipping `beforeAfterDetected = true` because the back-view photo doesn't visibly show the dolman's asymmetric drape (it's on the front), so it read as "plain" relative to photo 1. The TikTok caption ("whenever I'm bored I take an old tee shirt and turn them into dolman tops") may also have biased the model toward transformation classification. Three new "Tells AGAINST (b)" bullets: (1) same restructured garment from a different angle (asymmetric/draped/cinched/dolman/halter silhouettes look "plainer" from the back — fabric+hem+length match means multi-angle of the AFTER, not a pair); (2) same scene/background/styling/wardrobe across all photos (one try-on session ≠ a transformation reveal which would require two distinct moments); (3) caption text and social-media overlays describing technique generally are NOT visual evidence — only an unmodified original in the photo counts.
- **FINAL SANITY CHECK pre-return self-critique** (`services/gemini.ts` end of pricing instructions) — root cause of "first scan overprices, rescan lands closer to comp": the rescan-wrong path injects a correction signal (`RESCAN_CORRECTION_SUFFIX(prior)`) that nudges the model down, but the first call has no such anchor and trusts the labor formula or boost stacking too literally. Added a 4-bullet sanity check the model runs before returning: (1) if `suggestedResaleHigh` exceeds the most likely Depop/Poshmark/eBay sold-comp by >30%, pull both ends down toward median; (2) narrow ranges that straddle two tiers (e.g., $40–$200) — pick a tier and commit, set confidence: low; (3) cap handmade labor-formula outputs against unknown-maker comps (the labor math produces $325–$650 ceilings no Depop buyer pays for an unknown maker); (4) re-check BOOST STACKING when 3+ boosts applied. Closing line tells the model that sold comps are ground truth and the formula is a starting estimate. First-pass prices should now land closer to comps without a rescan loop.
- **POST_LAUNCH.md cleanup** — removed completed items (Haul titles shipped 4/29, Furniture price range accuracy shipped 5/04). Added "Condition-weighted headline price" entry: midpoint of resale range (50%) is statistically optimistic — used-good comps cluster at ~35–40%, NWT at 60–70%. Parked pre-launch because there's no real-user signal yet on whether midpoint feels high; a 20-scan feedback loop will tell us more than statistical theory. Pure display bias, no tier-pricing change.
- **Handmade sewn-fabric tops still overpricing on first scan** (`services/gemini.ts` main `PROMPT` + `HANDMADE_SUFFIX` + `runScanPipeline` `isHandmadeTop` clamp) — root cause: the `HANDMADE SEWN-FABRIC TOP EXCEPTION` (introduced 5/03) lived ONLY in `HANDMADE_SUFFIX` (rescan-as-handmade path), NOT in the main prompt. So first scans of handmade sewn tops fell through to the default labor-hour formula (materials + hrs × $25 + 30% uniqueness premium + possibly 20–30% trending bonus) and only got pulled down by the broad $180 HANDMADE TOP CEILING. Real-world test: tee → dolman conversion landed at $60–$90 / $75 mid when actual unknown-maker Depop comps are $30–$60. The earlier FINAL SANITY CHECK addition didn't pull this down because the model has no actual sold-comp data — it imagines comps that are as inflated as its own labor formula. Fix: (1) ported the SEWN-FABRIC TOP EXCEPTION into the main prompt with bands tightened for unknown-maker reality (simple $20–$45, moderate $30–$60, complex $50–$95, hard ceiling $95 — was $25–$120 in the suffix), (2) added explicit dolman/halter/ruched silhouette example mapping to the moderate band, (3) lowered the `isHandmadeTop` code clamp default cap $120 → $95 and floor $25 → $20 (crochet/knit and exceptional-denim caps unchanged), (4) mirrored the same tighter bands in `HANDMADE_SUFFIX` so rescans don't snap back up. Pattern lesson: pricing exceptions added in `HANDMADE_SUFFIX` need to be ported to the main prompt — the suffix only fires on user-confirmed handmade rescan, not on the auto-detected first scan.

### Session — 2026-05-05
- **Before/after detection missing shape-shifting upcycles** (`services/gemini.ts` `multiPhotoSuffix`) — Tee → ruched top wasn't getting the pill or altered-base tier. Multi-photo classifier required ALL of (same silhouette + photo 1 has hand-applied + other plain), and "same silhouette" failed precisely on high-labor pieces where the shape is the labor (ruching, halter conversion, corset, frankenpieces, jeans → skirt, curtains → dress). Loosened to "AT LEAST TWO of these are true" with **shared fabric identity** as the new primary tell — fabric carries through even when shape changes drastically. Added explicit shape-shift example list (tee → ruched/halter/tube/corset/asymmetric, sweater → cardigan/shrug/vest, long dress → mini, jeans → skirt/shorts/tote, curtains/sheets/quilts → garments, frankenpieces, furniture repurpose). Added "no shared fabric identity" to Tells AGAINST (b) so the looser threshold doesn't pick up two unrelated items. Closing "default to (a)" line rewritten so fabric-match + custom-work asymmetry overrides silhouette mismatch — that combo IS the signature of a real upcycle pair.
- **`beforeAfterDetected` lost on app reload** (`context/InventoryContext.tsx` `sanitizeSnapshot`) — Field was never copied off `source` into the returned snapshot, so the flag survived in-memory but got stripped the next time inventory rehydrated from AsyncStorage. Persists alongside `isCustom`/`authFlags`/`redFlags` now. Mirrors the 4/23 sanitizer-stripping-`redFlags` bug — same shape, same fix.
- **Furniture before/after detection** (`services/gemini.ts` staged-photo classifier) — 5/04 furniture sweep didn't extend the BEFORE/AFTER classifier, so refurb pairs (worn dresser → limewashed dresser, stained chair → boucle reupholster, damaged caning → recaned, old hardware → new brass pulls) weren't getting the pill or the labor premium. Added furniture-specific tells to the (b) classification list and a furniture-refurb example to the strong-tells bullet. Outcome routing extended: when `category = "furniture"`, BEFORE/AFTER scans pick FURNITURE PRICING + FURNITURE isCustom logic instead of falling through to ALTERED FACTORY BASE EXCEPTION (which is clothing-tier and would underprice MCM/antique refurbs).
- **Furniture refurb premium 20–50% → 30–50%** (`services/gemini.ts` FURNITURE isCustom clause) — Floor was too low; quality refinish/reupholster work on solid-wood or MCM bones consistently comps closer to +40%. Particleboard $80 ceiling and "refinished IKEA stays under $120" rules untouched.
- **ALL-OVER DIGITAL PRINT false positives on watercolor florals + patchwork** (`services/gemini.ts` red flag branch) — Hawaiian-print rayon shirts and pieced-panel upcycles were tripping the dropship sublimation flag. Two carve-outs: (1) expanded "do NOT flag" textile-repeat list with watercolor/painterly/abstract/tropical/Hawaiian florals, tie-dye, marbled/ink-wash abstracts; (2) NEW "multi-panel construction" override — patchwork, spliced panels, mismatched front/back fabrics, fringe/beadwork trim, lace-up or grommet inserts in contrasting fabric beat the bullet regardless of how "pictorial" any one panel reads. Mass-produced sublimation prints on ONE continuous polyester panel; handmade upcycles combine source fabrics.
- **`SECURITY_AUDIT.md` checklist refresh** — 5/03 Sentry DSN wire-up closed the only Low finding still Open. Risk-summary row → Fixed; §8 body rewritten to past tense; checklist refreshed 2026-05-05 with the wire-up checked off.
- **Jewelry scan accuracy pass** (`services/gemini.ts`) — NEW dedicated `► JEWELRY PRICING` branch parallel to FURNITURE (Q2 2026 tiers: signed vintage costume Trifari/Coro/Weiss/Haskell $20–$120, refreshed gold-filled $20–$75 for gold spot ~$3000/oz, solid gold by karat 10k/14k/18k/24k, pearl sub-tiers cultured-freshwater→Akoya→Tahitian, watches split fashion/mid/luxury with luxury-without-stamp drop-to-mid). NEW `JEWELRY HALLMARK — HARD RULE`: yellow-tone metal is NOT gold; silver-tone is NOT sterling; clear sparkly stones are NOT diamonds without a readable stamp (925/STER/14k/18k/PLAT). Code clamps in `runScanPipeline`: no-hallmark $30 cap, designer-without-stamp $150 cap (Tiffany/Cartier/VCA/Pandora/Yurman silhouettes), watch-luxury-without-stamp $400 cap (Rolex/Omega/Patek/AP). Confidence carve-out extended to jewelry (gold/diamond tiers legitimately wide). Jewelry hallucination traps (Tiffany heart, Cartier Love screws, Pandora ALE, VCA clover, Yurman cable, Bulgari B.zero1, John Hardy toggle), GOLD/STERLING/DIAMOND/DESIGNER MASQUERADE red flags, 3 brand-specific authFlag examples. NEW `HANDMADE JEWELRY EXCEPTION` in `HANDMADE_SUFFIX` ($15–$180 by complexity for wire-wrap/polymer clay/beaded/resin/hand-stamped).
- **Bags + sneakers auth pass** (`services/gemini.ts`) — NEW `BAG AUTHENTICATION — HARD RULE` per-brand: LV date code (FL/SD/CT/MI/SP + 4 digits) or heat-stamp plate, Chanel 8-digit serial sticker, Hermès blind stamp + craftsman code, Goyard MAISON tab, Coach creed serial, Gucci/Prada/Dior interior plaques. NEW `SNEAKER AUTHENTICATION — HARD RULE` splits BASE hyped silhouettes (Jordan 1/Dunk Panda/Yeezy 350 — silhouette OK from side photo) from COLLAB claims (Travis Scott/Off-White/Fragment/Sacai/Salehe Bembury — require SKU on tongue tag / box label / co-brand insole / StockX tag). Code clamps: luxury-bag-without-auth $300 cap, sneaker-collab-without-auth $250 cap (base hyped intentionally NOT clamped — existing $40–$250 tier already correct). Confidence carve-out extended to luxury bags ($100–$1700 LV monogram range is legit, not low confidence). Bag/sneaker hallucination traps + LUXURY BAG / DESIGNER BAG / SUPERFAKE SEAM TELL / HYPED SNEAKER COLLAB red flags + 6 brand-specific authFlag examples (LV date code, Coach creed, Hermès blind, Chanel serial, Jordan SKU, Travis Scott Cactus Jack laces).

### Session — 2026-05-04
- **Red flag false positives on UI text** (`services/gemini.ts` AI-GENERATED PHOTO branch) — Garbled-text bullet was matching before the social-media carve-out, sweeping in TikTok/Reels captions, hashtag stacks, watermarks, foreign-script overlays (Korean/Chinese/Arabic), usernames with emoji, phone status chrome. Two fixes: (1) front-loaded `SCREENSHOT/UI EXEMPTION` gate (parallel to `UPCYCLE EXEMPTION`) enumerating social/resale/screenshot UI sources before any artifact bullet; (2) tightened text bullet to require text on a PHYSICAL SURFACE in the scene (sign, hangtag, label, mirror) AND paired with another artifact — text alone insufficient.
- **Furniture scanning — full sweep** (`types/inventory.ts`, `services/gemini.ts`, `app/(tabs)/index.tsx`, `app/detail.tsx`) — App was clothing-only; furniture is a major thrift category with very different dynamics ($30 IKEA → $30k Eames). Added `'furniture'` as single top-level `ItemCategory`; subtype detected by keyword on `name`/`sub` (mirrors existing skirts/shorts/swimwear/sneakers pattern — no new `subcategory` field). New PROMPT branch "FURNITURE PRICING" parallel to HANDMADE/FACTORY: brand/era tiers (IKEA particleboard / West Elm-CB2 / RH-DWR / authenticated MCM Eames-Knoll-Wegner-Saarinen / vintage Danish unbranded / vintage American Heywood-Drexel-Lane-Stickley / Hollywood Regency-Memphis postmodern / industrial / antique 100yr+ / outdoor / lamps / mirrors / rugs / decor smalls), material signals (solid wood +30–50%, particleboard $80 floor, brass/marble/leather +20–30%), condition rules, size penalty (-30% large items), MCM ATTRIBUTION HARD RULE (designer name requires visible label/sticker/stamp; otherwise "MCM-style" $80–$300), Q2 2026 spikes (boucle reupholstery, limewash, cane/rattan, Memphis revival, Italian designer, Japandi, Persian rugs). New furniture red flags: PARTICLEBOARD MASQUERADE, MCM KNOCKOFF, HIDDEN ODOR, BEDBUG INDICATORS, STRUCTURAL DAMAGE. Furniture auth flag examples for Herman Miller/Knoll/Cassina/Vitra label checks, Tiffany lamp signature, antique maker's marks. Furniture upcycle guidance carve-out: clothing BANNED list (bleach/tie-dye/cropping/etc) doesn't apply; allowed refinish/reupholster/paint/swap-hardware/recane/repurpose. Platform context extended for FB Marketplace / Craigslist / Chairish / 1stDibs / AptDeco / OfferUp. Code clamps in `runScanPipeline`: particleboard text → $80 ceiling regardless of brand; furniture skips `confidenceFromRangeWidth` downgrade (legitimately wide tier ranges aren't low-confidence). No code-level MCM hallucination clamp — prompt HARD RULE handles it; code clamp would false-negative real authenticated pieces. `KNOWN_PLATFORMS` (`detail.tsx:63`) extended with Craigslist, OfferUp, Chairish, AptDeco, 1stDibs, Etsy. `CATEGORY_GROUPS` (`(tabs)/index.tsx:45`) gained Furniture filter chip between Accessories and Other.

### Session — 2026-05-03
- **Rescan dropping `beforeAfterDetected` pill** (`services/gemini.ts:499`, `app/detail.tsx:444`, `app/(tabs)/scan.tsx:1538`) — Clamp `parsed.beforeAfterDetected === true && images.length >= 2` was zeroing the verdict on every rescan because all four rescan paths send only the cover photo. Fix: on single-photo scans, fall back to `priorResult?.beforeAfterDetected === true`. `rescanWrong` paths thread `priorResult`; `confirmHandmade` paths intentionally don't (would mis-suffix as "wrong scan") and instead OR in the prior verdict at the call site.
- **Handmade sewn-fabric tops overpriced at $95–$180** (`services/gemini.ts` `HANDMADE_SUFFIX` + clamp ~line 527) — From-scratch handmade satin V-neck top with lace trim was returning $95–$180; real Depop/Etsy comps $40–$80. 4/27 fix had blanket $180 ceiling for ALL handmade tops, but sewn-fabric DIY hobbyist work prices by finished look (TikTok-saturated market). Crochet/hand-knit/cottagecore legitimately commands $80–$180. Fix mirrors DENIM EXCEPTION: NEW `HANDMADE SEWN-FABRIC TOP EXCEPTION` clause (simple $25–$55 / moderate $40–$85 / complex $60–$120). Renamed `isAlteredTop` → `isHandmadeTop`, made material-tier-aware: `isCrochetKnitText` → $180 cap / $30 floor; default sewn → $120 cap / $25 floor. `isExceptionalDenim` override still wins.
- **"Knit" disambiguation** (`services/gemini.ts:530` + HANDMADE_SUFFIX) — Olive top rescanned to $105–$180 because Gemini wrote "stretchy knit with lace trim". Bare `knit(ted)?` regex was routing factory knit fabric (jersey/spandex/ponte) to craft tier. Bare "knit" describes FABRIC TYPE in fashion vocab. Tightened to require `hand[-\s]?knit(ted)?` or `crochet|knitwear|yarn|cottagecore|milkmaid|mending|patchwork|embroidered|macrame|needlepoint`. Added `knit fabric, stretchy knit, ribbed knit, ponte` to SEWN-FABRIC EXCEPTION material list. Pattern lesson: ambiguous textile terms need negative + positive disambiguation in both prompt and code regex.
- **Sentry DSN wired** (`.env` `EXPO_PUBLIC_SENTRY_DSN`) — TestFlight cut from launch plan. DSN pasted, Metro restarted, verified with temp `Sentry.captureException` row on profile (added + removed same session). Pre-launch SECURITY_AUDIT.md / LAUNCH_OPS.md "before TestFlight" items now read "before App Store submit" — see `memory/project_launch_no_testflight.md`.
- **Scan background reverted to v1 logo** (`app/(tabs)/scan.tsx:117`) — `SCAN_BG_SOURCE` back to `thriftvault_logo.jpg` after 5/01 v2 swap. v2 PNG still in place across `app.json` paths and `WebSidebar.tsx`; only the scan background prefers JPG.

### Session — 2026-05-02
- **Boost-stacking guard for factory items** (`services/gemini.ts`) — Catches compound-boost case (era × embellishment × denim_spike × trend × collab). New consts: `BOOST_BUCKETS` (5 regexes) and `LUXURY_EXEMPT_RX` (luxury houses, designer collabs, vintage Levi's selvedge, NWT). Clamp at line 570: `!isCustomScan && !LUXURY_EXEMPT && boostCount >= 3` → per-category ceiling (denim $180, tops/dresses $130, bottoms $120, outerwear $200, shoes $200, bags $220, accessories $120) with proportional `resaleLow` and $15 floor. Worst-case before: vintage Y2K Diesel rhinestone flares → $172–$1,290 (7× over comp); after: $180. Prompt-side `BOOST STACKING — HARD RULE` between `Trend premiums` and `Q2 2026 ACTIVE SPIKES` as belt-and-suspenders. `HANDMADE_SUFFIX` untouched (custom labor formula dominant; risks confusing model).
- **Confidence tied to range width** (`services/gemini.ts:33`) — `confidenceFromRangeWidth(aiConf, low, high)` helper, downgrade-only. Ratio thresholds anchored to prompt tier widths: ≤3.0× no change (factory `$25–$80` is 3.2×); >3.0× caps `high → medium`; >4.0× caps to `low`. Wraps inline confidence parse. `low`/`medium` never upgrade. Prevents `$50–$1200 "high confidence"` lie when boost stacking blows out range.
- **Category update on rescanWrong** (`app/detail.tsx:520`) — Was writing `name`/`resale` but ignoring `result.category`. Added `catUpdate = result.category && result.category !== 'other' ? { cat: result.category } : {}`. Guard against `'other'` prevents downgrading specific category to AI fallback. Handmade-confirm path (line 454) intentionally untouched — that signal is "wrong pricing tier", not "wrong item."
- **"Size guess" placeholder bug** (`services/gemini.ts:41`) — Schema example `"Brief description (size guess, color, material, condition)"` was making Gemini echo "Women's size guess" when size couldn't be estimated. Rewrote with explicit examples (`"Women's 8"`, `"Men's L"`, `"US 10"`) + omit-instead-of-echo instruction.

### Compressed Sessions — older than 4 days
*Major decisions are consolidated above.*

- **App logo swap to v2 + App Store compliance blocker (5/01)** — Repointed `app.json` icon/splash/Android adaptive/web favicon (4 paths) + `WebSidebar.tsx:83` from `thriftvault_logo.jpg` to `thriftvault_logo_v2.png`. Verified v2 specs: 834×836, Format32bppArgb (alpha), circular frame — fails App Store icon (needs 1024×1024 opaque RGB full-bleed; iOS applies its own mask). Splash + Android tolerate alpha but still need 1024×1024. Native icon updates won't render until next prebuild/EAS build.
- **Security audit + fixes (4/30)** — Public repo. Scrubbed personal email from `eas.json`, hardened `Sentry.init`, closed `.claude/settings.json` pnpm/yarn loophole. New `SECURITY_AUDIT.md` (10-step methodology).
- **Q2 2026 sold-price tier refresh (4/30)** — `services/gemini.ts:98–128` + baselines. Cross-platform Depop/eBay/Poshmark research (~1800 samples, 18 tiers, eBay 2× trust). NEW: Y2K viral, factory sneakers (Generic→Premium→Hyped→Designer-collab), vintage non-denim Americana, knit sets, boots, hats. Refined Carhartt rare-color, denim cut differentiation (flare SPIKING / skinny FALLING), vintage Levi's Big E selvedge $300–$590. Quarterly refresh routine fires 2026-07-30.
- **Background scan perceived-seamless retry (4/30)** — Catch suppresses toast (gated on `pendingRetryRef`); finally keeps spinner; AppState retry via `queueMicrotask` on resume.
- **Profit subtext hidden on grid cards (4/30)** — Commented out (not deleted) on Flips/Hauls. Profile stats strip retains totals.
- **Agent safety guardrails (4/29)** — Triggered by Cursor/Opus 4.6 prod-wipe incident. Three layers: `.claude/settings.json` hard-denies (EAS prod, prebuild, force-push, hard-reset, clean -f, branch -D, cloud/DB CLIs, destructive migrations, `node -e`/`--eval`/`-p`); `SAFETY.md`; CLAUDE.md pointer.
- **Ops docs (4/29)** — `LAUNCH_OPS.md`, `DEV_OPS.md` new — solo launch playbook + release engineering reference.
- **Haul titles (4/29)** — Optional per-haul title via side-car `tv_haul_titles: Record<string,string>`. 60-char cap; blank deletes. Cleanup hook in `removeItem`. Title-as-hero / date-as-subtext.
- **Red flag prompt false positives (4/28)** — Pink ruffled umbrella was triggering AI-PHOTO. Tightened "fabric texture that looks CG-rendered" to require 2nd artifact. Expanded "do NOT flag" guard to enumerate radial/concentric symmetry, ruffles, pleating, smocking, fan/petal/flower, parasol shapes.
- **Yes/No haptics (4/28)** — `Haptics.selectionAsync()` (soft tick) on every Yes/No tap.
- **Saved-for-later prompt dismissals (4/26)** — `SavedScanItem` gained `promptCustomDismissed?` + `promptWrongScanDismissed?`; `handleSaveForLater` snapshots, `openSavedItem` restores.
- **Dark mode warmth pass (4/26)** — `theme/colors.ts` shifted dark surfaces toward amber/Edison-bulb; primary text → warm ivory `#EDE7DF`. Brand teal held (any darker drops below WCAG AA on `onPrimary`). All ratios ≥14:1.
- **Detail "Add photos" pill (4/26)** — Pill below carousel (`surfaceVariant` bg, `vintageBlueDark` icon+text, height 34) beat overlay variants. Pattern: overlays fight photo content; chip pills below media don't.
- **Scan tap-to-fullscreen (4/26)** — Post-result, camera box opens swipeable fullscreen viewer. Disabled when `!result && stagedPhotos.length > 0`.
- **Hauls empty + Unlisted badge (4/26)** — Inline "New Haul" CTA on empty Hauls. Unlisted badge teal → `surfaceVariant` so Unlisted=grey, Listed=teal, Sold=green visually distinct.
- **Red flag false positives on upcycled garments (4/24)** — Added `UPCYCLE EXEMPTION`. Narrowed `ALL-OVER DIGITAL PRINT` (requires pictorial; excludes textile repeats). Narrowed `AI-GENERATED PHOTO` (added construction guard, social media UI overlays exempt).
- **Code cleanup pass (4/24)** — `tsc --noEmit --noUnusedLocals --noUnusedParameters` surfaced dead code. Removed unused imports across 7 files; deleted `constants/Colors.ts` + `components/Themed.tsx`. Held handlers still wired to future work. tsconfig flags NOT added.
- **PaywallModal 5 features (4/24)** — Expanded 4 → 5 bullets, added "Counterfeit & scam alerts on every scan", led first bullet with "Unlimited AI scans, pricing & unlimited vault" (anti-cap differentiator).
- **Red Flag UX + persistence bugs (4/23)** — AI-photo detection as third red-flag condition. Persistence bugs: `sanitizeSnapshot` was stripping `redFlags`; rescan paths in detail.tsx dropped `authFlags`+`redFlags`; rescan profit used template literals instead of `formatMoney()`. `clearResultAndPhoto` now aborts in-flight scans. Accessibility labels: 37 → 169 across 9 files.
- **Pre-launch compliance pass (4/21)** — `terms.html` + `privacy-policy.html` updated for LLC + TN law + Sentry disclosure. `app.json` `minimumOsVersion: "15.1"`. `eas.json` created. PaywallModal: Restore Purchases added (Apple requirement), `/3 mo` formatting, "Popular" badge dropped.
- **Sentry + ESM fix (4/19)** — `metro.config.js` created with `unstable_enablePackageExports: true` to fix Sentry's ESM resolution.
- **Android readiness (4/19)** — `ANDROID.md` created; assessed not ready (missing package, versionCode, PNG adaptive icon, EAS config, Play account, RevenueCat Google Play). iOS-first launch confirmed.
- **Background scan fix (4/17)** — Removed `abortControllerRef.current?.abort()` from AppState background handler (was killing successful scans mid-flight). `pendingRetryRef.current = false` set before `setResult(geminiResult)` in both success paths.
- **Handmade single-pass (4/17)** — Removed auto-rescan-as-handmade (two sequential Gemini calls, ~30s). Single-pass via prompt directive "Your price output is final." Scan time back to ~10s.
- **Photo dedup on rescan (4/12)** — Via `FileSystem.getInfoAsync` size comparison. Sync `soldStr`/`resaleStr` string state at every programmatic write site in `detail.tsx`.

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md) — single source of truth for scoped todos and unscoped ideas.
