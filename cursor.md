# ThriftVault session notes

Use this file for quick context on recent product and code changes. For stack and architecture, see `CLAUDE.md`.

---

## Session 2026-03-24

- **`app/detail.tsx` — keyboard:** Dismiss keyboard on scroll (`keyboardDismissMode`, `onScrollBeginDrag`, downward `onScroll` with keyboard-show guard so `KeyboardAvoidingView` does not false-trigger). iOS **InputAccessoryView** with **Done** on Paid / Resale **decimal-pad** fields (inline fields steal scroll; pad has no Done key). **`nestedScrollEnabled`** on main `ScrollView`.
- **`app/detail.tsx` — ROI:** Infinity ROI uses larger type (`profitStripRoiInfinity`) so **∞** matches the strip better.
- **`app/detail.tsx` — Add photo:** **`Alert.alert`** for camera vs library replaced with a **themed centered sheet** (store-picker style: backdrop, cream card, icons, Cancel). **`executeAddPhoto`**, **`addPhotoModalVisible`**; web still opens library directly.
- **`cursor.md` — post-launch ideas:** Expanded notes for **Find this item**, **Listing photo tips** (AI + **Thrifty** gold hanger mascot: arms, legs, eyes, subtle motion), **Thrifty loading** (speech bubble, rotating phrases, **3–4** lines per bucket), **Thrift AI** (outfit + referral / niche link mix), **Ask your vault**, **Vault photo memory** (advanced collage / tap to listing).

---

## Item detail (earlier)

- **Kebab menu dismiss:** Opening the menu calls `Keyboard.dismiss()` so the first outside tap closes the menu instead of only dismissing the keyboard. Backdrop uses `TouchableWithoutFeedback` instead of `Pressable` for the dimmed area (`app/detail.tsx`).
- **Paid / resale hints:** Subtext under **Paid** explains users should enter real cost; closet gets optional copy. Paid placeholder is minimal (`0`). (`app/detail.tsx`)
- **Store field:** `FieldRow` supports optional `placeholder`; Store uses `Store (optional)` (`app/detail.tsx`).

---

## Scan

- **Paid default:** New items from scan always save with **`paid: 0`** (no AI `suggestedPaid` on the saved item). Scan card can still show model estimates; detail is the source of truth (`app/(tabs)/scan.tsx`).
- **Store default:** New scan items use **`store: ''`**, not a placeholder name (`app/(tabs)/scan.tsx`).
- **No demo scenario:** `DEMO_SCAN_SCENARIO` removed. `runScan` requires a photo URI; otherwise a toast explains mobile camera/library (`app/(tabs)/scan.tsx`, `constants/seedItems.ts`). `CLAUDE.md` updated to match.

---

## Tab bar

- **Scan FAB vertical position:** `scanWrap.marginTop` in `components/CustomTabBar.tsx` (tablet vs phone negative values) controls how high the center Scan button sits.
- **Side tabs:** `bar.alignItems` is **`flex-end`** so Vault and Profile align to the bottom baseline with the taller Scan column.

---

## Hauls and store (optional + bulk)

- **InventoryContext:** **`updateItemsByDate(date, updates)`** updates all items with that `date` in one persist (`context/InventoryContext.tsx`).
- **New Haul (flip) modal:** **`Thrift Store`** removed from presets. **Not set** chip (`_none`) is default; **Add to Haul** is always enabled. Store string mapping: `_none` or empty custom → `''` (`app/(tabs)/index.tsx`).
- **Haul list:** Unique store labels omit empty strings after trim (`app/(tabs)/index.tsx`).
- **Haul detail:** Header **storefront** icon opens a modal to set or clear **store for all items on that haul date** (Apply / Clear store) via `updateItemsByDate` (`app/haul-detail.tsx`).
- **Profile:** Sold flips with no store roll into a single **Not set** row in profit-by-store (`app/(tabs)/profile.tsx`).

---

## Post-launch (ideas)

### Find this item

Help users **hunt** for the same or similar pieces, not claim **provenance**. No in-app “suggestions” or comp engine required.

