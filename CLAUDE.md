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

### Session, 2026-05-26
- **3 ASC subscription products created + RC↔ASC connection wired**. Subscription Group `ThriftVault Pro` (id `22114945`) with 3 auto-renewable subs: `monthly` ($4.99/1mo with 30-day Free Introductory Offer / All countries / New Subscribers / no-end-date toggle hidden below ASC's calendar picker), `three_month` ($9.99/3mo, no trial — Apple limits one intro offer per subscription group), `annual` ($29.99/1yr Upfront). Shared 1170×2532 paywall review screenshot across all 3. RC wired via Apps & providers → New App Store app: In-App Purchase Subscription Key (`SubscriptionKey_*.p8` from ASC → Users and Access → Integrations → In-App Purchase, for StoreKit 2 receipts), App Store Connect API Key (`AuthKey_*.p8` same area, App Manager role, for product auto-pull), App-Specific Shared Secret (Legacy fallback), Bundle ID `com.thriftvault.app`, Issuer ID `2ad35d93-d70b-42f4-ac24-16c6d35ba1b3`, Apple Server-to-Server Notification URL paste into ASC App Info still pending end-of-session, Small Business Program start date left blank (awaiting Apple acceptance after 5/22 enrollment). **Pattern lesson 1: Apple permanently burns deleted Product IDs** — user deleted Annual mid-creation to "start over" and lost `yearly` forever; recreated as ASC product ID `annual`, creating an asymmetry with the RC `yearly` package identifier (RC locks package IDs in its onboarding wizard). Memory saved: `project_rc_asc_product_id_mapping`. **Pattern lesson 2: ASC Subscription Group needs its OWN localization** separate from per-subscription localization (custom display name `ThriftVault` without the tagline) — missing group localization is what kept "Missing Metadata" yellow despite all per-product fields filled. **Pattern lesson 3: "Missing Metadata" badge persists until first binary upload regardless of metadata completeness** — Apple's notice at top of subscription page confirms intentional; don't debug, proceed.
- **`react-native-purchases` installed + config plugin error and fix** (`app.json`, `hooks/usePurchases.ts:1-13`). `npx expo install react-native-purchases` ran clean; added `"react-native-purchases"` to `app.json` plugins array per stale `usePurchases.ts` header comment, got `PluginError: Unable to resolve a valid config plugin for react-native-purchases. No "app.plugin.js" file found...`. Modern RC SDK auto-links via Expo's native module discovery; no `app.json` plugin entry needed. Removed entry, updated header comment with corrected setup steps. **Pattern lesson: setup comments for native package integration rot fast as SDK and Expo plugin systems evolve. RC's `app.plugin.js` requirement was real ~v5 then went away ~v7. Treat `app.json` plugins array as opt-in (only add if package ships `app.plugin.js`), not opt-out copied from old docs.**
- **`constants/monetization.ts` IDs renamed to match RC's locked package identifiers** (`constants/monetization.ts:26,33`). RC's onboarding wizard pre-fills `monthly` / `three_month` / `yearly` and BLOCKS rename. Changed `id: 'season'` → `'three_month'`, `id: 'annual'` → `'yearly'` to match the locked RC identifiers; display labels ("Season Pass" / "Annual") unchanged because only `plan.id` is the runtime lookup key in `usePurchases.ts:109` `availablePackages.find(p => p.identifier === packageId)`. **Pattern lesson: when a third-party tool locks identifiers in its onboarding flow, rename YOUR code to match — even if their naming is worse. Fighting RC's wizard via Products-tab workarounds is more fragile than renaming 2 strings.**
- **`.env` gained `EXPO_PUBLIC_REVENUECAT_API_KEY=test_...`**. Memory saved: `project_rc_test_key_swap` — current test key works in RC sandbox; must swap to production `appl_` key before `eas build --profile production --platform ios`, otherwise live App Store purchases silently fail (RC sandbox isolated from production transactions). Sandbox tester created at `chrisluhrsdesign+sandbox@gmail.com` — Gmail `+sandbox` alias trick works because Apple treats the +alias as distinct identity (base `chrisluhrsdesign@gmail.com` was burned as Chris's own Apple ID).
- **LAUNCH_BLOCKERS intra-day restructure: Async section added then commission cut** (`LAUNCH_BLOCKERS.md`). Morning: added "Async / parallel (kick off now)" section between Pre-prebuild and "After Paid Apps" with human-illustrator icon commission + sandbox tester creation, anchored on AI-icon brand-contradiction risk (app flags AI photos as red flags). Evening: AI-icon prompt attempts didn't produce usable results, Apple confirmed no AI-icon ban, budget cut killed the commission. Removed both the Async commission item and the Submit "Integrate the human-made icon" step; v2 PNG icon ships as-is. **Pattern lesson: budget-driven scope cuts often happen mid-day once the work's real cost surfaces. Keep planning docs fluid; sections added in the morning can become dead weight by end of day.**
- **POST_LAUNCH additions + cost-per-scan math** (`POST_LAUNCH.md`). New Scoped item between Affiliate links and Platform filter: **Daily scan cap (abuse protection)** — `tv_scan_count_${YYYY-MM-DD}` AsyncStorage key, ~100/day ceiling, ~30 LOC + sheet, bounds worst-case AI cost from rogue user (~$0.09/day cap on Gemini 2.5 Flash). New item at end of Scoped (after `services/gemini.ts` split): **Gemini model upgrade path** — when Google deprecates 2.5 Flash, migrate to **3.1 Flash-Lite** ($0.25/$1.50 per 1M, ~3× current cost but 45% faster generation + 2.5× faster TTFT, GA 2026-05-08), NOT **3.5 Flash** ($1.50/$9.00 per 1M, ~15× current cost, would push heavy users past their plan's net-of-Apple revenue at the current ~10K-token prompt). Re-run cost math AFTER gemini.ts split so prompt-diet measurements are clean. Cost-per-scan math memorialized: 5-photo scan ~$0.0009 on 2.5 Flash, ~$0.035 on Claude Sonnet fallback (~40× Gemini, fires only on double-failure); per-user monthly $0.03 (casual) / $0.08 (typical) / $0.27 (heavy) / $0.68 (power); margin healthy across all 3 tiers at heavy use (Annual $1.85/mo net of Apple-15% + AI). **Photo count is NOT the cost driver** — 5→3 photos saves ~5-7% per scan because the system prompt (~6-8K tokens) dominates over per-image (~258 × 5 = ~1.3K). Real cost levers: prompt-shrink + image-detail resolution. **Pattern lesson: model-migration plans must encode the COST cliff, not just speed/quality benchmarks. A 15× input-cost upgrade silently murders unit economics months after migration.**
- **JPG→PNG asset sweep, 5 references** (`components/WebSidebar.tsx:84`, `index.html:8/9/857`, `app/(tabs)/scan.tsx:227`). `app.json`'s 4 icon paths were already PNG; JPG was load-bearing on web landing favicon + apple-touch-icon + hero image + scan-screen `SCAN_BG_SOURCE` watermark. Now `thriftvault_logo.png` is the single canonical asset; `thriftvault_logo.jpg` + `thriftvault_logo_v2_square.jpg` deletable (zero remaining refs).
- **Business email mailbox-recreate recovery** (`contact@thriftvaultapp.com`, Namecheap Private Email). User locked out of privateemail.com webmail after losing 2FA authenticator (no backup codes saved at enrollment). Namecheap account itself accessible (separate 2FA still working). Manage-dropdown exposes `Manage Aliases / Edit Storage / Change Password / Turn Off / Remove` but no 2FA-reset action; password reset doesn't clear 2FA. "Lost 2FA device?" link returned "no backup devices available." Trial-tier mailbox 5 days old with zero archived mail, so: `Remove` → `Buy Mailbox` → recreate from scratch in 2 min. Forwarding to `thriftvaultapp@gmail.com` via Gmail Accounts and Import → "Check mail from other accounts" (POP3 pull from `mail.privateemail.com:995 SSL`) since Namecheap Private Email's trial plan doesn't expose Auto-Forward or Redirect-to filter actions. RC account registered with `contact@thriftvaultapp.com`. **Pattern lesson 1: for trial-tier business email with no historical mail to lose, mailbox-recreate beats Namecheap support 2FA-reset ticket (faster, no identity verification). Pattern lesson 2: save 2FA backup codes at enrollment OR use a password manager that stores TOTP next to credentials.**
- **Accessibility pass for App Review readiness, P0 + P1 + HIG, uncommitted pending VoiceOver smoke** (11 files modified + new `hooks/useReducedMotion.ts`: `components/{Toast,PaywallModal,BottomSheetModal,CustomTabBar,AppIcon}.tsx`, `context/ToastContext.tsx`, `app/{(tabs)/index,(tabs)/scan,(tabs)/profile,detail,haul-detail}.tsx`). Audit subagent produced a ~20-item punch list; landed full pass in one session. Key fixes: (1) Toast announces via `AccessibilityInfo.announceForAccessibility` from `ToastContext.showToast` because the Toast view is `pointerEvents="none"` and unreachable by VoiceOver. (2) Scan error card + scan snapshot switch both call `AccessibilityInfo.announceForAccessibility` on iOS (`accessibilityLiveRegion="polite"` only fires on Android). (3) `AppIcon` defaults to `accessibilityElementsHidden + importantForAccessibility="no-hide-descendants"` when no label is passed; opt-in to focus by passing `accessibilityLabel`. (4) New `useReducedMotion` hook subscribes to `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` event; `PaywallModal` and `BottomSheetModal` snap open/closed instantly when on. (5) `CustomTabBar` swapped from `accessibilityRole="button"` to `"tab"` + `accessibilityState.selected`; container is `"tablist"`. (6) Modal focus trap via `accessibilityViewIsModal` on Animated.View sheets (Paywall, BottomSheet, detail history sheet, detail fullscreen image). (7) Profile stat rows + store rows wrap in `accessible + accessibilityLabel="<composite>"` so VoiceOver reads "Total Profit, $50" as one swipe instead of icon + label + value as three. (8) Vault ItemCard + HaulCard get composite labels ("Levi 501 denim, $45 target, listed, red flag"); inner `<Image>` marked `accessible={false}`. (9) 8 TextInputs labeled (item name, cost, resale/sold dynamic, custom platform, notes, FieldRow generic, bulk store, haul title). (10) `accessibilityRole="header"` on every screen title + section header for VoiceOver rotor nav (Profile, My Vault, Scan, Saved for later, Recent finds, Your Stats, Settings, Profit by store, Insights, Scan history). (11) PaywallModal closeBtn bumped to 44pt min + `hitSlop={12}`. **Pattern lesson 1: when a view is intentionally non-blocking (`pointerEvents="none"`), the screen-reader announcement has to come from somewhere outside the view; the context that triggers the message is the right home, not the view itself.** **Pattern lesson 2: `accessibilityLiveRegion` is Android-only. Every iOS announcement requires a paired `AccessibilityInfo.announceForAccessibility` call.** **Pattern lesson 3: when a data row renders as `<View>{icon}{label}{value}</View>` with the parent not `accessible`, VoiceOver visits each child separately. Wrap the parent in `accessible + accessibilityLabel="<composite>"` so it reads as one unit.** **Pattern lesson 4: audit subagents skew toward false positives. This audit claimed mauve on cream fails AA (actually 5.32:1, AA passes for all text sizes), landing page lacks `aria-hidden` on dividers (all already have it), and several Pressables lack labels (actually labeled). Verify line numbers and computed contrast before applying recommendations.**
- **POST_LAUNCH cleanup** (`POST_LAUNCH.md`). Removed shipped items: **Landing page** (deployed at thriftvaultapp.com, iterated 5/24 + 5/25); **Switch to `expo-image`** (all 4 image surfaces migrated, `(tabs)/index.tsx` + `(tabs)/scan.tsx` + `detail.tsx` + `haul-detail.tsx` all `import { Image } from 'expo-image'`). Added: **Dynamic Type support** as the one HIG accessibility gap remaining for v1, per-style ceiling decision in `theme/typography.ts` + manual layout pass at Settings → Accessibility → Display & Text Size → Larger Text → max. Polish, not blocking for App Review. File-split items verified still valid TODOs: `detail.tsx` 2,944 lines (grew from 1,700), `scan.tsx` 3,463 lines (grew from 1,600), `services/gemini.ts` 1,762 lines (unchanged).

### Session, 2026-05-25
- **`SESSION_HISTORY.md` extracted from CLAUDE.md**. User created sibling file `SESSION_HISTORY.md` and pulled out the 5/21 session + entire "Compressed Sessions, older than 3 days" block (~130 lines). I compressed the verbose 5/21 section into 9 single-line entries (dropped 3 minor UI bullets: history-row Before/After pill, multi-photo library haptic, Kit waitlist HTML-comment) at the top of the compressed block. CLAUDE.md char count dropped from ~80k to ~34k. **Pattern lesson: CLAUDE.md compression workflow moved from in-place ("Compressed Sessions" block within CLAUDE.md) to sibling `SESSION_HISTORY.md`. Recent 3 dated sessions stay at full detail in CLAUDE.md; everything older lives in `SESSION_HISTORY.md`. Updated `feedback_claude_md_compression.md` memory to reflect the new sibling-file workflow.**
- **Main branch ruleset protection via GitHub API** (ruleset id `16837336`). Branch ruleset on `~DEFAULT_BRANCH` blocks `non_fast_forward` (force-push) + `deletion`. Initial setup had `actor_id: 5` (Admin role) bypass; user then removed it so `bypass_actors: []` and `current_user_can_bypass: "never"`. Server-side defense against rogue AI tools acting under your credentials (the 4/29 Cursor/Opus 4.6 prod-wipe incident is the exact scenario; `.claude/settings.json` hard-denies don't protect against tools that don't honor them). Override path when intentional rewrite needed: Settings → Rules → "main protection" → Disable. **Pattern lesson: ruleset `PUT` replaces the full payload, not patches; to update one field (`bypass_actors`), send the entire ruleset definition again. `gh api -X PUT --input file.json`.**
- **`gh` CLI installed (winget broken, portable ZIP workaround)**. `winget install --id GitHub.cli` consistently failed with "Failed when opening source(s)" even after `winget source reset --force` from admin PowerShell. Fallback: `Invoke-WebRequest` to download `gh_2.92.0_windows_amd64.zip` (14.4 MB) from GitHub releases, `Expand-Archive` to `C:\Users\Chris\AppData\Local\Programs\gh\`, appended `bin\` to user PATH via `[Environment]::SetEnvironmentVariable('PATH', current + ';' + bin, 'User')`. Auth as `ChrisLuhrsUX` via `gh auth login` web-browser device flow. Memory saved at `reference_gh_cli.md`. **Pattern lesson: Git Bash on Windows rewrites leading slashes in `gh api` endpoint paths into Windows filesystem paths (`/repos/...` → `C:/Program Files/Git/repos/...`); always omit the leading slash. JSON payloads pass via `--input file.json`; `-f arrayfield='[]'` sends a string `"[]"` not an empty array.**
- **Drift-watch PR #2 squash-merged** (`pricing-drift-reports/2026-05-25.md` via `e64ef82`). 7 of 14 tiers flagged this week; eBay direct fetch was 403'd during the agent run so the report leans on Depop/Poshmark/resale-guide signal only (eBay 2× weight from `feedback_secondhand_market_anchor.md` not applied). Branch `drift-watch/2026-05-25` deleted. PR #1 (5/18) still open with the actually-critical item: Tiffany Studios authenticated lamp band `$500–$5,000+` is off by 8-20× (real floor `$4,000–$10,000`). Coach canvas band needs split into pre-2000 leather ($80–$160) vs 2003+ C-canvas ($25–$45). Patagonia Nano Puff floor + generic lamp ceiling parked for manual eBay sold-comp browser verification (WebFetch + WebSearch both blocked by eBay). **Pattern lesson: when eBay direct returns 403 during drift-watch, the verdict skews toward Depop's lower comp cluster because the 2× weighting isn't applied. Don't auto-apply recommendations from a 403-impaired run without manual eBay sold-listing re-check.**
- **Landing hero reword** (`index.html`, commit `c5c107a`, pushed `4796328`). "a worth-it or skip-it nudge" → "a heads-up on scams and counterfeits". Original middle-beat implied a binary buy/skip verdict feature that doesn't exist; new copy maps to the 3-way red flag classifier (verification/knockoff/ai-listing) shipped 5/21 and parallels PaywallModal "Counterfeit & scam alerts on every scan" feature copy. **Pattern lesson: every hero claim should map to a shipped feature. If the prose contradicts the product, find a real feature for the rhythm slot or drop the beat entirely.**
- **`LAUNCH_BLOCKERS.md` restructure** (`LAUNCH_BLOCKERS.md`). AI-logo swap moved from top of Pre-prebuild (#1) to first item in Submit section (doesn't gate critical-path code work; only blocks the final production build). Pre-prebuild block now fully checked. Screenshots step #7 expanded from 1-line to a full Figma compose recipe: 6.9" iPhone 1320×2868 px required (ASC auto-scales to fill smaller sizes), 3–5 minimum, suggested order (scan-result hero / vault grid / paywall / red-flag banner / profile stats), Windows capture path (iPhone 13 native 1170×2532 upscale ~1.13× in Figma is reviewer-acceptable), brand `cream`/`vintageBlue` bg + Figma Community iPhone 16 Pro mockup + Playfair Display headline + DM Sans subhead, match landing-page hangtag motif. **Pattern lesson: Apple Screenshots requirement consolidated on 6.9" (1320×2868) as of 2026; ASC auto-scales to fill 6.5"/6.7", so one set suffices for the screen-size matrix.**

## Post-Launch Ideas

See [POST_LAUNCH.md](docs/POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
