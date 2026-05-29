# App Store Listing

**App Name:** ThriftVault: Scan to Flip

**Subtitle:** Track flips, scan items, profit

**Category:** Shopping (primary), Business (secondary)

**Description:**

ThriftVault helps thrift resellers track their inventory, estimate profit, and stay organized, all from their phone.

**Scan & Identify**
Point your camera at any thrift find and get an instant AI-powered item identification with estimated resale value.

**Track Everything**
Log what you paid, where you bought it, which platform you're selling on, and your target resale price. See your profit at a glance.

**Organize Your Way**
View your inventory as flips, closet items, or hauls. Search and filter by category, status, store, or platform.

**Know Your Numbers**
See total profit, ROI, best flips, and profit by store on your profile dashboard.

**No account needed.** Your data stays on your device. No cloud, no sign-up, no tracking.

Start with a **30-day free trial**, every Pro feature unlocked: AI scan, vault, hauls, profit tracking, and more. After your trial, choose a plan that fits: Monthly ($4.99/mo), Season Pass ($9.99/3 mo), or Annual ($29.99/yr).

By downloading ThriftVault, you agree to our Privacy Policy: https://thriftvaultapp.com/privacy-policy/

**Keywords:** thrift, resell, reseller, flip, haul, poshmark, depop, ebay, inventory, tracker, profit

## Screenshots (6.9" iPhone, 1320×2868)

Italics = Playfair Display emphasis word. Plain = DM Sans subhead. Match landing-page hangtag motif, cream / vintageBlue bg, iPhone 16 Pro mockup frame.

1. **Scan result (hero)** — Snap a tag. See the *flip.* / AI pricing in seconds, calibrated to recent Depop, eBay, and Poshmark sold listings.
2. **Vault grid** — Every find, *tracked.* / Inventory, cost basis, and resale prices in one place. Profit math handled.
3. **Hauls** — Every trip, a *haul.* / Group finds by shopping trip. ROI, photos, and totals per stop.
4. **Red-flag banner** — Catch the *red flags.* / Heads-up on suspected counterfeits, scams, and condition issues on every scan.
5. **Profile stats** — Numbers that make it *worth it.* / Total profit, best flip, and profit by store, at a glance.

## Capture & compose pipeline

### 1. Seed the dev client with realistic data

- 6 to 8 items with photos, mixed statuses (unlisted / listed / sold), 2 to 3 stores with sold items so profit-by-store has real bars
- For the hero scan, run a real Gemini scan on a recognizable-brand item from your closet; capture the result mid-confidence, not the "low data" state
- Capture everything in **light mode** (cream background reads stronger on the App Store)

### 2. Capture raw screenshots on iPhone 13

- Native size is 1170×2532
- Volume up + side button, AirDrop or iCloud to the Windows machine

### 3. Compose in Figma

- New file, page named "App Store Screenshots", 5 frames at **1320×2868** (6.9" iPhone)
- Background: `#F8F1E9` (cream) or subtle cream-to-white gradient
- Device frame: iPhone 16 Pro mockup from Figma Community
- Scale the raw screenshot ~1.13× to fit the mockup screen area; UI re-renders cleanly at this ratio (reviewer-acceptable)

### 4. Layout per frame

- **Top ~25%:** Playfair Display Bold headline, 80 to 100 px, charcoal `#3C2F2F`; italic emphasis word per the table above
- Optional DM Sans Regular subhead below, 36 to 44 px
- **Bottom ~75%:** device mockup with the screenshot inside
- Optional soft drop shadow behind the device for depth
- Match landing-page hangtag motif: cream bg, vintageBlue `#508C88` accents only where copy needs emphasis

### 5. Export

- PNG at 1x (frames are already at target resolution)
- File naming: `01_scan.png`, `02_vault.png`, `03_hauls.png`, `04_redflag.png`, `05_profile.png`
- ASC auto-scales to 6.7" / 6.5" / 5.5" displays; one 6.9" set covers the matrix

### 6. Upload to App Store Connect

- App Information, App Store, Screenshots, iPhone 6.9" Display
- Drag to reorder; #1 is the hero shown in search-result cards

### Tips

- Screenshot #1 is what most shoppers see in search; make it the strongest
- Keep all 5 visually consistent (background, headline position, scale)
- Whitespace sells; don't crowd
- Apple rejects misleading content: show real app UI only, no Apple-badge imitations, no competitor names
