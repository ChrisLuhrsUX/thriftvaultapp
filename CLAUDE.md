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

- **Apple Developer**, Organization enrollment active ($99/yr; officially migrated from Individual to Organization 5/21). D-U-N-S, team ID, account email tracked outside repo.
- **ThriftVault LLC**, Formed in TN, EIN issued. Annual overhead: ~$400/yr TN ($300 annual report + $100 min franchise) + 6.5% excise on net earnings. Legal docs tracked outside repo.
- **Pre-launch follow-ups:** (1) Export 1024×1024 PNG icon (current `thriftvault_logo_v2.png` is 834×836 with alpha + circular frame, fails App Store specs); update `app.json` icon/splash/Android adaptive/web favicon (4 paths). (2) Fill `ascAppId` + `appleTeamId` in `eas.json` with the new Org team ID.
- **Expo 54 longevity**, safe through mid-to-late 2026; upgrade pressure begins when Expo 56/57 drops 54 from EAS.

### Session, 2026-05-25
- **`SESSION_HISTORY.md` extracted from CLAUDE.md**. User created sibling file `SESSION_HISTORY.md` and pulled out the 5/21 session + entire "Compressed Sessions, older than 3 days" block (~130 lines). I compressed the verbose 5/21 section into 9 single-line entries (dropped 3 minor UI bullets: history-row Before/After pill, multi-photo library haptic, Kit waitlist HTML-comment) at the top of the compressed block. CLAUDE.md char count dropped from ~80k to ~34k. **Pattern lesson: CLAUDE.md compression workflow moved from in-place ("Compressed Sessions" block within CLAUDE.md) to sibling `SESSION_HISTORY.md`. Recent 3 dated sessions stay at full detail in CLAUDE.md; everything older lives in `SESSION_HISTORY.md`. Updated `feedback_claude_md_compression.md` memory to reflect the new sibling-file workflow.**
- **Main branch ruleset protection via GitHub API** (ruleset id `16837336`). Branch ruleset on `~DEFAULT_BRANCH` blocks `non_fast_forward` (force-push) + `deletion`. Initial setup had `actor_id: 5` (Admin role) bypass; user then removed it so `bypass_actors: []` and `current_user_can_bypass: "never"`. Server-side defense against rogue AI tools acting under your credentials (the 4/29 Cursor/Opus 4.6 prod-wipe incident is the exact scenario; `.claude/settings.json` hard-denies don't protect against tools that don't honor them). Override path when intentional rewrite needed: Settings → Rules → "main protection" → Disable. **Pattern lesson: ruleset `PUT` replaces the full payload, not patches; to update one field (`bypass_actors`), send the entire ruleset definition again. `gh api -X PUT --input file.json`.**
- **`gh` CLI installed (winget broken, portable ZIP workaround)**. `winget install --id GitHub.cli` consistently failed with "Failed when opening source(s)" even after `winget source reset --force` from admin PowerShell. Fallback: `Invoke-WebRequest` to download `gh_2.92.0_windows_amd64.zip` (14.4 MB) from GitHub releases, `Expand-Archive` to `C:\Users\Chris\AppData\Local\Programs\gh\`, appended `bin\` to user PATH via `[Environment]::SetEnvironmentVariable('PATH', current + ';' + bin, 'User')`. Auth as `ChrisLuhrsUX` via `gh auth login` web-browser device flow. Memory saved at `reference_gh_cli.md`. **Pattern lesson: Git Bash on Windows rewrites leading slashes in `gh api` endpoint paths into Windows filesystem paths (`/repos/...` → `C:/Program Files/Git/repos/...`); always omit the leading slash. JSON payloads pass via `--input file.json`; `-f arrayfield='[]'` sends a string `"[]"` not an empty array.**
- **Drift-watch PR #2 squash-merged** (`pricing-drift-reports/2026-05-25.md` via `e64ef82`). 7 of 14 tiers flagged this week; eBay direct fetch was 403'd during the agent run so the report leans on Depop/Poshmark/resale-guide signal only (eBay 2× weight from `feedback_secondhand_market_anchor.md` not applied). Branch `drift-watch/2026-05-25` deleted. PR #1 (5/18) still open with the actually-critical item: Tiffany Studios authenticated lamp band `$500–$5,000+` is off by 8-20× (real floor `$4,000–$10,000`). Coach canvas band needs split into pre-2000 leather ($80–$160) vs 2003+ C-canvas ($25–$45). Patagonia Nano Puff floor + generic lamp ceiling parked for manual eBay sold-comp browser verification (WebFetch + WebSearch both blocked by eBay). **Pattern lesson: when eBay direct returns 403 during drift-watch, the verdict skews toward Depop's lower comp cluster because the 2× weighting isn't applied. Don't auto-apply recommendations from a 403-impaired run without manual eBay sold-listing re-check.**
- **Landing hero reword** (`index.html`, commit `c5c107a`, pushed `4796328`). "a worth-it or skip-it nudge" → "a heads-up on scams and counterfeits". Original middle-beat implied a binary buy/skip verdict feature that doesn't exist; new copy maps to the 3-way red flag classifier (verification/knockoff/ai-listing) shipped 5/21 and parallels PaywallModal "Counterfeit & scam alerts on every scan" feature copy. **Pattern lesson: every hero claim should map to a shipped feature. If the prose contradicts the product, find a real feature for the rhythm slot or drop the beat entirely.**
- **`LAUNCH_BLOCKERS.md` restructure** (`LAUNCH_BLOCKERS.md`). AI-logo swap moved from top of Pre-prebuild (#1) to first item in Submit section (doesn't gate critical-path code work; only blocks the final production build). Pre-prebuild block now fully checked. Screenshots step #7 expanded from 1-line to a full Figma compose recipe: 6.9" iPhone 1320×2868 px required (ASC auto-scales to fill smaller sizes), 3–5 minimum, suggested order (scan-result hero / vault grid / paywall / red-flag banner / profile stats), Windows capture path (iPhone 13 native 1170×2532 upscale ~1.13× in Figma is reviewer-acceptable), brand `cream`/`vintageBlue` bg + Figma Community iPhone 16 Pro mockup + Playfair Display headline + DM Sans subhead, match landing-page hangtag motif. **Pattern lesson: Apple Screenshots requirement consolidated on 6.9" (1320×2868) as of 2026; ASC auto-scales to fill 6.5"/6.7", so one set suffices for the screen-size matrix.**

### Session, 2026-05-24
- **Kaftan/abaya HANDMADE_LARGE_DRESS clamp + tier guidance** (`services/gemini.ts`, committed `4ddcec1`). New `HANDMADE_LARGE_DRESS_RX` (kaftans?/caftans?/abayas?/butterfly abaya/batwing/dolman maxi-or-gown/maxi dress/floor-length variants) + `isHandmadeLargeDress` clamp inserted before `isAlteredDress` and mutex'd with it. Floor $55, cap tier-aware: $140 default, $160 with premium fabric, $200 only when complex-construction tells match. Prompt-side: HANDMADE DRESS EXCEPTION re-tiered by SILHOUETTE + FABRIC YARDAGE (not just construction complexity) in both main PROMPT and HANDMADE_SUFFIX; WORKED EXAMPLE anchors stretch-satin kaftan to MODERATE ~$65-$85. Real Depop sold comps for unknown-maker butterfly abayas / batwing maxis cluster $50-$95; prior Simple tier $30-$70 was systematically underpricing because "plain stretchy knit" surface-matched the Simple-band slip example. **Pattern lesson: tier by silhouette + fabric yardage, not just construction complexity. A kaftan (~4 yds) and a slip (~1.5 yds) are NOT the same labor floor even when both read as "plain knit", that's a 2-3x labor difference the prompt has to spell out.**
- **Altered dress moderate band tightening, supersedes 5/20** (`services/gemini.ts`, uncommitted). Simple $30-$50 → $25-$40. Moderate $50-$80 → $40-$65 (anchor $40 + 30% × $25 = $48 → recommended $50). Complex $80-$140 unchanged. Code clamp basic-fabric cap $80 → $65. WORKED EXAMPLE anchors updated to ~$45-$55, "NOT upper-moderate $75+" → "NOT upper-moderate $60+". Both PROMPT and HANDMADE_SUFFIX locations. Trigger: user comp-flagged mint chiffon altered prom dress scan at $60/$50-$75, sold cluster actually $40-$60. **Pattern lesson: hobbyist altered prom/party reworks anchor lower than the model's first-pass estimate; comp-check periodically because the model drifts upward on premium-fabric items even when the construction is moderate.**
- **AI-fail inline error card UX** (`app/(tabs)/scan.tsx`, uncommitted, ~50 lines). Replaced toast-only failure on `handleScanStaged` with persistent inline card in the scan-result slot. New `ScanErrorKind` type (busy / network / unavailable / parse / unknown), `classifyScanError(err)` helper, `getScanErrorCopy(kind)` returns `{title, body, icon}` (all generic, no AI provider names per new memory). Try again + Clear buttons via shared `<Button>`. `accessibilityLiveRegion="polite"` so screen readers announce. `Sentry.captureException` with `{tags: {scope: 'scan', scanErrorKind: kind}}` for production telemetry (previously only `__DEV__` console.log). Rescan + refresh-upcycle paths intentionally still toast (they happen with a valid result on screen so user has a fallback). **Pattern lesson: persistent inline state beats auto-dismissing toast on primary paths. A toast disappearing in 2.6s while the user is still figuring out what happened leaves them with no path forward.**
- **Library permission Alert + camera toast cleanup** (`app/(tabs)/scan.tsx`, uncommitted). `handlePickFromLibrary` was calling `ImagePicker.launchImageLibraryAsync` directly with no permission check; iOS silently returned `{canceled: true}` on denial = silent failure. Added explicit `getMediaLibraryPermissionsAsync()` + `requestMediaLibraryPermissionsAsync()` pre-check; on denial fires native `Alert.alert` with Cancel + Open Settings → `Linking.openSettings()`. Camera permission flow already had persistent denied UI at `scan.tsx:2090-2105` (iOS sets canAskAgain=false on first denial); dropped the redundant "Camera access is needed to scan" toast in `handleTapToScan` since the inline UI already shows Open Settings. **Pattern lesson: ImagePicker silently returns `canceled: true` on denied permission, not an error. Pre-check + native Alert is the right pattern; relying on the picker's exception path misses the most common failure.**
- **Microcopy sweep, 8 toasts normalized** (`app/detail.tsx`, `app/(tabs)/scan.tsx`, `components/PaywallModal.tsx`, uncommitted). "Could not" / "Unable to" → "Couldn't" (4 instances); permission errors unified to "Camera access needed" / "Photo library access needed" (3 different patterns → 1); "Purchases restored!" → "Purchases restored" (sole `!` outlier dropped). PaywallModal "Welcome to ThriftVault Pro!" kept as intentional celebratory moment per scope. Audit covered 56 toast strings across 7 files; web-platform-specific feature-named toasts and existing recoverable "try again" patterns left intact.
- **Haptics audit + shared `<Button>` default haptic** (`components/Button.tsx`, `app/(tabs)/profile.tsx`, `components/PaywallModal.tsx`, `app/(tabs)/index.tsx`, uncommitted, 13 edits). Profile (8 Pressables, 0 haptics) and PaywallModal (14 Pressables, 0 haptics) had zero feedback. Added `Haptics.selectionAsync()` inside shared `<Button>` component as default → auto-fires ~10 callsites (PaywallModal Subscribe, Profile Upgrade, scan error card Try Again + Clear, all empty-state CTAs, New Haul). Then per-file: Profile `handleSetting` (covers 7 settings rows), PaywallModal backdrop + close + plan select + privacy + terms + restore, Vault search clears + 3 store picker chips. Vault item/haul card taps intentionally NOT wired (navigation-only, matches iOS Photos/Calendar convention). **Pattern lesson: default haptic on a shared `<Button>` covers most surfaces in one edit; per-file Pressables still need explicit wraps. Skip haptics on navigation-only cell taps (iOS convention).**
- **Legal docs cleanup, 3 commits pushed** (`privacy-policy/index.html`, `terms/index.html`). (1) `30da1e9` disclosed Anthropic/Claude fallback in both docs + Terms gained Section 12 "Apple App Store Terms" with App Store Review Guidelines 3.2 EULA boilerplate (Apple as third-party beneficiary, no Apple responsibility, refund-via-Apple) + Last-updated April → May 2026; Contact bumped 12 → 13. (2) `c16b029` dropped "AI scan companion" marketing phrase from both intros (reads as marketing in legal context; AI is fully described in dedicated sections). (3) `a585b4b` dropped "a Tennessee limited liability company" state-of-formation descriptors from both intros, kept Governing Law clauses where state is legally needed for jurisdiction. **Memory saved: `feedback_no_tn_llc_in_legal_docs` (drop state-of-formation from legal intros + footer + about copy; keep only in Governing Law clauses).**
- **Landing page polish, committed `a8509b9`** (`index.html`). Hero lead "all on your phone" → "ready to list on Depop, Poshmark, eBay, or Vinted" (marketplace positioning sets expectations that ThriftVault is the scan/track step before listing elsewhere, frames positive rather than as a "we don't do X" disclaimer). Dropped "frankenpieces" from Handmade & upcycle pricing card (niche reseller-Depop slang for franken-style garments; "upcycles" already covers the audience without confusing first-time visitors).
- **POST_LAUNCH additions + DEV_OPS dev-client mental model, committed `792538b`** (`POST_LAUNCH.md`, `DEV_OPS.md`, `LAUNCH_BLOCKERS.md`). POST_LAUNCH gains 3 tech-debt items (useScanPipeline hook split from scan.tsx 86 hook calls, detail.tsx sub-component extraction at ~1700 LOC, gemini.ts file split prompt/clamps/index at 1760 LOC) + new "Cross-list export to marketplaces" idea documenting Vinted/Depop/Poshmark/eBay listing-export concept (clipboard-flow v1 needs no API, partnership unlocks at ~10k+ active resellers). DEV_OPS gains "Mental model for the dev-client switch" subsection (Expo Go but custom-built with RevenueCat baked in, one-time build/install via QR, daily `npx expo start --dev-client` Fast Refresh loop, 3 rebuild triggers: new native dep / app.json plugin / icon swap). LAUNCH_BLOCKERS step 5 gains blockquote callout pointing to it before the CLI setup steps.
- **Memory saved: `feedback_no_ai_provider_names`**, never expose AI provider/model names (Gemini, Claude, etc.) in user-facing copy; use generic "AI" or omit. Internal classification for telemetry/logging is fine. Triggered by AI-fail UX scoping where user clarified users don't need to distinguish which provider is down.
- **Smaller polish, uncommitted**: Scan result card `resultHeader` alignItems `'center'` → `'flex-start'` (price tag aligns with first line of multi-line title, matches Depop/Etsy convention). CustomTabBar scan-button press feedback opacity 0.9 → `transform: [{ scale: 0.96 }]` (subtle iOS squish replaces washed-out dim). Vault empty-search-state copy normalized ("No matches" title + parallel body across Flips/Closet and Hauls; CTAs unchanged because they do different things, "Clear filters" clears search + chip filter, "Clear search" just clears query). Profile "About AI estimates" Alert copy expanded to include Chairish + Etsy for furniture/homewares (was naming only Depop/eBay/Poshmark which excluded the furniture+homewares scope).

### Session, 2026-05-23
- **Pre-launch responsive design pass for iPhone range + Dynamic Type** (`components/PaywallModal.tsx`, `app/onboarding.tsx`, `components/CustomTabBar.tsx`, `app/(tabs)/index.tsx`, `app/detail.tsx`). Audit confirmed structural responsive design holds across SE 2/3 (375x667) through 16 Pro Max (440x956): all `useWindowDimensions`, percentage grids, `aspectRatio` camera, `onLayout` photo gallery. 3 fixes: (1) PaywallModal sticky-CTA: ScrollView wraps `header`+`sub`+`features`+`plans` between handleArea and Button (Button+fine+legal+legalLinks stay below as sticky footer); sheet gained `maxHeight: '90%'`; `features` dropped `maxHeight: 160` (was clipping 5th feature on SE 2/3 once first row wrapped); PanResponder rewritten to BottomSheetModal pattern. (2) Onboarding: per-slide content wrapped in vertical ScrollView with `flexGrow: 1 + justifyContent: 'center' + paddingVertical: 16`; default text stays centered identically, large Dynamic Type scrolls. (3) `maxFontSizeMultiplier={1.3}` per-callsite on tab labels, vault search inputs (flips+hauls), filter chips, detail page pills (add-photo / category / platform / status). **Pattern lesson 1: a Modal that contains both a draggable handle AND scrollable content needs `onStartShouldSetPanResponder: () => false` + gated `onMove` (`g.dy > 4 && |dx|<|dy|`) or the inner ScrollView never sees touch starts and vertical scroll dies. Handle area should self-claim drags via its own `onStartShouldSetResponder: () => true`. BottomSheetModal at `components/BottomSheetModal.tsx:85-88` is the canonical pattern; PaywallModal predated it and used the wrong predicates (`onStartShouldSetPanResponder: () => true`).** **Pattern lesson 2: nested ScrollViews of opposite axis (horizontal pager + per-slide vertical) work fine on iOS; inner vertical needs explicit `style.width = screenWidth` (not just on contentContainerStyle) so outer paging math stays stable against the child width.** **Pattern lesson 3: `maxFontSizeMultiplier` belongs per-callsite on fixed-height pills/chips/tab labels at 1.3 (one notch above iOS default "M"). NEVER set globally via `Text.defaultProps.maxFontSizeMultiplier` because it would cap body content + AI rationale + legal text and regresses accessibility for low-vision users who set Dynamic Type to XXL precisely to read those.** Profile `appearanceSwitchText` skipped: only callsite is inside the commented-out dark-mode toggle block. Not yet tested on simulator; per-screen checklist parked at `~/.claude/plans/make-a-plan-for-snug-oasis.md`.
- **SECURITY_AUDIT.md refresh** (`SECURITY_AUDIT.md`). Added Finding 9 (`EXPO_PUBLIC_REVENUECAT_API_KEY` dormant in `hooks/usePurchases.ts:19`, low exposure since RC iOS keys are project-scoped) + Finding 10 (`ascAppId: 6772308542` + `appleTeamId: UG3X275FNX` intentionally committed to `eas.json`, both public-by-design once shipped; Team ID is in every IPA's entitlements, ASC App ID becomes the `apps.apple.com/.../id...` URL). Re-verified "Confirmed clean" with hardcoded `Linking.openURL` URLs across profile + PaywallModal, the 5/21 brand mailto migration, and the intentional `thriftvaultapp.com` LLC WHOIS. Methodology dropped stale TestFlight reference. Historical secret scan rerun (`AIza` / `sk-ant` / `appl_`), only matches are the audit's own pre-commit regex examples and LAUNCH_BLOCKERS.md `appl_...` placeholder strings, no real key leaks.
- **Furniture upcycle vocabulary expansion** (`services/gemini.ts:780,1556`). Main scan prompt furniture branch grew from one paragraph (~25 techniques) to 8 named categories (REFINISH / REUPHOLSTER / PAINT FRAME / HARDWARE SWAP / SURFACE-STRUCTURAL / RECANE-RERUSH / REPURPOSE / LIGHTING) + new ERA-SHIFT RECIPES section (80s oak → MCM-look, traditional → Japandi, particleboard IKEA → upgraded, beat-up MCM → restored authenticity, brown → Scandi) + refreshed Q2 2026 spike list (color-drench, fluted/reeded, organic-modern, Japandi, art-deco/Memphis revival) + new FURNITURE BANNED aesthetic defaults (farmhouse / shabby chic / country-rustic / boho beach / primitive) parallel to the existing fashion list. `buildUpcyclePrompt` regen path now branches on `category === 'furniture'` with a dedicated "furniture flipper" persona, furniture-specific internal questions (wood species / finish condition / joinery / era), and the same expanded vocabulary; non-furniture path returns the original fashion prompt unchanged. No type, UI, or persistence changes (existing `upcycle[]` field carries the richer output through `sanitizeSnapshot` to scan card + detail Insights). **Pattern lesson: when one branch of a category-conditional prompt is shallow compared to its sibling branches, the model fills the gap with the closest-fit branch's vocabulary (fashion-persona ideas leaking into furniture scans). Match branch depth to sibling depth, don't trust the model to neutralize a strong persona declaration just because the category routes elsewhere.**
- **Before/After orientation bug, cover slot is now authoritative** (`services/gemini.ts:1031,1079-1083,1087-1096`). Mint-chiffon dress scan kept naming + describing the BEFORE source garment (strapless prom mini with black embellished waistband + high-low hem) instead of the AFTER (lace bodice with spaghetti straps + chiffon overlay). Three iterations: (i) added AFTER ORIENTATION + DESCRIPTION ISOLATION HARD RULEs at line 1079 anchored on "AFTER = photo with more hand-construction tells" with cover-slot override clause, model still leaked BEFORE features and called the AFTER "Strapless" with spaghetti straps clearly visible in cover; (ii) rewrote orientation to "cover slot is AUTHORITATIVE for the AFTER" (no model judgment required), removed the "judge which one is more hand-constructed" framing per user direction; still partial leak ("Strapless High-Low Chiffon Dress" with embellished waistband in sub); (iii) added three layers of defense: hoisted the rule to line 1031 as the FIRST thing the model reads in multi-photo branch, kept the mid-suffix rules at 1079-1083, added FINAL DESCRIPTION CHECK at 1087-1096 with 4 binary YES/NO cross-checks (STRAPS / WAISTBAND / HEM / BODICE) + positive worked example ("Mint Green Lace-Bodice Spaghetti-Strap Chiffon Mini Dress") and the model's exact wrong output as the labeled negative case. Final scan output: "Mint Green Chiffon High-Low Dress" with "spaghetti straps, silver-tone buckle detail, ... altered from strapless" in sub. "High-Low" residual leak (cover crops hem out of frame, model still pulled the descriptor from BEFORE) judged acceptable as a minor inaccuracy a reseller can 1-tap edit. Updated `feedback_photo_position_agnostic.md` memory to record both the slot-2-5-unordered rule AND the new cover-is-authoritative-for-AFTER rule with the inversion-judgment-is-fragile lesson. **Pattern lesson 1: when a rule asks the model to make an inverted judgment ("polished isn't always newer" because handmade looks less factory-perfect than the source), the model gets it backwards more often than not. Anchor on a deterministic signal the model cannot misjudge (cover slot identity) instead of asking it to reason through an inversion.** **Pattern lesson 2: HARD RULEs buried mid-prompt at line ~1080 of a ~1500-line prompt get ignored even with explicit forcing language. Belt-and-suspenders fix: hoist the rule to the entry of the relevant prompt branch AND add a pre-emit FINAL CHECK at the tail (modeled on FINAL SANITY CHECK at line 612, the same pattern was load-bearing for pricing self-correction).**
- **LAUNCH_BLOCKERS.md, banking active + AI-logo swap added** (`LAUNCH_BLOCKERS.md:9,14`). Banking active on App Store Connect (2026-05-23), all three pre-prebuild gating items (Paid Apps + Tax + Banking) now check off. New blocker at line 14: swap the AI-illustrated v2 app icon for a human-made mark before submit. Rationale: the app's own scan flags "AI-GENERATED PHOTO" as a red flag, an AI app icon creates a screenshot-worthy brand contradiction on TikTok/Reddit. Budget: $50-200 Fiverr / 99designs / contract illustrator, 1-3 day turnaround. After swap, re-do icon re-export across 5 paths (4 in `app.json` + `WebSidebar.tsx:83`).

## Post-Launch Ideas

See [POST_LAUNCH.md](POST_LAUNCH.md), single source of truth for scoped todos and unscoped ideas.
