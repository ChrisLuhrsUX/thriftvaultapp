# ThriftVault

## Project Overview

ThriftVault is a mobile-first thrift reselling app built with Expo + React Native. Thrifters can scan items, track inventory, and estimate resale profit. All data is local, no backend.

## Agent Safety

See [SAFETY.md](SAFETY.md), never-run list, confirm-before list, and recovery playbooks. Hard enforcement in `.claude/settings.json`. The agent treats both as load-bearing.

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

- **Apple Developer**, Individual enrollment active ($99/yr). Individual → Org conversion requested; awaiting Apple. D-U-N-S, team ID, account email tracked outside repo.
- **ThriftVault LLC**, Formed in TN, EIN issued. Annual overhead: ~$400/yr TN ($300 annual report + $100 min franchise) + 6.5% excise on net earnings. Legal docs tracked outside repo.
- **Pre-launch follow-ups:** (1) Export 1024×1024 PNG icon (current `thriftvault_logo_v2.png` is 834×836 with alpha + circular frame, fails App Store specs); update `app.json` icon/splash/Android adaptive/web favicon (4 paths). (2) Org Apple Developer enrollment; fill `ascAppId` + `appleTeamId` in `eas.json`.
- **Expo 54 longevity**, safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

### Session, 2026-05-18
- **NEW `ItemCategory = 'watches'` + WATCH BRAND HARD RULE + COMMON HALLUCINATION TRAPS watch entry + WATCH NAME CLAMP** (`types/inventory.ts`, `app/(tabs)/index.tsx`, `services/gemini.ts`). Trigger: gold-tone chronograph scan returned "ZUNAIR Gold-Tone Chronograph Watch" at $25-$65; "ZUNAIR" is a watermark/box/band text overlay, not a brand. Added `'watches'` to ItemCategory union + ITEM_CATEGORIES + Vault filter chip + synonym map (watch/watches/wristwatch/chronograph → 'watches'). Prompt category guidance + JEWELRY PRICING routing broadened to `category === 'watches' OR (category === 'accessories' AND jewelry keyword)`. WATCH BRAND HARD RULE mirrors BAG AUTHENTICATION: brand must come from DIAL logo/wordmark, CASE-BACK maker stamp, or signed crown. Explicit rejections: text on watch BOX, watermarks/photo overlays/social-media handles, decorative band engravings, case material color, bezel silhouette, strap material. Without dial-or-case evidence → silhouette+complication name, Fashion tier $20-$80. KNOWN WATCH BRAND ALLOWLIST enumerates ~80 brands (Luxury/Mid/Fashion/Smart/Character-licensed); anything off-list is declared a hallucination. COMMON HALLUCINATION TRAPS: octagonal bezel (NOT AP Royal Oak), cyclops round case (NOT Rolex), Roman-numeral dial (NOT Cartier Tank), moon-phase subdial (NOT Patek/Vacheron/JLC), diver bezel (NOT Omega), three-subdial chrono (NOT Speedmaster/Carrera). Code clamp `WATCH_BRAND_RX` + `WATCH_DESCRIPTOR_RX` post-parse: if `category === 'watches'` and name starts with neither a known brand nor a descriptor, strip up to 3 leading words (bounded loop). Rescan after clamp still attached "ZUNAIRA" through the prompt rule, but the clamp catches it. PRICING_TIERS.md rows 082/083 unchanged. **Pattern lesson: when a category has its own resale dynamics (dedicated marketplace, distinct authentication, wide tier spread), promote it to its own `ItemCategory` rather than keeping it under a generic umbrella. Belt-and-suspenders for hallucination-prone fields: prompt rule + post-parse code clamp, since the prompt alone leaks under adversarial inputs.**
- **NEW pricing tier 089, Modern Mass-Market Functional Small Furniture + CONDITION REPORTING HARD RULE + FURNITURE COMPARTMENT NAMING HARD RULE** (`services/gemini.ts`, `PRICING_TIERS.md`). Blurry dark-stained pine chairside table priced $40-$100 via the Generic vintage no-brand $40-$300 tier; real FB Marketplace comps $15-$30 as-is or $50-$80 refinished. External Gemini review flagged: pricing too high, "good condition" ignoring visible chipping, lumped "Drawer and Shelf" missing the magazine-rack slot. Tier 089 covers side tables/nightstands/small bookshelves/TV stands/small cabinets sold new at Walmart/Target/Wayfair budget for $40-$120, at $15-$50 used / $40-$80 refinished. ROUTING gate requires ≥1 positive vintage tell (hand-cut dovetails, mortise-and-tenon, real solid grain at unfinished interior, manufacturer plate from 60s-70s or earlier, antique-mall finish patina, weight commensurate with size) before escaping to vintage tier. CONDITION REPORTING HARD RULE: description MUST name every visible defect with location; "good condition" only when zero defects visible; pricing must reflect visible condition. FURNITURE COMPARTMENT NAMING HARD RULE: name each compartment by type (drawer/shelf/cubby/magazine rack slot/door cabinet) AND position (top/middle/bottom); no lumping. **Pattern lesson: visual styling of "dark wood + small + traditional shape" is NOT a vintage tell; modern factories produce exactly this look at Walmart prices. Tier routing must gate on positive vintage construction tells.**
- **PHOTO CAPTURE ARTIFACTS EXEMPTION + REAL TEXTILE/TRIM EXEMPTION on AI-GENERATED PHOTO branch** (`services/gemini.ts:471`). Three false-positive red flags on real photos: decora/scene mirror-selfie with bloom + motion blur; jirai full-body selfie with plushie-cluttered background; studio lingerie shot with Victorian-floral pink lace. PHOTO CAPTURE ARTIFACTS EXEMPTION covers motion blur on extremities, bloom/halation/lens-flare, JPEG/video/TikTok compression banding, low-light noise, out-of-focus, beauty-filter softness, Y2K/dreamy/grunge filter aesthetics, AND alt-fashion/J-fashion subculture styling (decora/scene/fairy kei/jirai kei/lolita/harajuku/kidcore) with rainbow hair, plush-cluttered bedrooms, kandi, fishnets, character tees as REAL fashion and a NEGATIVE signal against SIGNATURE A/B "perfectly clean room" patterns. REAL TEXTILE/TRIM EXEMPTION covers lace (Chantilly/Alençon/eyelash/broderie anglaise/guipure/illusion bridal/baroque), machine-embroidered overlay, beaded/sequined/pearl appliqué, jacquard/brocade/damask, sheer/mesh/tulle/organza, tie-dye/ombre/batik. Both exemptions sit BEFORE AI CONTEXT RECOGNITION so they short-circuit signature matching. Filter-softened skin alone no longer trips face/skin/hair compound; now requires hair-edge fade AND one unrelated AI tell. **Pattern lesson: AI-detection rules need explicit carve-outs for the optical artifacts of real cameras and intricate-but-mechanical real textiles; carve-outs go BEFORE the signature/tell pipeline because once a signature matches, the pairing threshold drops.**
- **NEW pricing tier 088, Vintage Tableware / Dinnerware / Collector Plates + TABLEWARE BACKSTAMP & ERA HARD RULE** (`services/gemini.ts`, `PRICING_TIERS.md`). Plates fell through the Decor smalls $10-$80 unbranded / $40-$300 signed studio pottery generic bucket. Real comps: Pyrex Butterprint $80-$200, Gooseberry pink $120-$300, grail $200-$1500+; original Fiestaware medium green $80-$400; Roseville Pine Cone $80-$300, rare Roseville $200-$1500+; signed Scandinavian MCM $80-$300+; Boleslawiec $80-$300. Tier covers Pyrex (Corning 1947-80s opal-glass), original Fiestaware (Homer Laughlin pre-1986), Wedgwood Jasperware vintage, Spode (Blue Italian/Christmas Tree), Noritake Art Deco "M-Mark", American art pottery (Roseville/McCoy/Hall), Royal Doulton HN, Scandinavian MCM, Depression/Carnival/Milk glass, Polish Boleslawiec/Mexican Talavera/Italian majolica. HARD RULE requires positive maker's-mark ID before vintage premium; post-1986 Fiestaware trap colors (periwinkle/sapphire/plum/raspberry/lemongrass/etc.) didn't exist 1936-1972; vintage Pyrex requires opal/milk-glass body (modern Instant Brands is clear borosilicate). Condition penalties: chip/crack -40-60%, crazing -20-35%, glaze loss -25-40%. Decor smalls narrowed "ceramics" → "non-functional decorative ceramics". Partially closes POST_LAUNCH Pottery backlog. **Pattern lesson: when a tier's most valuable sub-segment depends on a specific maker's mark, the auth rule must name era markers (mold marks, date codes, color palettes) that distinguish vintage from reissue.**
- **`<InlinePromptButton>` component unifies Yes/No prompt buttons across scan + detail** (`components/InlinePromptButton.tsx` NEW, `app/(tabs)/scan.tsx`, `app/detail.tsx`). The 5/17 polish pass added `minHeight: theme.minTouchTargetSize` to detail-screen Yes/No styles; combined with `borderRadius: full` and short content padding, this stretched them into oversized ovals. Scan-tab buttons stayed correct. Shared component encapsulates the canonical style (paddingVertical: 6, paddingHorizontal: 10, radius.full, caption typography weight 600, hitSlop: 12) with variants `accent` / `muted` / `danger` / `neutral` + optional `textColor` override for the verification-flag dynamic accent. Replaced 10 Pressables across both files (6 detail + 4 scan); removed 8 orphan styles. Yesterday's Clear-button reposition reverted (top-right looked weird, restored bottom-center). **Pattern lesson: minHeight on a small button with full-radius produces an oval if content is short. Canonical mobile pattern: small visual + larger hitSlop, not larger visual. Component-level enforcement beats per-screen styling drift (same lesson as the 5/17 `<Button>` rollout).**
- **Vault search overhaul: multi-word AND + synonyms + item-date + quick-flag tokens + price/category match + brand-normalize + result count** (`app/(tabs)/index.tsx`). Single `itemMatchesToken / itemMatchesQuery` pair at module scope drives both `filtered` and `filteredHauls`. Whitespace-split tokens, each must match somewhere. `SYNONYM_TO_CAT` maps user words (jeans→denim, purse→bags, kicks→shoes, coat→outerwear, earrings→accessories, ~40 entries) to canonical ItemCategory values. Item.date normalized + month-shortened so "april" matches April items in Flips/Closet (was only in Hauls). Quick-flag tokens (flagged/redflag/handmade/custom/upcycle/altered/reworked) fire on active-snapshot `redFlags`/`isCustom`/`beforeAfterDetected`. `normalizeToken()` strips apostrophes (straight + curly), hyphens, periods, commas, slashes so "levis" matches "Levi's". Also matches price (resale/sold/paid exact via "$40" or "40"), category, status, platform. Small caption result count beneath the search bar when query is non-empty. **Pattern lesson: search-quality wins compound when they share one matcher; per-field if-chains drift and silently skip categories.**
- **Detail-page price live-commit fix** (`app/detail.tsx`). The paid/resale/soldPrice TextInputs were only persisting to inventory on blur (via `flushPrices`), so Profile's Total Profit / Best Single Flip / Total Invested appeared frozen while typing. Switched onChangeText handlers from `update()` (local-only) to `flushPrices()` (local + inventory). `flushPrices` now also sets `hasEdited` for symmetry. onBlur still owns empty-string and invalid-number edge cases.
- **Haul-detail title gets pencil-icon-inline + Saved-for-later red flag badge** (`app/haul-detail.tsx`, `app/(tabs)/scan.tsx`). Haul detail: standalone create-outline button dropped from header right cluster; title block is now a Pressable with `{title || 'Untitled haul'}` (mauve when untitled) + 16pt mauve pencil; meta line always leads with date. Mirrors item-detail title pattern at detail.tsx:818. Saved-for-later thumbnails now compute `(item.redFlags?.length ?? 0) > 0 && !item.redFlagDismissed` and render the red flag badge top-right alongside the bookmark; mirrors Recent finds + Vault grid pattern.

