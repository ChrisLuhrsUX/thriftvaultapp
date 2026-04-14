# ThriftVault — Post-Launch Roadmap

Everything that is intentionally deferred until after the initial App Store launch. See [MVP.md](MVP.md) for launch-blocking work.

## Scoped (concrete todos)

Ordered by post-launch impact for a solo indie app: growth levers and listening tools first, UX polish and tech debt last.

- [ ] **Feedback channel** — Discord community or in-app feedback form beyond support email. You're flying blind on real user pain without it.
- [ ] **Landing page** — marketing website to promote the app (App Store link, features, screenshots). Required for any external marketing, press, or social sharing.
- [ ] **ASO iteration** — refine keywords and metadata based on real App Store search data. Highest-leverage organic download lever once you have impression/conversion data.
- [ ] **Android launch** — test, fix platform-specific issues, and publish to Google Play Store. Doubles addressable market.
- [ ] **Share item** — wire up the share sheet on item detail (button already exists, commented out in `detail.tsx`). Viral loop, very low effort.
- [ ] **Affiliate links** — link scanned items to retailer listings (Amazon, Walmart, etc.) with affiliate tags for commission revenue. Revenue diversification beyond subscriptions.
- [ ] **Platform filter in Vault** — filter by eBay / Poshmark / etc. QoL for active multi-platform resellers.
- [ ] **Inventory tracking (stock count)** — let makers and bulk-buyers track how many copies of the same item they have on hand (e.g. 10 of the same handmade earring design, or 5 identical thrifted t-shirts). Current model is one row = one item; this would add a quantity field and decrement on sale. Expands audience to makers.
- [ ] **Haul titles** — let users name their hauls instead of defaulting to the date (e.g. "Saturday Goodwill Run"). Polish.
- [ ] **Switch to `expo-image`** — replace `react-native` `Image` across vault/scan/detail with `expo-image` for persistent memory + disk caching. Fixes subtle haul thumbnail reload when switching between Flips/Closet and Hauls views (root cause: the ternary at `app/(tabs)/index.tsx:619` unmounts the inactive FlatList, and RN `Image` re-decodes from disk on remount). Tech debt.

## Ideas (not yet scoped)

### Find this item
Help users hunt for similar pieces elsewhere. Not provenance claims. Use-case: someone gatekeeps a fit on TikTok, user wants a Google-style escape hatch (reverse image / visual search). ThriftVault gives an item a name (from scan or user input), then "Find this item" opens marketplace search (brand + category + "vintage" etc.) with affiliate/referral IDs where allowed. Optional URL field on item for "similar listing" / "source clue". Share as prefilled query or deep link. Image search via Google Lens link-out optional. Entry from item detail action row.

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

### Furniture price range accuracy
Current scan prompt is clothing/accessory focused; furniture scans fall back on generic tier logic and mis-price. Furniture has its own market dynamics: brand matters a lot (Herman Miller, Eames, Knoll, Saarinen, Noguchi, Nelson, Hans Wegner, vintage Danish teak on the high end; West Elm, CB2, Crate & Barrel mid; IKEA/Target low), condition penalties are steeper (veneer chips, water rings, sagging cushions, structural cracks tank value), era matters (MCM original vs reproduction), and shipping logistics cap realistic resale (buyer pickup on Facebook Marketplace/Craigslist vs freight-shipped on 1stDibs/Chairish). Fix: add a furniture brand-tier block to `PROMPT` in `services/gemini.ts`, an `ItemCategory = 'furniture'` option, platform context (FB Marketplace local pickup, Chairish/1stDibs for high-end shippable), and a condition block calibrated to furniture damage (veneer, upholstery, joinery). Likely needs its own `FURNITURE EXCEPTION` similar to `DENIM EXCEPTION` since labor-hour handmade formula would absurdly overprice a refinished dresser.
