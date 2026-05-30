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

## Post-Launch Ideas

See [POST_LAUNCH.md](docs/POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