### Session, 2026-05-17
- **NEW pricing tier 086, Knit Bodycon / Off-Shoulder Mini Dresses** (`services/gemini.ts:259`, `PRICING_TIERS.md`). Unbranded ribbed-knit (off-shoulder/square-neck/scoop/cowl/halter, olive/sage/cream) was hitting Unknown $10-$30 floor; comps $18-$35. Unbranded $20-$32 / branded mid-tier (Princess Polly/PLT/Lulus/Boohoo/ASOS/F21) $25-$40. Q2 spring-knits spike pre-baked. Aritzia/Free People/Anthropologie/Reformation stay on contemporary tier. **Pattern lesson: trending-color + trending-silhouette unbranded combos need their own tier; the commodity-floor catch-all underprices anything currently moving on TikTok/IG.**
- **NEW pricing tier 087, Modern Multi-Function Record-Player Cabinets + sibling PARTICLEBOARD MASQUERADE MODERN REPRO EXEMPTION** (`services/gemini.ts:318,493`, `PRICING_TIERS.md`). Crosley/Victrola/Innovative Tech/Wockoder/ION/Jensen repros ($80-$200 retail) priced $60-$120 via Generic vintage tier; comps $30-$75. Tells (any ONE): CD slot, cassette deck, AUX/USB/Bluetooth, plastic platter, mesh-grille speakers, decorative dial face, 14-24" footprint, MDF veneer. Explicit "do NOT route through Generic vintage / Vintage American mid-tier / antique". Authentic 60s-70s consoles ($150-$800+) separate via positive tells (4-6ft cabinet, real solid wood, die-cast platter, manufacturer plate, 100+lbs). PARTICLEBOARD MASQUERADE flag suppresses for matching units. **Pattern lesson 1: visual styling that references a vintage era is NOT vintage evidence; require positive vintage tells. Pattern lesson 2: red flags should suppress when the price tier already accounts for the substrate concern, otherwise the warning becomes noise.**
- **CAPTION/OVERLAY EXEMPTION on isCustom + beforeAfterDetected** (`services/gemini.ts:126,818`). TikTok narrative captions ("THEN I DID", "BEFORE / AFTER", "FIRST I... THEN I", "watch me transform", "from this to this", "POV: I made") tripped `beforeAfterDetected = true` → cascading `isCustom = true` (line 822) → routing clean factory dresses through HANDMADE DRESS EXCEPTION ($80 vs real ~$25). Exemption inserted at TOP of isCustom rule; classifier caption bullet expanded: if all photos show matching construction and only "before" signal is text, classify as multi-angle and set `beforeAfterDetected = false`. Screenshot memory broadened from "screenshots never drive RED FLAGS" to "screenshots never drive ANY classification". **Pattern lesson: every new classification signal must include caption-exemption carve-out at the TOP of the rule, not as a bottom-of-list disclaimer; bottom-of-list disclaimers get ignored by the model when the bias direction at the top is strong.**
- **`<Button>` component + 9 CTA replacements + Flips/Closet card unification + touch-target HIG pass** (`components/Button.tsx` NEW, `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`, `app/detail.tsx`, `components/PaywallModal.tsx`). Button: variants primary/secondary/ghost × sizes md (48px)/lg (56px) + loading + icon left/right, theme tokens (radius.sm + spacing.xl/xxl + vintageBlueDark). Replaced markSoldBtn/errorBtn/addToClosetBtn/newHaulBtn/2×emptyBtn/emptyBtnSecondary(ghost)/upgradeBtn/PaywallModal cta; removed ~80 lines orphan + dead styles (photoBtn/removePhotoBadge/collageRemoveBtn/addBtn). All hardcoded radii (24, 28) and one-off heights gone. Card unification: Flips/Closet gained outer border (surfaceVariant 1px), `cardImageBlock` wrapper, `cardFooter` with lavender border-top + sm/xs/sm padding, 2-line truncated name `flex: 1` left + right-aligned profit-colored price (`alignItems: 'flex-end'`); matches Haul `collageCell`. Touch targets: filter chips + Add photos link `hitSlop {top:5, bottom:5}` (34→44px); store picker chips `minHeight: theme.minTouchTargetSize` (wrap layout). **Pattern lesson 1: same-intent CTAs need component-level enforcement; per-screen styles drift even when devs reach for the same theme tokens. Pattern lesson 2: shadow alone isn't enough to define card edge on cream bg; surface-on-cream dissolves without a border. Pattern lesson 3: 2-line truncated name + right-aligned price reads as marketplace standard (Depop/Poshmark/Etsy); stacked name-then-price feels like a tag stack and less polished.**
- **BOIR exempt, NOT required to file**. FinCEN interim final rule 2025-03-26 narrowed "reporting company" to foreign-formed entities only. ThriftVault LLC (TN-formed) is exempt. Re-verify when FinCEN finalizes permanent rule (expected 2026). Apple org-conversion reply sent 5/16 with live `thriftvaultapp.com`; awaiting Apple. AI detection `__DEV__` log instrumentation + `EXPO_PUBLIC_FORCE_CLAUDE_SCAN` bypass stripped (5/14 parked debug abandoned).

