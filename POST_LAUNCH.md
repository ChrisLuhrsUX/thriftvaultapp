# ThriftVault, Post-Launch Roadmap

Everything that is intentionally deferred until after the initial App Store launch. See [MVP.md](MVP.md) for launch-blocking work.

## Scoped (concrete todos)

Ordered by post-launch impact for a solo indie app: growth levers and listening tools first, UX polish and tech debt last.

- [ ] **Feedback channel**, Discord community or in-app feedback form beyond support email. You're flying blind on real user pain without it.
- [ ] **Landing page**, marketing website to promote the app (App Store link, features, screenshots). Required for any external marketing, press, or social sharing.
- [ ] **ASO iteration**, refine keywords and metadata based on real App Store search data. Highest-leverage organic download lever once you have impression/conversion data.
- [ ] **Android launch**, test, fix platform-specific issues, and publish to Google Play Store. Doubles addressable market.
- [ ] **Affiliate links**, link scanned items to retailer listings (Amazon, Walmart, etc.) with affiliate tags for commission revenue. Revenue diversification beyond subscriptions.
- [ ] **Platform filter in Vault**, filter by eBay / Poshmark / etc. QoL for active multi-platform resellers.
- [ ] **Inventory tracking (stock count)**, let makers and bulk-buyers track how many copies of the same item they have on hand (e.g. 10 of the same handmade earring design, or 5 identical thrifted t-shirts). Current model is one row = one item; this would add a quantity field and decrement on sale. Expands audience to makers.
- [ ] **Switch to `expo-image`**, replace `react-native` `Image` across vault/scan/detail with `expo-image` for persistent memory + disk caching. Fixes subtle haul thumbnail reload when switching between Flips/Closet and Hauls views (root cause: the ternary at `app/(tabs)/index.tsx:619` unmounts the inactive FlatList, and RN `Image` re-decodes from disk on remount). Tech debt.
- [ ] **Background scan actually completes (iOS native)**, today's perceived-seamless retry in `app/(tabs)/scan.tsx` (AppState handler + `handleScanStaged` finally) keeps the spinner continuous and suppresses the false error toast on background→foreground, but the Gemini scan still re-runs when iOS kills the network mid-flight. Real fix is a small Expo native module wrapping `UIApplication.beginBackgroundTask` so the in-flight `fetch()` gets ~30s of guaranteed extra runtime (~60s total with iOS's implicit grace), called on AppState 'background' and ended on completion or 'active'. Scope: ~30 lines Swift, Expo config plugin, ~10 lines JS wiring. Blocker: requires `npx expo prebuild`, which ends the Expo Go workflow on this project, pair with the RevenueCat prebuild step in [MVP.md](MVP.md). UX / tech debt.
- [ ] **Extract `useScanPipeline` hook from `scan.tsx`**, lift the AppState retry + abort threading + staged-photos + scan-session state machine (~400–500 lines) out of `ScanScreen` into a dedicated hook. The component currently runs 86 hook calls across ~1,600 lines of body, well past comprehension threshold, and the pipeline is the most fragile area (background-scan race, save-for-later round-trip, rescan paths) so isolated testability has the highest payoff. Tech debt.
- [ ] **Split `detail.tsx` into sub-components**, extract the Insights card, photo gallery + fullscreen viewer, and scan-history rows into their own files. The screen carries ~1,700 lines for a single route. The Insights card is the natural first split, it already has its own pill row, prompt buttons, and active/dismissed state machine. Tech debt.
- [ ] **Split `services/gemini.ts` into `prompt.ts` + `clamps.ts` + `index.ts`**, the 1,760-line file mixes a giant template-literal prompt with ~25 stacked post-parse clamps and the public scan API. Splitting lets prompt-only changes diff cleanly (load-bearing for the weekly pricing-drift PR routine) and lets the clamp cascade be reviewed without the prompt scrolling past it. Tech debt.

## Ideas (not yet scoped)

### Find this item
Help users hunt for similar pieces elsewhere. Not provenance claims. Use-case: someone gatekeeps a fit on TikTok, user wants a Google-style escape hatch (reverse image / visual search). ThriftVault gives an item a name (from scan or user input), then "Find this item" opens marketplace search (brand + category + "vintage" etc.) with affiliate/referral IDs where allowed. Optional URL field on item for "similar listing" / "source clue". Share as prefilled query or deep link. Image search via Google Lens link-out optional. Entry from item detail action row.

### Cross-list export to marketplaces
One-tap export of a vault item to Vinted, Depop, Poshmark, or eBay with description and pricing pre-staged. v1 (no marketplace partnership needed): tap "List on..." in item detail → photos open in the marketplace's iOS app via the share sheet, description + price + tags copied to clipboard for paste. Reduces typing friction ~70% on every marketplace, works without integration. True one-tap autofill requires a public seller-side API which Vinted, Depop, Poshmark, and eBay do not currently offer; existing cross-listing tools (Vendoo, List Perfectly) route around this with browser automation or scraping, neither is App Store friendly. Partnership path with Vinted (or peers) becomes plausible post-traction (~10k+ active resellers), until then ship the clipboard version. Distinct from "Find this item" above by direction: Find searches elsewhere; this exports out.

### Listing photo tips (AI)
After adding a photo to an existing item, optional Gemini pass suggests listing-friendly nudges (dusty, harsh light, busy background). Non-blocking (toast/inline/collapsible). Supportive "Tip:" framing, humble "might / looks like" copy. On by default, toggle off in Settings. Same photo-to-Gemini disclosure as scan. Debounce (first new photo per item or explicit action) so it never feels spammy.