- **Why users care (example):** Someone shows a fit or grail piece on TikTok/Reels and **won’t say where they got it** (“gatekeeping”). Users want a **Google-style escape hatch**: reverse image / visual search and text search to find **similar** listings or dupes, not a magic “this exact SKU from this store” answer from ThriftVault.
- **Positioning:** ThriftVault can **give a name to an item** (from scan or what the user types): brand-ish label, category, keywords people can **search with**. “Find this item” is the next step: use that name to open **Google-style** / marketplace hunts for similar pieces. We still do not claim **where** something was bought; we arm users with **what to search for**.
- **Referral / outlinks:** One-tap opens marketplace **search** (brand + category + “vintage” etc.) in browser or native app, with **affiliate / referral IDs** where allowed; disclose in settings and near actions.
- **Optional URL field on item:** User pastes a listing URL as **“Similar listing”** or **“Source clue”** (not verified).
- **Share / deep link:** “Share this hunt” as a prefilled query or ThriftVault link that lands in-app with that query.
- **Image search (optional):** Link out to Google Lens / system image search with a short disclaimer.
- **Placement:** Item detail action or row; later scan / haul entry points.

### Listing photo tips (AI)

After someone **adds a photo** to an **existing** item on detail, optional **Gemini** pass suggests **listing-friendly** nudges (e.g. looks dusty, try a lint pass; harsh light; busy background). Goal: help resale photos, not scold.

- **UX:** **Non-blocking** (toast, inline line, or collapsible “Photo tips”). Supportive **“Tip:”** framing, humble **“might / looks like”** copy. **Wrong guesses happen** (texture, lighting misread as dirt); design for that.
- **Design:** Must feel **friendly and human**, not a **soulless** system alert. Use **ThriftVault design system** end to end: `theme` colors (**cream** surface, **vintageBlue** / **vintageBlueDark** accents, **charcoal** / **mauve** text), **Playfair + DM Sans**, **radius** and **shadows** from `theme/`, **AppIcon** or a small warm illustration-style asset if we add one. Avoid default gray iOS-style sheets, raw monospace, or generic “AI” chrome. The UI should read like a **helpful thrift buddy**, same voice as the rest of the app.
- **Mascot (optional):** A small **ThriftVault character** that shows up with tips (same idea as Claude’s companion, but **our own** design: not a copy). Direction: a **cute gold hanger** body with **arms**, **legs**, and **adorable eyes** (on-brand with resale / closet). **Motion:** cute but **very subtle** (soft idle: tiny sway, blink, or micro-bounce) so it feels alive without stealing focus. Keeps the feature warm and recognizable; size it so it never crowds the photo or the tip text. Can ship tips without the mascot first and add later.
- **Control:** **On by default**; users can **turn tips off** in **Settings** (Profile or a dedicated section). Optional **“Get tips”** on a photo if we want on-demand only in some flows. Avoid firing on **every** upload without limits (debounce, first new photo per item, or explicit action) so it never feels spammy.
- **Product:** Same **photo leaves device for Gemini** disclosure as scan; watch **cost/latency** if this runs often.

### Thrifty loading states

When **Thrifty** is on screen during **async** work (e.g. **Thrift AI**, **Ask your vault**, heavier flows later):

- **Speech bubble** above the character with **rotating** short lines so the wait feels alive: e.g. **“Searching…”** **“Finding…”** **“Thrifting…”** (small pool of copy, gentle **cycle** / fade between lines, not frantic). Style the bubble with **theme** (cream / surface, charcoal or mauve caption, soft border or shadow), not a default system loader.
- **Character** keeps the same **subtle idle motion** (sway / blink) so it never looks **frozen** next to the bubble.
- **Phrase pool + context:** Maintain a **larger** list of candidates (hunt / rack / flip / playful lines; see brainstorm). For each wait, narrow to **3–4** lines that fit the **flow** or **question** (e.g. Ask vault vs Thrift AI vs photo search). **Implementation:** string arrays per **bucket**, optional **keyword** routing or **rule** by screen; **low lift**, mostly **copy** tuning. Avoid phrases that sound judgey or tired after many loads.

### Thrift AI (outfit / “dress me”)