### Session, 2026-05-16
- **MULTI-ZONE PRINTED TEXTILES carve-out on ALL-OVER DIGITAL PRINT** (`services/gemini.ts:423`). Y2K mesh maxi kaftan (animal print + tribal geometric + abstract painterly zones in adjacent panels on a single continuous fabric) was false-flagging. Existing exemptions covered single-pattern textiles and actual multi-fabric patchwork construction, but not printed-patchwork (Sky to Moon / Charlotte Russe / F21 mall-tier 2005-2015 boho/festival/Y2K kaftans, sarongs, coverups). Requires: zones filled with textile repeats (no pictorial subjects), one continuous polyester/mesh/jersey with no seams, V-neck or deep-V maxi tells. Genuinely pictorial zones (characters, scenes, slogans, photorealistic) still flag. Sits between multi-panel construction exemption and lolita pictorial exemption. **Pattern lesson: textile-exemption lists need a "multi-pattern mosaic on single fabric" clause to match decades-old printed-patchwork aesthetic; treating each zone individually as exempt isn't enough because the model reads the combination as pictorial collage.**
- **Pricing-drift watch upgraded from 14 fixed tiers to 85-tier registry with weighted rotation** (`PRICING_TIERS.md`, `pricing-drift-reports/README.md`, `trig_0113xK23HSeSpB46ySDYJtBF`). 81+ tiers in `services/gemini.ts` previously got spot-checked only at quarterly refreshes (next 2026-07-30); now HOT 12 every 2 weeks, WARM 24 every 8 weeks, COOL 49 every ~11 months, deterministic ISO-week hash drives slice selection (stateless). Registry table has per-row Depop/Poshmark/eBay queries (furniture rows substitute Chairish/1stDibs/Etsy via `(Chairish)` cell prefix). Routine prompt fetches both files via WebFetch each Monday, computes the week's 10-tier slice with `HOT_POOL[(WEEK*6) mod len..][:6]` + parallel WARM/COOL slices, fills template, opens PR. Code-level clamps (DIY Distressed Denim, BOOST STACKING, Confidence Downgrade, Crochet text-detection) live as `code_clamp` rows with platform queries = `n/a`; routine switches to narrative sanity-check for those. Verdict: 15% out-of-band median OR 2+ platforms outside = drift; eBay weighted 2x; new band rounded per `roundDisplayPrice`. **Pattern lesson: routine reference data that changes frequently belongs in the repo (PR-editable, gitted, diffable); routine prompt that changes rarely stays in the schedule UI. Inverts the usual code-in-repo / prompt-in-config split because the agent is remote and its prompt is the harder thing to version.**