### Thrifty mascot
Cute gold hanger with arms, legs, and adorable eyes. Very subtle idle motion (sway, blink, micro-bounce). Shows up with listing tips, loading states, Thrift AI. Can ship features without mascot first and add later.

### Thrifty loading states
Speech bubble above mascot with rotating short lines during async work ("Searching...", "Finding...", "Thrifting..."). Gentle cycle/fade, not frantic. Phrase pool per bucket (Ask vault vs Thrift AI vs photo search), 3-4 lines per context. Theme-styled bubble (cream/surface, charcoal/mauve caption). Character keeps subtle idle motion so it never looks frozen.

### Thrift AI (outfit / "dress me")
User posts a photo (piece or partial fit) and asks what to thrift or wear with it. Gemini returns several styled suggestions (categories, eras, silhouettes, colors). Links mix referral URLs to resale apps AND non-affiliate paths (local thrift, Etsy vintage, specialty shops, "search this phrase on Google") so results aren't biased. Share-friendly "I let ThriftVault dress me" format. Rate limits TBD with monetization.

### Ask your vault
Natural-language search over own inventory ("Where's that floral dress I got last year?"). Hybrid approach: narrow by date/category/store locally, rank/interpret with Gemini using compact JSON of item fields (not raw photos). Humble when nothing matches. Entry from Vault search bar or "Ask" affordance. Quota/Pro and offline behavior TBD.

### Vault photo memory (advanced / later)
User asks for visual matches across all stored item photos. Needs vision over growing local corpus: on-device embeddings, batched Gemini calls, or hybrid. Clear consent and privacy copy required. Collage grid UI, tap opens item detail. Moonshot / v2+; ship Ask your vault on metadata first.

### Pottery & small craftsmanship price range accuracy
**Addressed 2026-05-20.** Full homewares expansion (tiers 090–096 in `PRICING_TIERS.md` + `► HOMEWARES PRICING` branch in `services/gemini.ts`):

- **Tier 090 Studio Pottery** — regional signed $40–$300, mid-grail named maker (Karen Karnes, Warren MacKenzie, Marguerite Wildenhain, Maija Grotell, Don Reitz, Akio Takamori, Betty Woodman, Ron Nagle, named Japanese mingei) $200–$1500, top-grail (Lucie Rie, Hans Coper, Peter Voulkos, Beatrice Wood, Toshiko Takaezu, Bernard Leach, Shoji Hamada, George Ohr, Magdalene Odundo, Edmund de Waal) $1500–$8000+. `POTTERY HALLMARK & MAKER, HARD RULE` gates mid- and top-grail bands on a visible signature, chop mark, impressed cipher, or maker's stamp.
- **Tier 091 Art Glass** — unsigned modern decorative $15–$80, signed studio $80–$400, Murano authenticated $100–$800, signed Loetz/Daum/Gallé/Lalique $200–$2000+, Tiffany LCT $500–$5000+. `GLASS SIGNATURE & ORIGIN, HARD RULE` requires engraved master signature, intact foil-paper factory label, signed cane technique, or named factory mark before grail bands unlock.
- **Tier 092 Antique Metal Smalls** — sterling (.925/STER) $80–$400 (melt-value floor), coin silver (.900) $100–$600, English hallmarked $80–$1000+, pewter (touchmark) $20–$120, vintage signed brass/copper $40–$300. `METAL HALLMARK, HARD RULE` gates sterling/coin bands on visible stamp; without it, yellow-tone routes to brass / silver-tone to plated.
- **Tier 093 Antique Clocks** — modern battery $15–$80, mid-century battery $40–$200, antique mechanical (visible pendulum/escapement) $100–$800, longcase $300–$3000+, vintage Black Forest cuckoo $80–$400. `CLOCK MOVEMENT & ERA, HARD RULE` keeps quartz-in-vintage-case clocks out of the antique tier.
- **Tier 094 Pre-1900 Unmarked Ceramics** — salt-glaze crocks $40–$300, yellowware $30–$200, American redware $50–$400, English pearlware/creamware $40–$300.
- **`ItemCategory = 'homewares'`** added to `types/inventory.ts` + Vault filter chip + 35 SYNONYM_TO_CAT entries. Splits decor (lamps, mirrors, rugs, ceramics, glass, antique smalls, clocks) out of the `'furniture'` catch-all. Tiers 070–073 + 088 reclassified.
- **Code clamps (tiers 095/096)**: `isHandmadePottery` caps unsigned studio pottery at $200 / grail-named at $1500 (matches POTTERY_RX + GRAIL_POTTER_RX), `isCustomArtGlass` caps unsigned art glass at $300, `POTTERY_CONDITION_PENALTY_RX` applies 0.65× scale-down when crazing / hairline / chip / repair / glaze loss tokens appear in name/sub. `HOMEWARES EXCEPTION` added to `HANDMADE_SUFFIX` so handmade pottery routes to STUDIO POTTERY tier instead of the generic handmade labor ladder.
- **Verification-framed red flags** (route through teal "Worth verifying" banner via `RED_FLAG_VERIFICATION_PREFIXES`): UNSIGNED GRAIL CLAIM, UNSIGNED ART-GLASS CLAIM, VISIBLE CONDITION DEGRADATION, HALLMARK MISSING, QUARTZ-IN-VINTAGE-CASE CLOCK.

**Remaining gap**: photo-driven (not text-driven) detection of crazing / hairline cracks / chips. The 0.65× condition clamp fires on description tokens written by the vision model, not on pixel analysis. Acceptable for v1 — the model's vision prompt already inspects the photo and the regex catches what gets written. Dedicated photo-ML for hairline crack detection is moonshot territory, not warranted before launch.
