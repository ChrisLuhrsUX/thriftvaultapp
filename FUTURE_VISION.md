# Future Vision — Universal Shopping Companion

## Overview

This documents the planned expansion of ThriftVault from thrift reselling to a universal in-store shopping companion. Same logo, same design system — just a broader audience.

**Do not rebrand until the general shopping features are actually built and ThriftVault has an established user base. Do not ditch ThriftVault to build this — ThriftVault is nearly shippable, the expansion needs months of work (product ID, price comparison APIs, affiliate integrations, wishlist). Ship ThriftVault first, it IS the prototype.**

## Core Concept

Turn every physical store into a showroom. Users browse in-store for the experience — see, touch, try items — then scan with the app to find better prices online. They leave with a curated wishlist, not bags. Buy later at the best price.

- Not killing in-store shopping — enhancing it
- Replacing the buying part, not the browsing part
- In-store visit replaces scrolling product photos and reading reviews online
- Users already expect 1-5 day shipping from online orders — same wait time, better discovery experience
- Reduces returns because users saw/tried the item in person first

## How It Works

1. User shops in-store (browses, tries things on, etc.)
2. Scans items with AI scanner
3. App identifies exact product (brand, model, SKU, size, color)
4. Shows online prices across retailers (Amazon, Walmart, Target, etc.)
5. User saves items to wishlist ("Saved" tab)
6. Buys online later at best price
7. Items arrive → post a haul

## Revenue Model

### App Revenue
- Subscription model (same as ThriftVault: Monthly $4.99, Season Pass $9.99/3mo, Annual $29.99/yr)
- 30-day trial with **full app / Pro features**, then subscription
- Keep price accessible to maximize downloads and affiliate volume

### Affiliate Revenue (the real money)
- Amazon Associates, Walmart, Target, eBay, Etsy, Best Buy, Wayfair, Nike, Nordstrom — all have affiliate programs
- Earn 1-8% commission per sale when users buy through app links
- Amazon: unique tag (e.g. `?tag=thriftvault-20`), 24-hour cookie, monthly payout via direct deposit, $10 minimum
- Buyer pays the same price — commission comes from retailer's cut, not the seller's
- One $200 coat = $4-16 commission — more than a month of subscription
- At scale, affiliate income dwarfs subscription revenue
- **FTC disclosure required:** "We may earn a small commission from purchases made through links in this app" — in privacy policy and near affiliate links

### Long-term possibility
- If affiliate revenue scales enough, app could go fully free to maximize downloads and affiliate clicks

## Tab Structure

| Tab | Purpose |
|---|---|
| Scan | AI scanner — identifies items, shows prices, affiliate links |
| Saved | Wishlist — scanned in-store, waiting to buy online |
| Profile | Settings, stats |

- 3 tabs, clean and focused
- No "My Stuff" / inventory tab — expansion is about scanning and saving, not inventory management
- Haul flow: scan in-store → save → order online → items arrive → post haul
- Hauls aren't exclusive to thrifting — shopping hauls are huge on TikTok/YouTube

### ThriftVault vs Expansion tabs:
| ThriftVault | Expansion |
|---|---|
| Vault (inventory/hauls/closet) | Scan |
| Scan | Saved |
| Profile | Profile |

## Technical Requirements (not yet built)

- Product identification AI (exact brand, model, SKU, size, color — not just "vintage hoodie")
- Price comparison APIs across major retailers
- Affiliate link integration (Amazon Associates, Walmart, etc.)
- "Saved" tab / wishlist functionality
- Real-time pricing data

## Target Audience

| Phase | Audience | TAM |
|---|---|---|
| ThriftVault (launch) | Thrift resellers | ~5-10M US |
| Expansion (future) | All in-store shoppers | 250M+ US, billions globally |

## User Projections (with marketing)

Marketing strategy: TikTok/Instagram content 3-5x/week + micro-influencer partnerships ($500-2K each)

### Phase 1 — ThriftVault (thrift niche)

| Metric | Conservative | Optimistic |
|---|---|---|
| Year 1 downloads | 50K | 200K |
| Active users (30-day) | 15K | 60K |
| Paid conversions (~8%) | 1,200 | 4,800 |
| Revenue (after Apple) | $2,030 | $8,120 |

### Phase 2 — Expansion (general shopping)

| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Downloads | 500K | 2-5M | 10-20M |
| Active users | 150K | 750K | 3-5M |
| Paid conversions | 12K | 60K | 250K-400K |
| App revenue | $20K | $101K | $425-680K |
| + affiliate revenue | TBD | TBD | potentially >> app revenue |

## Branding Notes

- Keep ThriftVault name as long as it serves the brand — don't rename prematurely
- "Thrift" can mean "thrifty/smart shopping" not just "thrift stores" — the name may already work for expansion
- Logo stays the same regardless
- Any future rename should only happen if the brand has clearly outgrown the name
- Checked USPTO: alternative names available (as of March 2026)

## API Costs

Using cheapest vision models available:

| Model | Input (per 1M) | Output (per 1M) | Cost per scan |
|---|---|---|---|
| GPT-5 Nano | $0.05 | $0.40 | ~$0.00005 |
| Gemini 2.5 Flash-Lite | $0.075 | $0.30 | ~$0.00005 |
| Claude Haiku 4.5 | $1.00 | $5.00 | ~$0.0008 |

- At 10,000 users scanning 50 items each (500K scans), API cost ≈ $25-50
- API cost as % of revenue: ~0.3-0.6% — negligible at any scale
- Keep scan prompt model-agnostic so you can swap providers overnight
- AI API costs have only gone down historically (50-80% year over year)

## Strategy

1. **Launch ThriftVault** — thrift niche MVP, prove AI scan works, build audience and reviews
2. **Build traction** — TikTok/Instagram marketing, influencer partnerships
3. **Add general product scanning** — identify retail products, price comparison APIs, affiliate links
4. **Add "Saved" tab** — wishlist for items to buy online later
5. **Evaluate rebrand** — only if the name no longer fits the product
6. **Scale affiliate revenue** — potentially go fully free once affiliate income covers everything
