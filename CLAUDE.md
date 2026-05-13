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
- **Red Flag system**, `redFlags?: string[]` field; sentinel `"stock-photo"` triggers banner without bullet (UI filters). `blush` banner with `flag` icon; red badge on vault grid; Yes/No "Look fake to you?" prompt suppressed when flags present. Persists per-item via `tv_prompt_dismissed_${id}`.
- **Duplicate detection**, Weighted multi-signal score (brand×3, color×2, material×1.5, multicolor/generic×1; +0.15 brand, +0.10 color match, -0.30 color conflict). Threshold 0.55. Sparse-token rescue floor 0.6. `!brandMatch && matchedTokens.size < 3` clamps to 0.40 (tightened 5/08 from `< 2`; 2-token color+material overlaps were sailing through). Image-size fallback against `scanSnapshots[0].sourceImageUri` auto-promotes to 0.99.
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

### Session, 2026-05-12
- **DIY-distressed denim clamp** (`services/gemini.ts`), Real-world test: heavily-shredded factory jeans returning ~$85 ceiling vs Depop reality $25–$40. Root cause: DENIM EXCEPTION lumped "crops/distress/basic patches/dye" into one $25–$55 simple band, and dense rips were drifting up into "moderate rework" ($45–$85). Fix: split simple into SUBTRACTIVE ($20–$40, rips/holes/shredding/sanding/distressing, even when dense or all-over) vs ADDITIVE ($25–$55, basic patches, dye, painted graphic). Ported to PROMPT + `HANDMADE_SUFFIX`. NEW code clamp `isDIYDistressedDenim` (subtractive regex AND `!isAdditiveDenimText` AND `!isExceptionalDenim`) caps $45 / floor $20. Pattern lesson: density of subtractive labor is NOT a craftsmanship signal, bands need to separate additive (skill) from subtractive (hours).
- **Pricing-tier drift watch routine**, Weekly remote agent (Mon 9am ET, `trig_0113xK23HSeSpB46ySDYJtBF`) spot-checks 12 representative tiers against Depop/eBay/Poshmark sold comps and opens a PR with `pricing-drift-reports/YYYY-MM-DD.md`. Does NOT modify `services/gemini.ts`, user reviews and applies. Bridges quarterly full refresh (next 2026-07-30).

### Session, 2026-05-11
- **Domain `thriftvaultapp.com` live on GH Pages**, registered via Namecheap (Domain Privacy OFF so WHOIS shows ThriftVault LLC for Apple's org-website check). DNS: 4× A records to GH Pages IPs `185.199.108–111.153` + CNAME `www → chrisluhrsux.github.io`. New `CNAME` file at repo root pins the custom domain through Pages config regeneration. Settings → Pages → Custom domain set; Enforce HTTPS ticked when checkbox unlocked. Legal docs auto-rehosted at `thriftvaultapp.com/assets/terms.html` + `/privacy-policy.html` (previously `chrisluhrsux.github.io/thriftvaultapp/...`). Next: reply to Apple org-conversion ticket with the live domain.
- **Landing page polish pass** (`index.html`), Six fixes on the live editorial vintage page: (1) **mobile hero stack**, `order: 1/2` puts headline above logo, frame shrunk 320 → 260 → 220px across breakpoints, centered; (2) **removed brass double-frame on hero logo entirely**, the CSS frame (`background`, inner `::before` border, `aspect-ratio: 1/1` + `object-fit`) was fighting the JPG's own internal framing, producing both letterbox bars (`contain`) and overflow (`cover`). Now just soft drop shadow + rounded corners on the raw image. **Pattern lesson: don't add CSS framing around an image that already has its own internal framing, they fight no matter which `object-fit` you pick**; (3) **pre-launch signaling at three depths**, top charcoal/brass `.prelaunch-bar` announcement, `.status-badge` capsule in hero (replaces the small dash-line meta), italic `.plans-note` below Plans header. "iOS 15.1+ · Coming soon" alone wasn't unambiguous enough; (4) **stripped editorial "No. 01/02/03/04, X" eyebrows and "No. I/II/III" pricing tags**, user feedback: pretentious affectation, not refinement; (5) **footer Terms/Privacy restyled** to inherit the imprint's small-caps mauve typography + brass underline-on-hover (was inheriting loud teal underlined global link style, clashed with muted imprint sitting next to it); (6) **dropped `.featured` charcoal-card treatment from Season Pass**, visual weight made middle card read as headliner when Annual ($2.50/mo effective) is actually the best value. **Pattern lesson: featured pricing-card emphasis should match best-value plan or be dropped entirely; middle-card weight creates unintentional decoy hierarchy.** `.featured` CSS retained in stylesheet, harmless.

### Session, 2026-05-09
- **Apple Developer org-conversion, website blocker** (`project_apple_dev.md`), Apple replied to the Individual → Org request requiring "valid organization website... domain must be associated with your organization." GH Pages subdomain doesn't satisfy. `thriftvault.com` + `thriftvault.app` taken; picked **`thriftvaultapp.com`** over `thriftvault.co`, .com signal beats .co brand cleanliness because typo traffic to a squatted `thriftvault.com` would be permanent brand bleed. WHOIS registrant must visibly tie to ThriftVault LLC (no privacy proxy until Apple approves).
- **Landing page `index.html` at repo root**, drafted to satisfy Apple's org-website requirement. First pass was generic-centered-text matching legal-doc style; user pushed back ("not this generic slop"). Rebuilt via frontend-design skill into editorial vintage / curio-shop aesthetic: v1 logo (`thriftvault_logo.jpg`, wordmark with hanger + price tag) museum-framed in cream matte with brass border, asymmetric 5/7 hero grid, numbered "No. 01–04" sections, brass `✦ ✦ ✦` ornamental dividers, luggage-tag pricing cards (dashed terra borders, dark featured center card), subtle paper-grain SVG noise. Brand fonts (Playfair Display + DM Sans) + custom brass `#B5934F` accent. Top-center smooth-scroll nav (Features/Plans/About/Contact) with brass underline animation; stacks vertically below 640px. **Pattern lesson: `thriftvault_logo.jpg` (v1) is the wordmark for marketing surfaces; `thriftvault_logo_v2.png` (v2) is the iOS app icon (camera-in-frame, no wordmark)**, don't confuse on web. Iterative trims after first build: dropped topbar Est line + Imprint sidecar (duplicated About + footer) + hero brass-tack ::after + About drop cap; shrunk contact link `clamp(36, 5.4vw, 60)` → `clamp(26, 3.6vw, 42)`; rounded edges throughout (hero frame 16/8/6px, pricing cards 14px, trial strip 12px). Legal docs unchanged at `assets/terms.html` / `assets/privacy-policy.html`.
- **CLAUDE.md 05-05 + 05-04 sessions compressed** into "older than 4 days" list per the rolling 4-day window rule.

### Compressed Sessions, older than 4 days
*Major decisions are consolidated above.*

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
