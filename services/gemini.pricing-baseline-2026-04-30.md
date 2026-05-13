# Pricing Tier Baseline, Pre-Q2 2026 Refresh

**Created:** 2026-04-30
**Purpose:** Rollback snapshot of `services/gemini.ts` factory pricing tier block before merging Q2 2026 sold-price research data.

**To roll back:** Copy the block below verbatim back into `services/gemini.ts`, replacing the corresponding lines (currently 95–127). The surrounding context (`► IF isCustom = false`, `Platform context:`, `Trend premiums:`, `suggestedResaleHigh:`) is unchanged by the refresh.

---

## Original block (lines 95–127, pre-refresh)

```
  ► IF isCustom = false → FACTORY ITEM PRICING (use this path; ignore handmade section above):
    suggestedPaid: typical thrift store shelf price ($3–$30). For jewelry: thrift stores often underprice precious metals/stones, if gold, gemstones, or designer marks are visible, suggestedPaid can be $5–$100+.
    suggestedResaleLow: realistic sold-price floor. Use these brand-tier benchmarks:
      Fast fashion (Shein, H&M, Zara, Forever 21): $10–$20
      Mall brands (Gap, J.Crew, Banana Republic, Abercrombie, Madewell): $18–$40
      Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): $25–$65
      Contemporary (Free People, Anthropologie, Reformation, Patagonia, Aritzia): $35–$90
      Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince): $45–$130
      Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada): $80–$500+
      Mass-market denim (Levi's 501/550/514/Wedgie, Wrangler, Lee, Old Navy, Gap denim): $15–$35
      Premium denim (7 For All Mankind, Citizens of Humanity, AG, Paige, Frame, Joe's, brand peaked ~2015, price conservatively): $25–$55
      Authenticated Y2K premium denim (True Religion big-stitch, Diesel, Rock Revival, Miss Me, check stitching and hardware): $35–$90
      Vintage Levi's Big E / 501XX / pre-1980s redline selvedge / vintage Wrangler Blue Bell: $60–$250+
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
```

---

## What's changing (high-impact only)

1. **Fast fashion** split, Zara separates from Shein/H&M/F21
2. **Mall** brand-within-tier deltas, Madewell premium
3. **Athletic/streetwear**, Carhartt rare-color WJ-series callout, Nike Phoenix Fleece sub-tier
4. **Contemporary** split by brand, Aritzia / Free People / Anthropologie / Patagonia / Reformation each get explicit ranges
5. **Premium denim**, cut differentiation (skinny falling, flare/wide-leg spiking)
6. **Y2K premium denim**, embellished/OG flare spike callout
7. **NEW: Y2K viral brand tier**, Juicy Couture, Von Dutch, Ed Hardy, Baby Phat (currently only treated as hallucination warning, no pricing)
8. **Vintage Levi's**, Big E selvedge raw bumped to $300–$590, LVC repro sub-tier added

Out of scope this pass (deferred to second pass per plan): gorpcore tier split (would touch outerwear category logic), exceptional-handmade range refinement (insufficient verified sold data per research).
