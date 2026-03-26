# App Store Screenshots — Step-by-Step

## Required Sizes

| Device         | Resolution  | Required |
|----------------|-------------|----------|
| 6.7" (iPhone 15 Pro Max) | 1290 x 2796 | Yes |
| 6.5" (iPhone 11 Pro Max) | 1242 x 2688 | Yes |

## The 8 Screenshots (in order)

| #  | Screen              | Headline Copy                  | What to Show                                      |
|----|---------------------|--------------------------------|---------------------------------------------------|
| 1  | Scan card           | "Scan. Price. Flip."           | AI scan result with flip suggestions and prices    |
| 2  | Scan screen         | "AI-Powered Scanning"          | Camera view / scan in progress                     |
| 3  | Flips               | "Track Every Flip"             | Flips grid with items, mix of statuses             |
| 4  | Flip item detail    | "Track Every Detail"           | Filled-out item with photos, profit strip, status  |
| 5  | Closet              | "Your Digital Closet"          | Closet tab with personal items                     |
| 6  | Hauls               | "Log Every Haul"               | Hauls view with shopping trips grouped             |
| 7  | Profile             | "Know Your Numbers"            | Profile with stats and profit-by-store             |
| 8  | Onboarding          | "Works Offline. No Account."   | Onboarding screen highlighting privacy/simplicity  |

## Steps

### 1. Seed the app with demo data
- Add 6-8 realistic items with photos, varied statuses (unlisted, listed, sold), different stores and categories
- Make sure profit-by-store has at least 2-3 stores with sold items
- Use real-looking thrift photos (your own inventory or styled flatlays)

### 2. Capture raw screenshots
- Run on iPhone simulator (6.7" — iPhone 15 Pro Max in Xcode) or real device
- Navigate to each screen listed above and screenshot
- For scan result: trigger a real Gemini scan or mock the result state
- Capture in **light mode** (cream background photographs better for App Store)

### 3. Set up Figma file
- Create a page called "App Store Screenshots"
- Add 8 frames at **1290 x 2796** (6.7")
- Background: `#F8F1E9` (cream) or slight gradient from cream to white

### 4. Layout each screenshot frame
- **Top ~25%**: Headline text (Playfair Display Bold, 80-100px, charcoal `#3C2F2F`)
- **Bottom ~75%**: Device screenshot, slightly scaled down with rounded corners
- Optional: subtle drop shadow behind the screenshot for depth
- No device mockup frame needed — raw screenshot with rounded corners is cleaner

### 5. Typography in Figma
- Headlines: Playfair Display Bold
- Subtext (if any): DM Sans Regular
- Colors: charcoal for text, vintageBlue `#508C88` for accents
- Keep copy to 3-5 words per headline max

### 6. Export
- Export each frame as PNG at 1x (already at target resolution)
- Duplicate the page, resize all frames to **1242 x 2688** for the 6.5" set
- File naming: `01_scan.png`, `02_vault.png`, etc.

### 7. Upload to App Store Connect
- App Store Connect > App Information > Screenshots
- Upload 6.7" set under "iPhone 6.7" Display"
- Upload 6.5" set under "iPhone 6.5" Display"
- Drag to reorder if needed — order matters, #1 is hero

## Tips
- Screenshot #1 is what people see in search results — make it the most compelling
- Keep all 8 frames visually consistent (same background, same text position, same scale)
- Don't crowd the frame — whitespace sells
- Apple rejects screenshots with misleading content — show real app UI only
