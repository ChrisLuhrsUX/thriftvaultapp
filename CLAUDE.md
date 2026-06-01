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
- **Pre-launch follow-ups:** ~~(1) Export 1024×1024 PNG icon~~ done 5/22 (`thriftvault_logo.png` 1024×1024). ~~(2) Fill `ascAppId` + `appleTeamId` in `eas.json`~~ done 5/22. **v1.0 submitted to App Review 2026-05-30** (build **7**, `96ea8a83`); awaiting Apple (~24–48h). Subscriptions already attached; TestFlight skipped (no beta).
- **Expo 54 longevity**, safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

### Session, 2026-05-31
- **Phase 0 + Phase 1 trigger added to `docs/LAUNCH_OPS.md`**. New Phase 0 section (Submitted, awaiting Apple) inserted between Dashboards and Phase 1, documents the current 5/30-onward state: daily ASC tab check, inbox watch on contact@thriftvaultapp.com + Apple-account email, "don't push native/config changes" rule (a fresh `eas build` + `eas submit` resets the review queue), "do push" rule for landing/docs/TikTok per `feedback_auto_push_website`. Approval branch: ASC → 1.0.0 → "Release This Version" (manual release setting) kicks off Phase 1. Rejection branch: Resolution Center, same-day reply. Phase 1 header also gained a "Trigger:" line making the click-Release-This-Version handoff explicit instead of buried in Phase 0.
- **`docs/DEV_OPS.md` post-submit cleanup** (3 stale spots). (1) `ascAppId` / `appleTeamId` line flipped from "needs to be filled in once Apple Developer Org is live" to confirmed values (`6772308542` / `UG3X275FNX`, set 5/22). (2) Source maps section: items 3-5 ("still pending for production profile") rewritten with date-stamped completion notes capturing the 5/30 incident, first production build `be3db102` failed source-map upload because `SENTRY_AUTH_TOKEN` alone isn't enough; `SENTRY_ORG=chrisluhrsdesign` + `SENTRY_PROJECT=thriftvault` must also be on EAS production profile. Second build `96ea8a83` succeeded after adding them. (3) Release flow step 6 gained the ASC API Key 401 gotcha: if `eas submit` fails 401 ("Unable to validate"), delete the cached key at expo.dev → Credentials → iOS → App Store Connect API Key, rerun, hit Y to let EAS generate a fresh key (manually-pasted keys with Team/Roles "None" silently fail).
- **`docs/POST_LAUNCH.md` Scoped section re-sorted by impact**. Three corrective moves to honor the header's "growth levers and listening tools first, UX polish and tech debt last" principle. (1) **Share-as-image card #17 → #3**, buried in tech-debt cluster despite being tagged "growth"; it's a viral hook where every shared scan = free TikTok/IG content amplifying each existing user, belongs in the growth cluster behind Feedback channel + ASO iteration. (2) **Daily scan cap #8 → #10 → REMOVED**, spec-described entry was already fully shipped (5/27 per `docs/SESSION_HISTORY.md`) in `utils/scanCap.ts` (`DAILY_SCAN_CAP = 100`, AsyncStorage key `tv_scan_count_${YYYY-MM-DD}` matching spec verbatim, `checkScanCap` + `incrementTodayScanCount` + `ScanCapError`), wired at `services/gemini.ts:1783 / 1875 / 1945` for all 3 scan tier callsites and surfaced as `ScanErrorKind = 'cap-reached'`. (3) **Form & error-state polish #12 → #11**, visible UX win (InputAccessoryView Done on decimal-pad + inline retry CTA on transient ScanErrorKinds) deserves position above the refactor cluster. Also flipped one em dash to a comma in the Gemini upgrade entry per `feedback_no_em_dashes`. **Pattern lesson**: check the codebase before recommending implementation in POST_LAUNCH, the daily scan cap entry was listed as a TODO for 4 days after it shipped.
- **3 buckets discussed for during-Apple-wait, all deferred or quick-noted**. (1) Seed traffic (LAUNCH_OPS social backlog FB cross-posts + scan-result screenshots): declined, no marketing pre-seeding being done. (2) OTA-prep 1.0.1 staging (Form & error-state polish on a `1.0.1` branch): deferred to post-launch. (3) Wire alerts (Sentry → Issue Alert on first event + RevenueCat → webhook on INITIAL_PURCHASE): deferred to post-launch, ~15 min each but all dashboard clicking is user-side. Feedback channel implementation (Discord webhook vs Canny ~$15/mo) also surfaced and deferred. Bottom line: no work shipped during review window, just waiting for Apple verdict.
- **TikTok Idea 1 went live, 2-post serialization started**. Post 1 (Idea 1 "Goodwill walk-by test" debut, item/title not logged): 600 views, 22 likes, 2 comments. 3.7% like rate solid for niche, 0.3% comment rate is the weak link (payoff slide didn't drive comments). Per `docs/TIKTOK_STRATEGY.md:280` serialization rule (algo needs 3-5 posts in same format before pushing to right audience), recommended staying in Idea 1 for 3-5 posts before rotating to Idea 8 (mispricing) or Idea 6 (cart). Post 2 shipped same session: Lululemon Define Jacket (coral, $4 thrift, scan called Define $85 with $70-$120 range at ~75% photo-only confidence; rescan called it generic "Full-Zip Athletic Jacket" $60 with $50-$90, princess seaming up the bust is the Define tell). Caption: `$4 lululemon define. someone donated to the wrong pile.` Hashtags: `#lululemon #thriftflip #goodwillfinds #poshmark #reseller`. Recommended Poshmark over Depop despite Depop's bigger TikTok volume because Lulu is a top-3 Poshmark brand and Define resells fast for $80-$120 there; Depop's Lulu audience skews younger and pays less. Depop lane reserved for vintage/Y2K/aesthetic finds.
- **TikTok performance tracking system created**. New `docs/TIKTOK_PERFORMANCE.md` (per-post log: posted-time, Idea #, item, title, hashtags, 1hr/6hr/24hr/7d view velocity, recomputed like/comment rate, Hit/Solid/Flat/Miss verdict band, lesson). Verdict bands calibrated for current follower count: Hit >2k at 24hr OR >5% likes OR >1% comments, Solid 500-2k with >3% likes, Flat 200-500, Miss <200. Both posts pre-logged (Post 1 has unknowns to backfill, Post 2 awaits counts). New `project_tiktok_tracking.md` memory with trigger phrase `log tiktok post` so future sessions auto-route updates to the log without prompting. Added to MEMORY.md index. Running notes captured: same-format serialization is the discipline, brand-in-caption and hook framing are separate levers to test in isolation, hashtag swaps should keep 4 constant and rotate 1 to isolate effect.
- **Scan-cap rescan-bypass audit, confirmed safe**. User asked if 100/day cap can be gamed by rescanning the same item. Verified at `utils/scanCap.ts` + `services/gemini.ts:1787 / 1885 / 1949`: all 3 callsites (`scanWithGemini`, `refreshUpcycleIdeas`, `rescanAsHandmade`) call `incrementTodayScanCount` after each successful API call. No per-item dedup, no rescan exemption. Cap correctly counts API calls (cost basis) not unique items. Cannot be bypassed.

### Session, 2026-05-30
- **Production EAS build + App Store submit shipped** (`docs/LAUNCH_BLOCKERS.md`). First production build (`be3db102`) failed: Sentry source-map upload missing `SENTRY_ORG` / `SENTRY_PROJECT` in EAS production env. Added both; second build `96ea8a83` succeeded (buildNumber **7**, v1.0.0). `eas submit --platform ios` submission `30ec6d89` uploaded IPA to ASC.
- **ASC API key incident + fix**. Manual upload of RevenueCat's key `5R4H56CK65` stored on EAS with Team/Roles **None** → two 401 submits (`8dff93fc`, `bacedb2c`). Fix: delete key on expo.dev → Credentials → iOS → App Store Connect API Key; rerun submit with **Y** → EAS generated `T64TPFN72R` (`[Expo] EAS Submit HMJurcy62d`, App Manager). RC key left intact in ASC. **Pattern lesson**: EAS caches submit keys server-side; **Y** won't replace until you delete the stored row; "Unable to validate" + Team/Roles None = don't proceed.
- **Upload ≠ TestFlight beta**. Binary appears under TestFlight tab while Apple processes; no testers/groups added. Attach build on **Distribution → 1.0.0 → Build**, not TestFlight.
- **ASC final gates before review**. Add for Review blocked until **App Information** had primary category (**Shopping**) + Content Rights (**No** third-party content). Build **7** attached; 3 subs already on version. **Submitted for Review** same day.
- **Landing page polish** (`index.html`, pushed earlier session). Mobile `.screen-pair` grid fix; dropped inner `.screen-frame` wrappers; unified scroll-reveal hover; hero lead → Depop/Poshmark/eBay/Etsy (Vinted removed, not in `gemini.ts` comps); profile screenshot caption tightened.
- **EAS production env vars confirmed** (2026-05-30). All 4 `EXPO_PUBLIC_*` keys + `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` in production scope. **`docs/LAUNCH_BLOCKERS.md` fully checked** — launch punch list complete pending Apple review outcome.
- **Pre-submit App Review + HIG compliance audit** (4 parallel agents). Ran Privacy/Permissions, IAP 3.1.2(a), Edge cases/2.1, and Metadata/IP/AI content audits in parallel. No blockers found. 3 yellow fixes applied: (1) `app.json` privacy manifest gained `NSPrivacyAccessedAPICategoryFileTimestamp` (`C617.1`) + `NSPrivacyAccessedAPICategorySystemBootTime` (`35F9.1`) entries, preempts Apple's May 2024 manifest enforcement around Sentry SDK API touches. (2) `android.permission.RECORD_AUDIO` removed from `android.permissions`, `recordAudioAndroid: false` added to expo-camera plugin config (audio is auto-pulled for video, but app only takes stills; Android-only cleanup, not iOS-blocking). (3) Small "AI estimate" caption (10px, mauve, `theme.typography.label`) added above scan result price in `scan.tsx:376` to satisfy 4.3.1 AI-generated content disclosure at point of display (existing onboarding + Profile "About AI estimates" surfaces alone don't satisfy post-Nov 2024 enforcement). **Pattern lesson**: multi-agent parallel auditing is the highest-confidence pre-submit check, but agents systematically OVERSTATE 🔴 blockers. Every claimed blocker needs Read/Grep verification before passing to the user. The audit-agent's "paywall blocks all core features" turned out to be only-scan-paywalled (vault/manual-add/hauls/profile all free), the "InventoryContext hydration gap" was actually the correct pattern (`InventoryContext.tsx:278` returns null until hydrated, blocking child mounts), and the "AsyncStorage no try/catch on index.tsx" is a theoretical edge case reviewers won't hit. Trust 🟡 risks more than 🔴 blockers; yellows tend to be real but small.
- **Pre-submit UX/HIG fixes** (`app.json`, `app/_layout.tsx`, `components/PaywallModal.tsx`, `app/(tabs)/scan.tsx`). (1) `userInterfaceStyle: "automatic"` flipped to `"light"`, locks app to light mode because dark mode renders poorly. (2) `<ExpoStatusBar style="dark" />` from `expo-status-bar` added to `_layout.tsx` so iOS renders dark status-bar icons on the cream background. Existing `components/StatusBar.tsx` only paints a cream fill behind the system bar, doesn't set icon color, so default iOS behavior could render light icons on light bg in some configurations. (3) Camera permission string `"Photos are sent to Google's AI for identification."` swapped to generic `"Photos are sent to our AI service to identify and price items."` per `feedback_no_ai_provider_names` (Anthropic fallback also exists; provider names belong in legal docs only, not iOS Info.plist usage descriptions). (4) PaywallModal gained explicit "Not now" text button below the "Start Free Trial" CTA. Drag-handle + backdrop-tap dismiss still work, but a visible secondary CTA lowers Apple reviewer rejection risk around paywall predatory-pattern flags.
- **ASC submission metadata**. Notes for Reviewer entered: "AI scan requires subscription (30-day free trial available via Start Free Trial). All other features (manual inventory, hauls, edit, stats) work without subscribing. To test paywall: tap any photo button in Scan tab." Pre-empts reviewers trying to evaluate freemium structure. Release option set to **Manual**, lets launch coordinate with a TikTok post instead of the app dropping the moment Apple approves.
- **POST_LAUNCH.md additions** (`docs/POST_LAUNCH.md`). 2 new tech-debt/polish items sorted by importance: (1) **Typography helper hygiene**, remove ~95 inline `fontFamily: 'DMSans_600SemiBold'` / `fontWeight: '600'` overrides across 13 files (concentrated in `scan.tsx`/`detail.tsx`/`index.tsx`/`haul-detail.tsx`). Pattern `...theme.typography.caption, fontFamily: 'DMSans_600SemiBold'` violates `feedback_no_font_weight_overrides` AND breaks Dynamic Type's scaling chain because the override prevents the helper's responsive sizing. Fix: add semibold variants to `theme/typography.ts` (`captionBold`, `bodyBold`, `bodySmallBold`, `labelBold`), then replace overrides with the new variants. ~half-day refactor; prerequisite for Dynamic Type rollout. (2) **Form & error-state UX polish**, `decimal-pad` in `app/detail.tsx` price fields has no Return key (add `InputAccessoryView` "Done" toolbar on iOS); `scan.tsx` inline error card renders classified messages but no inline retry CTA on transient `network`/`busy` `ScanErrorKind` (add "Try again" Pressable in the card for those kinds only).

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

## Post-Launch Ideas

See [POST_LAUNCH.md](docs/POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