### Session, 2026-05-15
- **Red Flag banner split into verification vs counterfeit framing** (`services/gemini.ts:54–74` `classifyRedFlags`, `app/(tabs)/scan.tsx:219–339`, `app/detail.tsx:39,764–769,1143–1207`). Prefix-matches `redFlags` strings against 4 furniture verification prefixes (`Verify solid wood vs printed-veneer`, `Smell-verify`, `Inspect seams and joints`, `Structural damage visible`); all-verification → teal "Worth verifying" + "Inspect in person before paying high prices." + single "Got it" dismiss. Mixed/counterfeit (AI artwork, stock-photo sentinel, MCM KNOCKOFF, bag/sneaker/jewelry masquerade) keeps red framing + Yes/No. `Got it` reuses false-alarm handler (`{redFlagPrompt:true,redFlagBanner:true}`). No schema/migration. **Pattern lesson: string-mixed array types should classify in UI via prefix matching, not require schema/migration when the producer (prompt) controls phrasing.**
- **PARTICLEBOARD MASQUERADE substrate-proof gate** (`services/gemini.ts:466`). 4-photo mahogany→sage-green dresser refurb false positive. Positive-ID precondition: `beforeAfterDetected = true` AND any non-cover photo shows raw wood grain (sanded surfaces, unfinished drawer interiors, exposed end-grain, unpainted sections, dovetail/mortise joinery) → SUPPRESS regardless of cover finish. Mirrors MCM bypass pattern. **Pattern lesson: prompt exemption phrased "don't speculate" is weaker than "use X as positive proof"; invert directives where possible.**
- **AI-GENERATED ARTWORK false positive on Tumblr-shared Y2K checkerboard pants** (`services/gemini.ts:426,429,434,446`). 4 edits: (1) garbled-text tell gains UI/overlay exemption mirroring AI-GENERATED PHOTO branch (UI overlays, captions, watermarks, social re-share text, reblog/repost indicators, hashtags, usernames, foreign-script overlays, screenshot chrome); (2) PRECONDITION requires positive identification ("name the design out loud, a [character/scene/slogan/etc.] is printed on the [garment area]"); fails on geometric repeat/color block/textile pattern; (3) "checks" exemption broadened to neon/high-contrast/two-color/Vans-style/racing/Y2K checkerboard; (4) platform list gained Tumblr (reblog/repost indicators, dashboard chrome). **Pattern lesson: sister branches with parallel tells need synchronized exemptions; the artwork branch was missing the photo branch's screenshot/UI carve-out, so social re-share chrome tripped the garbled-text tell.**
- **Y2K alt-fashion non-denim pants tier with Depop/Poshmark/eBay sold-comp anchors** (`services/gemini.ts`, between Y2K viral brands and Modern Levi's). Tripp NYC / Lip Service / Hot Topic Morbid / modern Y2K-revival twill/polyester flares with subculture detailing (checkerboard waistbands, ribbon-laced sides, oversized D-rings, chain trim, parachute/cargo straps, contrast piping). 90-day comps: unbranded modern Depop $20–$45 / Poshmark $15–$40 / eBay $20–$50 (default $25–$55 lower-middle); authenticated vintage Tripp/Lip Service with brand tag Depop $40–$90 / Poshmark $35–$75 / eBay $50–$120. Explicitly blocks routing through Premium denim flare SPIKING, Authenticated Y2K premium denim, AND HANDMADE PANTS EXCEPTION. Q2 2026 Y2K spike pre-baked, do NOT compound. **Pattern lesson: pricing tiers need explicit "do NOT route through X" clauses for each adjacent path or the model will bypass via the cheapest semantic route.**
- **isCustom carve-out for factory subculture detailing** (`services/gemini.ts:137`). "Waistbands added or removed" tightened to require visible modification evidence (raw cut edges at the join, mismatched thread color/weight, hand-finished topstitching, puckered attachment). EXCLUSION for factory subculture detailing on Y2K alt-fashion pants/skirts: contrast/decorative waistbands (checkerboard, grosgrain, jacquard, studded, eyelet-laced), oversized D-rings, chain trim, ribbon-laced panels, parachute straps, contrast piping are factory-manufactured details with clean factory stitching at the join, NOT isCustom signals. Belt-and-suspenders carve-out at top of `HANDMADE PANTS EXCEPTION` (`services/gemini.ts:241`) bails to factory pricing. **Pattern lesson: the line 125 "when in doubt set isCustom = true" directive biases the model toward over-flagging, so specific exclusions must name the bias to push back.**
- **Duplicate-detection stop-words extended + threshold bumped** (`app/(tabs)/scan.tsx:100–112,143`). `DUPLICATE_STOP_WORDS` gained era markers (vintage/retro/y2k/2k/deadstock/og/90s/80s/70s/60s/2000s/nineties/eighties/seventies/sixties) and condition tokens (condition/used/nwt). `DUPLICATE_SCORE_THRESHOLD` 0.55 → 0.60. Targets 3-token era+color generic-overlap false positives ("Vintage Y2K Black Flare Pants" vs "Vintage Y2K Black Mini Skirt" drops to 1 shared token after stop-word stripping, `!brandMatch && matchedTokens.size < 3` floor clamps to 0.40). Image-size byte-exact fallback (0.99) and brand-anchored matches unaffected.
- **Removed `LEGACY_DEMO_ITEM_NAMES` migration filter** (`constants/seedItems.ts`, `context/InventoryContext.tsx:1,129–130`). Dead code (pre-launch, no real users). `DEFAULT_ITEM_PLACEHOLDER_IMAGE` retained (used at `scan.tsx:1583`).
- **Detail-page scan card asymmetry confirmed intentional**. Scan card shows bold single recommended price `formatMoney(scenario.suggestedResale)` + range; detail page shows range on snapshot + auto-fills recommended into editable `item.resale`. Adding `suggestedResale` to `ItemScanSnapshot` would create three competing prices and a stale frozen number once user edits resale.
- **Cloudflare Web Analytics chosen for landing page** (planned, not wired). Free `<script>` beacon, no cookies, no consent banner, no DNS migration. Setup: sign up → add domain → paste snippet in `<head>` → wait ~24h. GoatCounter is the alternative. Privacy policy needs a one-line disclosure once wired ("aggregate visit counts via Cloudflare Web Analytics, no cookies or personal data").

### Compressed Sessions, older than 4 days
*Major decisions are consolidated above.*

- **AI-GENERATED ARTWORK PRECONDITION (5/13)**, Branch firing on DIY-distressed jeans without print/graphic. PRECONDITION at top requires actual applied graphic design (paint/sublimation/screen-print/embroidery pictorial); exempts plain solids, distressing/rips/bleaching, classic textile repeats, construction details, brand labels. Dropped loose "photorealistic art style" tell.
- **Before/After denim back-view false positive (5/13)**, Added denim back-view to "Tells AGAINST (b)" + anatomical-concentration principle (front-only graphics, knee rips, back-yoke embroidery, single-sleeve paint are one-sided design, not a before).
- **Repurposed-textile outerwear sub-track (5/13)**, HANDMADE OUTERWEAR EXCEPTION split into FIBER-ART + REPURPOSED-TEXTILE/SEWN-FABRIC (blanket-jacket/quilt-coat/frankenjacket). (ii) minimum MODERATE $55-$120, complex $90-$180. Pattern lesson: handmade pricing exceptions need sub-tracks by construction type; fiber-art and sewn-fabric have different labor floors.
- **LOLITA/KAWAII J-FASHION carve-out on ALL-OVER DIGITAL PRINT (5/13)**, 4th "Do NOT flag" clause: lolita silhouette (puff/mutton/bishop sleeves + 2 of tiered ruffled skirt/multi-row lace/ribbon bows/pintucks/cinched waist/shirred back/matching headdress) + elaborate pictorial sublimation (carousels, sweets, castles, Alice, stained glass) is the defining genre aesthetic. Covers AP/BtSSB/AatP/IW/Meta/h.NAOTO + replica. Lolita is factory-made (isCustom=false). Out of scope: dedicated lolita pricing tier.
- **Legal docs at pretty URLs (5/14)**, `terms/index.html` + `privacy-policy/index.html`. Canonical thriftvaultapp.com/terms/ and /privacy-policy/. In-app refs updated across PaywallModal, profile, STORE_LISTING.md, MVP.md.
- **Kit waitlist form on landing hero (5/14)**, Direct AJAX POST to Kit `/subscriptions` (Form ID 9443345), no Kit JS/CSS. Custom markup (cream-warm input, brass-soft border, teal CTA). Success message mentions spam folder. Pattern lessons: skip provider's JS/CSS on static-site form integrations and POST directly; brand-new Kit accounts hit spam until sender reputation warms (~25-50 confirmed subs).
- **Hangtag design language extended page-wide (5/14)**, Punched-hole + twine top + brass-soft border + `4px 4px 14px 14px` radius + alternating 0.3-0.5° tilts that straighten on hover with translateY(-4px) lift. Applied to pricing cards (3-col), features (3x2), hero logo. Brass Save 33%/50% ribbons on Season Pass + Annual. Pattern: vintage motif can become page-wide visual language when consistently applied; dropping decoy "featured" emphasis (5/11) leaves cards equal, savings ribbons backfill hierarchy with truthful value signaling.
- **Trial strip color = teal-deep (5/14)**, Brass+cream fails WCAG AA (~2.5:1), brass+charcoal reads washed. Teal-deep ties to H1 italic + Notify Me button.
- **AI estimate disclosure surfaces (5/14)**, Onboarding slide 1 italic mauve note + Profile Settings "About AI estimates" row (sparkles icon, Alert.alert explanation). Scan card unchanged (existing range + Yes/No + low-data flag communicate uncertainty contextually). Pattern lesson: per-scan disclaimer dilutes existing uncertainty signals; one-time onboarding + permanent Profile section is honest hygiene without visible nag.
- **AI photo detection iteration deferred (5/13-5/14)**, 3 AI images (mirror-selfie composite, flat-lay sweatshirt, striped shirt) bypassed 4 prompt iterations. Edits still in place: paired tells, AI CONTEXT SIGNATURES A/B/C with lowered threshold, narrowed professional-photo exemption, bias line acknowledging 2026 AI prevalence. `__DEV__` instrumentation + `EXPO_PUBLIC_FORCE_CLAUDE_SCAN` parked 5/14, stripped 5/17.
- **DIY-distressed denim clamp (5/12)**, Split DENIM EXCEPTION simple band into SUBTRACTIVE ($20–$40, rips/holes/shredding) vs ADDITIVE ($25–$55, patches/dye/paint). NEW `isDIYDistressedDenim` clamp $45/$20. Pattern lesson: density of subtractive labor is NOT a craftsmanship signal, separate additive (skill) from subtractive (hours).
- **Pricing-tier drift watch routine launched (5/12)**, Weekly remote agent `trig_0113xK23HSeSpB46ySDYJtBF` (Mon 9am ET) fetches `PRICING_TIERS.md` and opens a drift-report PR. v1 had 14 fixed tiers; upgraded 5/16 to 85-tier weighted-rotation registry (see 5/16 entry for current state).
- **Domain `thriftvaultapp.com` live on GH Pages (5/11)**, Registered via Namecheap, WHOIS visibly tied to ThriftVault LLC (no privacy proxy). DNS: 4× A records + CNAME `www`. Legal docs auto-rehosted at `/assets/...`. Unblocked the Apple org-conversion reply.
- **Landing page polish (5/11)**, Pattern lesson: don't add CSS framing around an image that already has its own internal framing, they fight no matter which `object-fit` you pick. Pattern lesson: featured pricing-card emphasis should match best-value plan or be dropped entirely; middle-card weight creates unintentional decoy hierarchy. Pre-launch signaling at three depths (prelaunch-bar, status-badge, plans-note italic).
- **Apple org website + domain pick (5/09)**, Apple requires "valid organization website" for Individual → Org conversion. Picked `thriftvaultapp.com` over `.co` to block typo-traffic squatting. WHOIS must show ThriftVault LLC (no privacy proxy until Apple approves).
- **Landing page first build (5/09)**, Rebuilt via frontend-design skill into editorial vintage / curio-shop aesthetic. **Pattern: `thriftvault_logo.jpg` (v1) = wordmark for marketing surfaces; `thriftvault_logo_v2.png` (v2) = iOS app icon (camera-in-frame, no wordmark), don't confuse on web.**
- **Headline price lean-low (5/08)**, Replaced midpoint `(low+high)/2` with `low + (high-low)*0.3`. Resale comps cluster ~38% of range, not 50%.
- **Modern Levi's trucker tier + rescan default-lower bias (5/08)**, NEW Modern Levi's denim jacket tier ($30–$65 used, NWT $95) above Vintage Levi's line with "factory distressing ≠ vintage tell" callout. `RESCAN_CORRECTION_SUFFIX` default-lower bias: wrong-flags are usually overprice protests; generic "distressed/worn/strong brand" are NOT upper-tier signals.
- **Share card design staged (5/08)**, `SHARE_CARD_PLAN.md` 9:16 composed card (photo 65% + info 35% + watermark), 3 intent variants. `view-shot` + `expo-sharing` deferred to prebuild day (MVP step 10).
- **Handmade labor-hour formula → finished-look tier ladders (5/07)**, Removed `materials + hrs × $25 + 30% uniqueness + 20–30% trending` (overshoots unknown-maker Depop comps 30–80%). Added 6 finished-look exceptions: OUTERWEAR $35–$180, DRESS $30–$200, SKIRT $20–$140, BAG $20–$140, ACCESSORY $15–$120, FIBER-ART $25–$300. See `feedback_handmade_pricing.md`.
- **FIRST-PASS ANCHORING rule (5/07)**, Default position = band low + 30% width, NOT upper edge. Reserve upper third for explicit upper-tier signals (named maker, NWT, exceptional construction, mint). CONDITION DEFAULT: assume "used-good" unless damage or tags visible.
- **Custom outerwear / bags / caps clamps (5/07)**, `isCustomOuterwear` $180, `isCustomBag` $140, `isCustomCap` $80 (new `isCapText` regex). Covers altered factory bases + from-scratch handmade.
- **MCM bypass on particleboard clamp (5/07)**, `MCM_BRAND_RX` (eames/knoll/saarinen/cassina/vitra/nakashima/...) bypasses `PARTICLEBOARD_RX` for authenticated mid-century pieces with original laminate tops.
- **Signed-vintage costume jewelry tier (5/07)**, `SIGNED_COSTUME_RX` (Trifari/Coro/Weiss/Haskell/Eisenberg/Hobé/Whiting & Davis/...) caps $120 floor $20, before terminal no-hallmark branch.
- **Y2K viral brands exempt from boost-stacking (5/07)**, `LUXURY_EXEMPT_RX` extended to Juicy Couture/Von Dutch/Ed Hardy/Baby Phat/Apple Bottoms (legit Y2K tier $100–$200 was clamping to $130).
- **Furniture refurb red-flag false positives (5/07)**, Header rule: evaluate every flag against COVER PHOTO, not before/in-progress photos. PARTICLEBOARD: don't speculate under paint/refinish. HIDDEN ODOR exclusion expanded to painted/restained/limewashed/refinished wood. SCREENSHOT/UI EXEMPTION: glossy paint and "too clean" looks ≠ AI generation.
- **Save-for-later race, in-flight scan clobbers loaded saved item (5/07)**, `openSavedItem` aborts `abortControllerRef.current` and resets scanning flags before restoring; `if (controller.signal.aborted) return;` added after network awaits in `handleScanStaged` + `handleConfirmHandmade`. Pattern lesson: an `abort()` doesn't help if the fetch already settled, every async-`setResult` path needs both abort AND post-await `signal.aborted` guard.
- **Camo bolero overpricing, restructured-tops mis-routed (5/07)**, Multi-photo BEFORE/AFTER outcome now: `category = "tops" AND alteration STRUCTURAL → HANDMADE SEWN-FABRIC TOP EXCEPTION`. ALTERED FACTORY BASE reframed as "SURFACE DECORATION ONLY" with explicit ranges (light $25–$45 unbranded / $35–$60 branded; dense $40–$70 / $55–$90). Pattern lesson: any "$X / $Y" notation risks being read as a range, write explicit bands.
- **Haul item sort, newest first (5/07)**, `app/haul-detail.tsx` + `app/(tabs)/index.tsx` hauls memo: `sort((a, b) => b.id - a.id)`. Active-haul "I just scanned that" feedback beats stable visual fingerprint.
- **6 new pricing sub-tiers (5/06)**, Lululemon (Align $30–$100, Define $50–$185); Designer SLGs (LV wallets $80–$400, Hermès H belt $300–$1100, silk twill $120–$600); Vintage graphic/band tees $20–$220 (grail-tier $500–$2000+ flagged low-confidence, not auto-priced); Vintage sports jerseys (M&N $80–$300, Champion Reverse-Weave $40–$300); Doc Martens $40–$300; Sunglasses $25–$500+. Prompt-only.
- **Furniture false-positive red flags (5/06)**, HIDDEN ODOR restricted to upholstered fabric/leather/padded; hard surfaces (wood/wicker/rattan/metal/glass) exempt. STRUCTURAL DAMAGE requires unambiguous visible damage; patina alone doesn't trigger. "When in doubt, do NOT flag, false damage warnings erode trust."
- **Recent finds red flag badge (5/06)**, Mirror of Vault grid badge on `app/(tabs)/scan.tsx` Recent Adds; same `tv_prompt_dismissed_${id}.redFlagBanner` dismissal, 11px sized for 100×100 thumb.
- **Scan card corner clipping (5/06)**, `cameraBox` + `cameraBgImage`: removed redundant image borderRadius (24 vs container 22 exposed charcoal at corners); switched cameraBox bg charcoal → cream.
- **Delete scan with confirmation + snapshot fallback (5/06)**, `deleteActiveSessionSnapshot` mirrors detail.tsx pattern: filter active out of `sessionSnapshots`, switch to next, only `clearResultAndPhoto()` if last. `Alert.alert` confirm; `sessionSnapshotsRef`/`activeSessionSnapshotIdRef` synced for async-confirm-time reads.
- **Multi-photo classifier, multi-angle dolman false positive (5/06)**, `multiPhotoSuffix` "Tells AGAINST (b)" bullets: same restructured garment from different angle (asymmetric/dolman/halter look "plainer" from back), same scene/styling across photos (try-on session ≠ transformation), caption text describing technique ≠ visual evidence.
- **FINAL SANITY CHECK pre-return self-critique (5/06)**, `services/gemini.ts` end of pricing instructions: pull resaleHigh down if >30% over likely sold comp; tier-straddle ranges → pick tier and set confidence:low; cap handmade labor outputs against unknown-maker comps; re-check BOOST STACKING when 3+ boosts. Closing: sold comps are ground truth, formula is starting estimate.
- **Handmade sewn-fabric tops first-scan overpricing (5/06)**, Ported SEWN-FABRIC TOP EXCEPTION from `HANDMADE_SUFFIX` into main `PROMPT` with tightened bands (simple $20–$45, moderate $30–$60, complex $50–$95, ceiling $95). `isHandmadeTop` clamp cap $120 → $95, floor $25 → $20. Pattern lesson: pricing exceptions added in `HANDMADE_SUFFIX` need porting to main prompt, suffix only fires on user-confirmed handmade rescan.

- **Multi-photo before/after, shape-shift upcycles (5/05)**, `multiPhotoSuffix` loosened to "AT LEAST TWO of these are true" with shared fabric identity as primary tell. Covers tee → ruched/halter/corset, sweater → vest, jeans → skirt, curtains → garments, frankenpieces, furniture repurpose. "No shared fabric identity" added to Tells AGAINST.
- **`beforeAfterDetected` lost on rehydrate (5/05)**, `sanitizeSnapshot` (`InventoryContext.tsx`) wasn't copying field off `source`; same shape as 4/23 redFlags strip. Persists alongside `isCustom`/`authFlags`/`redFlags`.
- **Furniture before/after + refurb premium (5/05)**, Staged-photo classifier extended with furniture refurb tells (worn → limewashed, stained → boucle, recane, brass pulls). Outcome routing: `category = "furniture"` BEFORE/AFTER picks FURNITURE PRICING, not ALTERED FACTORY BASE. Refurb premium 20–50% → 30–50%.
- **ALL-OVER DIGITAL PRINT carve-outs (5/05)**, Hawaiian/watercolor/painterly/tropical florals + tie-dye exempted; NEW multi-panel override (patchwork/spliced/mismatched/fringe/lace-up/grommet beats bullet regardless of pictorial reading).
- **Jewelry scan accuracy (5/05)**, NEW `► JEWELRY PRICING` branch (signed costume $20–$120, gold-filled $20–$75, solid gold by karat, pearl tiers, watches split fashion/mid/luxury). NEW `JEWELRY HALLMARK, HARD RULE` (yellow ≠ gold, silver-tone ≠ sterling, sparkly ≠ diamond without 925/STER/14k/18k/PLAT). Clamps: no-hallmark $30, designer-without-stamp $150 (Tiffany/Cartier/VCA/Pandora/Yurman), watch-luxury-without-stamp $400 (Rolex/Omega/Patek/AP). NEW `HANDMADE JEWELRY EXCEPTION` $15–$180.
- **Bags + sneakers auth (5/05)**, NEW `BAG AUTHENTICATION, HARD RULE` per-brand (LV date code, Chanel 8-digit, Hermès blind, Goyard MAISON, Coach creed, Gucci/Prada/Dior plaques). NEW `SNEAKER AUTHENTICATION` splits BASE hyped (Jordan 1/Dunk Panda/Yeezy 350, silhouette OK) from COLLAB (Travis Scott/Off-White/Fragment/Sacai, require SKU). Clamps: luxury-bag-without-auth $300, sneaker-collab-without-auth $250.
- **`SECURITY_AUDIT.md` refresh (5/05)**, 5/03 Sentry DSN wire-up closed only open Low finding.
- **Red flag UI text false positives (5/04)**, Front-loaded `SCREENSHOT/UI EXEMPTION` gate; tightened text bullet to require text on PHYSICAL SURFACE + 2nd artifact. TikTok/Reels captions, hashtags, watermarks, foreign-script overlays were tripping garbled-text bullet.
- **Furniture scanning, full sweep (5/04)**, Added `'furniture'` as `ItemCategory` (subtype by keyword). NEW FURNITURE PRICING branch (brand/era tiers IKEA→MCM→antique, material signals, -30% size penalty, MCM ATTRIBUTION HARD RULE, designer name needs label/sticker/stamp, else "MCM-style" $80–$300). NEW furniture red flags (PARTICLEBOARD MASQUERADE, MCM KNOCKOFF, HIDDEN ODOR, BEDBUG, STRUCTURAL DAMAGE). Furniture upcycle carve-out (refinish/reupholster/recane allowed). Particleboard text → $80 clamp; furniture skips `confidenceFromRangeWidth`. `KNOWN_PLATFORMS` + CATEGORY_GROUPS extended.
- **Rescan `beforeAfterDetected` lost on single-photo rescans (5/03)**, Clamp required `images.length >= 2`; fix falls back to `priorResult?.beforeAfterDetected === true`. `rescanWrong` paths thread `priorResult`; `confirmHandmade` paths OR in prior verdict at call site. `services/gemini.ts:499`, `app/detail.tsx:444`, `app/(tabs)/scan.tsx:1538`.
- **Handmade sewn-fabric top tier (5/03)**, From-scratch sewn handmade tops returning $95–$180 vs real Depop comps $40–$80. NEW `HANDMADE SEWN-FABRIC TOP EXCEPTION` (simple $25–$55 / moderate $40–$85 / complex $60–$120). `isAlteredTop` → `isHandmadeTop`, material-tier-aware ($180 cap crochet/hand-knit/cottagecore, $120 cap default sewn). `isExceptionalDenim` override still wins.
- **"Knit" disambiguation (5/03)**, Bare `knit(ted)?` was routing factory knit fabric (jersey/spandex/ponte) to craft tier. Tightened to require `hand[-\s]?knit(ted)?` or `crochet|knitwear|yarn|cottagecore|milkmaid|mending|patchwork|embroidered|macrame|needlepoint`. Pattern: ambiguous textile terms need disambiguation in both prompt and code.
- **Sentry DSN wired (5/03)**, TestFlight cut from launch plan (insufficient tester pool). DSN pasted in `.env`, verified with temp `Sentry.captureException`. Pre-launch SECURITY_AUDIT.md / LAUNCH_OPS.md "before TestFlight" → "before App Store submit".
- **Scan background reverted to v1 logo (5/03)**, `SCAN_BG_SOURCE` (`app/(tabs)/scan.tsx:117`) back to `thriftvault_logo.jpg`; v2 PNG still in `app.json` paths and `WebSidebar.tsx`.
- **Boost-stacking guard for factory items (5/02)**, `BOOST_BUCKETS` (5 regexes) + `LUXURY_EXEMPT_RX` in `services/gemini.ts`: `!isCustomScan && !LUXURY_EXEMPT && boostCount >= 3` → per-category ceilings (denim $180, tops/dresses $130, bottoms $120, outerwear $200, shoes $200, bags $220, accessories $120). Worst-case before: vintage Y2K Diesel rhinestone flares → $172–$1,290 (7× over comp); after: $180. Prompt-side `BOOST STACKING, HARD RULE` as belt-and-suspenders. `HANDMADE_SUFFIX` untouched (labor formula dominant).
- **Confidence tied to range width (5/02)**, `confidenceFromRangeWidth(aiConf, low, high)` helper (`services/gemini.ts:33`), downgrade-only. >3.0× ratio caps `high → medium`; >4.0× caps to `low`. `low`/`medium` never upgrade. Prevents `$50–$1200 "high confidence"` lie when boost stacking blows out range.
- **Category update on rescanWrong (5/02)**, `app/detail.tsx:520` was writing `name`/`resale` but ignoring `result.category`. Added `catUpdate` guarded against `'other'` to prevent downgrading specific category to AI fallback. Handmade-confirm path intentionally untouched (signal is "wrong pricing tier", not "wrong item").
- **"Size guess" placeholder bug (5/02)**, Schema example `"Brief description (size guess, color, material, condition)"` (`services/gemini.ts:41`) made Gemini echo "Women's size guess" when size couldn't be estimated. Rewrote with explicit examples (`"Women's 8"`, `"Men's L"`, `"US 10"`) + omit-instead-of-echo instruction.
- **App logo swap to v2 + App Store compliance blocker (5/01)**, Repointed `app.json` icon/splash/Android adaptive/web favicon (4 paths) + `WebSidebar.tsx:83` from `thriftvault_logo.jpg` to `thriftvault_logo_v2.png`. Verified v2 specs: 834×836, Format32bppArgb (alpha), circular frame, fails App Store icon (needs 1024×1024 opaque RGB full-bleed; iOS applies its own mask). Splash + Android tolerate alpha but still need 1024×1024. Native icon updates won't render until next prebuild/EAS build.
- **Security audit + fixes (4/30)**, Public repo. Scrubbed personal email from `eas.json`, hardened `Sentry.init`, closed `.claude/settings.json` pnpm/yarn loophole. New `SECURITY_AUDIT.md` (10-step methodology).
- **Q2 2026 sold-price tier refresh (4/30)**, `services/gemini.ts:98–128` + baselines. Cross-platform Depop/eBay/Poshmark research (~1800 samples, 18 tiers, eBay 2× trust). NEW: Y2K viral, factory sneakers (Generic→Premium→Hyped→Designer-collab), vintage non-denim Americana, knit sets, boots, hats. Refined Carhartt rare-color, denim cut differentiation (flare SPIKING / skinny FALLING), vintage Levi's Big E selvedge $300–$590. Quarterly refresh routine fires 2026-07-30.
- **Background scan perceived-seamless retry (4/30)**, Catch suppresses toast (gated on `pendingRetryRef`); finally keeps spinner; AppState retry via `queueMicrotask` on resume.
- **Profit subtext hidden on grid cards (4/30)**, Commented out (not deleted) on Flips/Hauls. Profile stats strip retains totals.
- **Agent safety guardrails (4/29)**, Triggered by Cursor/Opus 4.6 prod-wipe incident. Three layers: `.claude/settings.json` hard-denies (EAS prod, prebuild, force-push, hard-reset, clean -f, branch -D, cloud/DB CLIs, destructive migrations, `node -e`/`--eval`/`-p`); `SAFETY.md`; CLAUDE.md pointer.
- **Ops docs (4/29)**, `LAUNCH_OPS.md`, `DEV_OPS.md` new, solo launch playbook + release engineering reference.
- **Haul titles (4/29)**, Optional per-haul title via side-car `tv_haul_titles: Record<string,string>`. 60-char cap; blank deletes. Cleanup hook in `removeItem`. Title-as-hero / date-as-subtext.
- **Red flag prompt false positives (4/28)**, Pink ruffled umbrella was triggering AI-PHOTO. Tightened "fabric texture that looks CG-rendered" to require 2nd artifact. Expanded "do NOT flag" guard to enumerate radial/concentric symmetry, ruffles, pleating, smocking, fan/petal/flower, parasol shapes.
- **Yes/No haptics (4/28)**, `Haptics.selectionAsync()` (soft tick) on every Yes/No tap.
- **Saved-for-later prompt dismissals (4/26)**, `SavedScanItem` gained `promptCustomDismissed?` + `promptWrongScanDismissed?`; `handleSaveForLater` snapshots, `openSavedItem` restores.
- **Dark mode warmth pass (4/26)**, `theme/colors.ts` shifted dark surfaces toward amber/Edison-bulb; primary text → warm ivory `#EDE7DF`. Brand teal held (any darker drops below WCAG AA on `onPrimary`). All ratios ≥14:1.
- **Detail "Add photos" pill (4/26)**, Pill below carousel (`surfaceVariant` bg, `vintageBlueDark` icon+text, height 34) beat overlay variants. Pattern: overlays fight photo content; chip pills below media don't.
- **Scan tap-to-fullscreen (4/26)**, Post-result, camera box opens swipeable fullscreen viewer. Disabled when `!result && stagedPhotos.length > 0`.
- **Hauls empty + Unlisted badge (4/26)**, Inline "New Haul" CTA on empty Hauls. Unlisted badge teal → `surfaceVariant` so Unlisted=grey, Listed=teal, Sold=green visually distinct.
- **Red flag false positives on upcycled garments (4/24)**, Added `UPCYCLE EXEMPTION`. Narrowed `ALL-OVER DIGITAL PRINT` (requires pictorial; excludes textile repeats). Narrowed `AI-GENERATED PHOTO` (added construction guard, social media UI overlays exempt).
- **Code cleanup pass (4/24)**, `tsc --noEmit --noUnusedLocals --noUnusedParameters` surfaced dead code. Removed unused imports across 7 files; deleted `constants/Colors.ts` + `components/Themed.tsx`. Held handlers still wired to future work. tsconfig flags NOT added.
- **PaywallModal 5 features (4/24)**, Expanded 4 → 5 bullets, added "Counterfeit & scam alerts on every scan", led first bullet with "Unlimited AI scans, pricing & unlimited vault" (anti-cap differentiator).
- **Red Flag UX + persistence bugs (4/23)**, AI-photo detection as third red-flag condition. Persistence bugs: `sanitizeSnapshot` was stripping `redFlags`; rescan paths in detail.tsx dropped `authFlags`+`redFlags`; rescan profit used template literals instead of `formatMoney()`. `clearResultAndPhoto` now aborts in-flight scans. Accessibility labels: 37 → 169 across 9 files.
- **Pre-launch compliance pass (4/21)**, `terms.html` + `privacy-policy.html` updated for LLC + TN law + Sentry disclosure. `app.json` `minimumOsVersion: "15.1"`. `eas.json` created. PaywallModal: Restore Purchases added (Apple requirement), `/3 mo` formatting, "Popular" badge dropped.
- **Sentry + ESM fix (4/19)**, `metro.config.js` created with `unstable_enablePackageExports: true` to fix Sentry's ESM resolution.
- **Android readiness (4/19)**, `ANDROID.md` created; assessed not ready (missing package, versionCode, PNG adaptive icon, EAS config, Play account, RevenueCat Google Play). iOS-first launch confirmed.
- **Background scan fix (4/17)**, Removed `abortControllerRef.current?.abort()` from AppState background handler (was killing successful scans mid-flight). `pendingRetryRef.current = false` set before `setResult(geminiResult)` in both success paths.
- **Handmade single-pass (4/17)**, Removed auto-rescan-as-handmade (two sequential Gemini calls, ~30s). Single-pass via prompt directive "Your price output is final." Scan time back to ~10s.
- **Photo dedup on rescan (4/12)**, Via `FileSystem.getInfoAsync` size comparison. Sync `soldStr`/`resaleStr` string state at every programmatic write site in `detail.tsx`.

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