Post-launch **social-forward** idea: user posts a **photo** (piece or partial fit) and asks for **what to thrift or wear with it** (“help me finish this outfit,” “what goes with this jacket?”). **Gemini** returns **several** styled suggestions (same spirit as **scan card flip ideas / bundle upsell** lines: concrete, thrifty, resale-aware), not a single item ID.

- **Positioning:** **Styling coach + thrift hunt prompts**, not a personal shopper with inventory. Suggestions are **ideas and search angles** (categories, eras, silhouettes, colors), same honesty as scan about confidence.
- **Links / monetization mix:** Where it fits, deep links or **referral URLs** to major resale apps (Depop, Poshmark, eBay, etc.) when we have programs. **Also** surface **niche** or **non-affiliate** paths (local thrift, Etsy vintage, specialty shops, “search this phrase on Google”) so results are not **biased** toward referral marketplaces only. Label or group **affiliate** taps in UI; disclose in settings like other referral features.
- **Share / viral:** Copy and export framed for **“I let ThriftVault dress me”**-style posts (optional share card or screenshot-friendly result). Organic marketing if people post results; keep **opt-in** and no cringe forced branding in every line.
- **Mascot:** Natural home for the same **gold hanger** character (arms, legs, eyes, subtle animation): appears on this flow for personality, same design rules as listing photo tips. Optional at MVP of the feature.
- **Product:** New prompt + JSON shape (multi-suggestion); **photo to API** disclosure; **quota / Pro** rules TBD with monetization; consider **rate limits** if this is share-bait heavy.

### Ask your vault (find stuff in the app)

Post-launch: **natural-language** help over **your own inventory** (“Where’s that **floral dress** I got **last year**?”). Complements the vault’s **text search** and filters: user asks in plain language; the app returns **candidates** (and can open **item detail**).

- **How it could work:** **Hybrid** is safest: narrow by **date / category / store** locally when possible, then **rank or interpret** with **Gemini** using a **compact JSON** of item fields (name, cat, date, store, notes), not raw photos. Or **full local** fuzzy matching first, AI only when the query is vague. **Inventory still lives on device**; anything sent to Gemini needs the same **disclosure** mindset as scan.
- **UX:** Entry from **Vault** (search bar mode or “Ask” affordance). **Humble** when nothing matches (“Nothing fits that yet—try rephrasing”). Optional **gold hanger** mascot for warmth, same subtle motion rules.
- **Product:** **Quota / Pro** and **offline** behavior TBD (fallback to classic search if no network).

### Vault photo memory (advanced / later)

**Much harder** than text-only “Ask your vault”: user asks in natural language for **visual** matches across **every photo** stored on item details (e.g. “**photos of me and my friends**”). The app would **surface a collage** of matching **thumbnails**; **tap a tile** opens that **listing**.

- **Why it’s advanced:** Needs **vision** over a **growing local corpus** (many images per user): options include **on-device** embeddings / Apple-style photo APIs where allowed, **batched** Gemini calls (cost + latency + **sending many images** off device), or **hybrid** (metadata + occasional vision). All paths need **clear consent**, **privacy copy**, and honest limits (“best effort,” not face-ID accuracy claims).
- **UX:** Collage grid, **loading** state for large vaults, **empty** state when nothing matches. Same **tap → `/detail`** pattern as today.
- **Reality check:** Treat as **moonshot / v2+**; ship **Ask your vault** on **metadata** first, then revisit if demand and budget justify it.

---

## Files touched — 2026-03-24

| Area | Files |
|------|--------|
| Item detail | `app/detail.tsx` |
| Session / ideas | `cursor.md` |

## Files touched — earlier (reference)

| Area | Files |
|------|--------|
| Detail | `app/detail.tsx` |
| Scan | `app/(tabs)/scan.tsx` |
| Vault / hauls / store picker | `app/(tabs)/index.tsx` |
| Haul detail | `app/haul-detail.tsx` |
| Profile | `app/(tabs)/profile.tsx` |
| Inventory | `context/InventoryContext.tsx` |
| Constants | `constants/seedItems.ts` |
| Tab bar | `components/CustomTabBar.tsx` |
| Docs | `CLAUDE.md` |
