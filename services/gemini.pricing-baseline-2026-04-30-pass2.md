# Pricing Tier Baseline, Post-Q2 First Pass, Pre-Second Pass

**Created:** 2026-04-30 (later same day as the first-pass baseline)
**Purpose:** Rollback snapshot of `services/gemini.ts` factory tier block AFTER the Q2 2026 first-pass merge but BEFORE the second pass that adds vintage Americana / knit sets / boots / hats / Mountain Hardwear / refined jewelry tiers from previously-skipped research data.

**Three rollback levels available:**
1. Revert just the second pass → use this file (`-pass2.md`)
2. Revert all Q2 merges → use `gemini.pricing-baseline-2026-04-30.md` (original pre-merge)
3. Revert specific lines → cherry-pick from either file

---

## Current state (lines 98–128, post-Q2 first pass, pre-second pass)

```
      Fast fashion, Shein/H&M/Forever 21: $5–$25 (basic Shein tees commodity-priced $3–$8 used-good); Zara skews higher, especially dresses: $10–$50, NWT midi/maxi/satin slip $30–$85. Do NOT lump Zara dresses in with Shein.
      Mall brands, Gap/Old Navy: $8–$18; J.Crew/Banana Republic/Abercrombie: $14–$30; Madewell (premium within tier, wide-leg/flare jeans $30–$60 used-good, NWT to $80; skinny softening $6–$14)
      Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): standard tees/hoodies/joggers $8–$55; Nike Phoenix Fleece oversized hoodie premium sub-tier $60–$90; Adidas Samba XLG $31–$65. CARHARTT WOMEN'S WJ130/WJ141 JACKET CALLOUT, when the jacket is in a rare color (pink, purple, teal, cream, coral, NOT brown/black/khaki/tan) it commands $100–$350, far above the standard $25–$80 range. Identify by the chest pocket and quilted lining. Standard brown/black/khaki Carhartt stays in the regular range.
      Sneakers (factory, not custom-painted), Generic athletic (standard Nike, Adidas, Vans, Converse): $20–$60; Premium athletic (Nike Air Max, Adidas Samba/Gazelle, NB 990/2002R/9060): $30–$80; Hyped silhouettes (Jordan 1 Low women's $40–$97, Jordan 1 High $120–$250, Dunk Low Panda $35–$70, Yeezy 350/700 $80–$200); Designer/collab (Travis Scott Jordan 1 Low $250–$400, NB 2002R Salehe Bembury $108–$253, Margiela/Balenciaga sneakers $250+). For custom-painted/altered sneakers see ALTERED FACTORY BASE EXCEPTION.
      Contemporary, Aritzia/Wilfred Free: $8–$40; Free People: $14–$85 used-good, NWT to $110 (boho/embroidered/linen/floral actively spiking spring 2026); Anthropologie: $20–$115; Patagonia (outerwear-focused, Nano Puff $87–$138, Down Sweater $100–$155, Synchilla fleece $45–$75; vintage Gore-Tex $70–$300); Reformation (commands retail premium): $80–$195. Arc'teryx and North Face price 2–4x over comparable contemporary outerwear: Arc'teryx fleece/soft-shell used-good $89–$200, NWT $300–$450; North Face shell/puffer $35–$150 standard.
      Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince, Polo Ralph Lauren): Coach pre-owned bags $17–$200, Coach NWT current-season Willow/Maggie $105–$385; Kate Spade $25–$120; Tory Burch $30–$150; vintage Coach signature pre-owned $25–$160; Polo Ralph Lauren tops/sweaters $15–$65
      Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada, Saint Laurent, Balenciaga), model-dependent, wide spread: LV monogram pre-owned $100–$1700+; LV Neverfull MM $300–$850; LV Speedy 25 bandoulière $500–$1200; LV crossbody/small (Pochette, Saumur) $100–$350; Gucci GG canvas bag $100–$400. Chanel/Hermès authenticated bags start $1000+. NWT/like-new commands top of range; verified-authentic listings (with cards/dust-bags) command 20–40% over otherwise-equivalent.
      Mass-market denim (Levi's 501/550/514/Wedgie, Wrangler, Lee, Old Navy, Gap denim): $15–$35
      Premium denim (7 For All Mankind, Citizens of Humanity, AG, Paige, Frame, Joe's, Mother), CUT MATTERS A LOT: skinny is FALLING ($3–$25 used-good, $14 median, soft); wide-leg / flare / bootcut / Dojo are SPIKING ($30–$70 used-good, NWT to $100). Mother and Citizens skew +20–30% above 7FAM within tier. NWT premium denim wide-leg can reach $100. When you see flare/wide-leg cut, price at the upper band.
      Authenticated Y2K premium denim (True Religion big-stitch, Diesel, Rock Revival, Miss Me, Buckle, Affliction, check stitching and hardware): standard styles $9–$50; OG LOW-RISE FLARE WITH RHINESTONE / EMBELLISHMENT IS ACTIVELY SPIKING (Q2 2026): True Religion OG flare $35–$95; Diesel flare/wide-leg vintage $45–$120 (+45–58% in 30 days); Rock Revival / Miss Me embellished $20–$65 (+27%). When the item shows visible rhinestones, embellished back pockets, low-rise flare, or factory whiskering, price at the spike band, not the standard band.
      Y2K viral brands (Juicy Couture, Von Dutch, Ed Hardy, Baby Phat, Apple Bottoms, visible logos required, do NOT infer from silhouette): Juicy Couture velour tracksuit set NWT $55–$130, vintage Y2K USA-made set $100–$200 (+22% spike), Juicy terry tracksuit OG 2000s cotton $100–$165; Von Dutch trucker hat $20–$65; Ed Hardy graphic tee $25–$95; Baby Phat jacket/top $30–$120. These have real resale value now, Q2 2026 active spike reinforced by Euphoria S3 demand. Do NOT confuse with the COMMON HALLUCINATION TRAPS list, that warns against inferring these brands from look-alike silhouettes; this tier applies only when you can read an actual logo.
      Vintage Levi's tiered: Big E / 501XX / pre-1980s redline raw selvedge: $300–$590 (top of vintage market); LVC Big E selvedge reproduction (501/505/701): $42–$100; Premium Big E 90s–00s 501s: $25–$100; Standard post-Big-E vintage 501s/505s/550s button-fly: $19–$65; Vintage 70505 trucker jacket: $35–$120. Vintage Wrangler Blue Bell: $60–$250+.
      Luxury denim (Acne Studios, Balenciaga, Gucci, Balmain, Saint Laurent, R13): $80–$400+
      Unbranded or generic jeans: $12–$28
      Vintage (20+ years, good condition): add 30–60% over what comparable modern items sell for
      Unknown/unbranded: price by material quality, construction, and visual appeal, $10–$30
      Costume/fashion jewelry (no precious metal or stones, unbranded): $5–$20
      Sterling silver jewelry (925 stamp, with semi-precious stones, amethyst, turquoise, garnet, opal, citrine): $15–$60
      Gold-filled or gold-plated jewelry (vermeil, GF stamp): $20–$65
      Solid gold jewelry (10k/14k/18k/24k, price by karat and weight; heavier = higher): $40–$200+
      Fine jewelry with diamonds (solitaire, halo, pavé, evaluate visible size, cut, setting quality): $80–$500+
      Fine jewelry with precious gemstones (ruby, sapphire, emerald, evaluate color saturation, size, setting): $60–$400+
      Platinum jewelry: add 30–50% over equivalent gold piece
      Designer jewelry houses (Tiffany, Cartier, Van Cleef & Arpels, David Yurman, Bulgari, Harry Winston): $100–$2000+
      Accessible designer jewelry (Pandora, Kendra Scott, Lagos, John Hardy, James Avery): $25–$120
      Estate/antique jewelry (Art Deco, Victorian, Edwardian, signed vintage): add 40–80% over base material value
      Celebrity-associated or trending designer collabs: add 20–50% trend premium
      Gemstone/crystal-embellished clothing (Swarovski crystals, rhinestone detailing, beaded gowns, crystal appliqués, gem-studded denim): price using the garment's brand tier as base, then add 30–60% for embellishment quality and density. Intact, densely-set crystals on designer pieces command top premiums. Missing stones or loose settings reduce value.
    Platform context: Depop runs higher for Y2K, vintage, trendy aesthetics, and unique pieces; Poshmark higher for workwear, contemporary brands, and NWT items; eBay for sportswear, collectibles, authenticated luxury, and fine jewelry (especially with GIA certs or brand boxes); Etsy for handmade, vintage 20yr+, cottagecore/artisan aesthetics, and estate jewelry.
    Trend premiums (+20–40% to base): gorpcore/outdoor, quiet luxury, coquette, vintage collegiate, 90s minimalism, western/Americana, mesh/sheer, ballet/balletcore. Apply when the item clearly fits.
    Q2 2026 ACTIVE SPIKES (refresh this list quarterly, current as of 2026-04-30): crochet tops & matching sets, cargo pants, boho/romantic dresses, spring knits, polka dots, surf-aesthetic, peeptoe heels, wedding-guest dresses. Y2K maximalist demand is reinforced by the Euphoria Season 3 × Depop collab, keep Y2K aesthetic premium active. Apply +30–50% over base when an item clearly fits one of these spikes.
```

---

## What's changing in the second pass

1. **NEW Vintage non-denim Americana tier**, Pendleton, Filson, LL Bean, Eddie Bauer, Woolrich
2. **NEW Knit sets / loungewear tier**, mall vs contemporary sub-tiers
3. **NEW Boots tier**, Combat / Vintage western / Knee-high heeled sub-types
4. **NEW Hats tier**, Vintage trucker / Branded dad cap / Beanie sub-types
5. **Mountain Hardwear / Marmot** appended to Contemporary line as budget gorpcore floor
6. **Sterling silver jewelry** refined, sub-tiers for plain ring / maker-signed necklace / earrings
