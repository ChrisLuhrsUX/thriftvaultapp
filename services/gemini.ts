import * as FileSystem from 'expo-file-system/legacy';
import { ITEM_CATEGORIES, type ItemCategory, type ScanScenario } from '@/types/inventory';
import { formatMoney, roundDisplayPrice } from '@/utils/currency';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash-lite';
const geminiUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
const GEMINI_URL = geminiUrl(GEMINI_MODEL);
const GEMINI_URL_FALLBACK = geminiUrl(GEMINI_MODEL_FALLBACK);
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5';

const VALID_CATEGORIES: ItemCategory[] = ITEM_CATEGORIES;

const CUSTOM_KEYWORDS = /\b(crochet|crocheted|hand[\s-]?knit|handknit|hand[\s-]?made|handmade|hand[\s-]?crafted|handcrafted|hand[\s-]?sewn|handsewn|hand[\s-]?painted|hand[\s-]?tooled|hand[\s-]?stamped|hand[\s-]?stitched|hand[\s-]?woven|handwoven|hand[\s-]?dyed|macram[eé]|sashiko|visible mending|needle[\s-]?felt|punch[\s-]?needle|latch[\s-]?hook|tufted|tufting|quilted|patchwork|upcycled|reworked|repurposed|one[\s-]?of[\s-]?a[\s-]?kind|ooak|diy|wire[\s-]?wrap|resin[\s-]?cast|polymer[\s-]?clay|block[\s-]?print|lino[\s-]?print|pyrography|wood[\s-]?burn|leather[\s-]?burn|hand[\s-]?embroidered|custom[\s-]?painted|custom[\s-]?dyed|lace[\s-]?knit|granny[\s-]?square|amigurumi|friendship[\s-]?bracelet)\b/i;

const BOOST_BUCKETS: Array<{ key: string; rx: RegExp }> = [
  { key: 'era', rx: /\b(y2k|2000s|2k|vintage|retro|90s|nineties|80s|eighties|70s|seventies|60s|sixties|deadstock|og)\b/i },
  { key: 'embellishment', rx: /\b(rhinestone|crystal|swarovski|gem(stone)?|bead(ed|ing)?|sequin|jewel(ed|led)?|embellish(ed|ment)?|stud(ded)?|appliqu[eé]|bedazzl(ed|ing))\b/i },
  { key: 'trend', rx: /\b(trending|spike|spiking|coquette|gorpcore|balletcore|cottagecore|cargo|boho|romantic|polka|peeptoe|surf|wedding[\s-]?guest|quiet[\s-]?luxury|collegiate|mesh|sheer)\b/i },
  { key: 'collab', rx: /\b(collab(oration)?|x\s+[A-Z]|travis|virgil|off[\s-]?white|fragment|union|dior\s+jordan|sacai|cact[uú]s\s+jack|signed|named\s+artist|artist[\s-]?collab|celebrity)\b/i },
  { key: 'denim_spike', rx: /\b(low[\s-]?rise|flare|wide[\s-]?leg|bootcut|whisker(ed|ing)?|big[\s-]?stitch|true\s+religion|diesel|rock\s+revival|miss\s+me|buckle|affliction)\b/i },
];

const LUXURY_EXEMPT_RX = /\b(louis\s+vuitton|lv\b|chanel|herm[eè]s|gucci|prada|dior|burberry|fendi|balenciaga|saint\s+laurent|ysl|celine|bottega|loewe|valentino|givenchy|alexander\s+mcqueen|acne\s+studios|balmain|r13|maison\s+margiela|margiela|off[\s-]?white|travis\s+scott|virgil|fragment|cact[uú]s\s+jack|union\s+la|sacai|big\s*e\b|501xx|redline|selvedge|lvc|tiffany|cartier|van\s+cleef|harry\s+winston|bulgari|david\s+yurman|john\s+hardy|juicy\s+couture|von\s+dutch|ed\s+hardy|baby\s+phat|apple\s+bottoms|nwt)\b/i;

// Jewelry detection + hallmark gates — keyword-routed, mirrors skirts/shorts/swimwear pattern.
const JEWELRY_RX = /\b(rings?|necklaces?|pendants?|chains?|earrings?|bracelets?|bangles?|cuffs?|brooches?|brooch|charms?|lockets?|chokers?|anklets?|watches?|watch|jewelry|jewellery)\b/i;
// Hard hallmark stamps that justify a metal-specific tier. "GP" / "GF" / "PLAT" need word
// boundaries to avoid bleeding into surrounding words. "Pin" intentionally NOT in JEWELRY_RX
// (too noisy — matches "safety pin" decorations on clothing).
const HALLMARK_RX = /\b(925|ster(ling)?|800|1\/20\s?gf|gf|gp|rgp|vermeil|10k|14k|18k|22k|24k|375|585|750|916|999|platinum|plat|950)\b/i;
const DESIGNER_JEWELRY_RX = /\b(tiffany|cartier|van\s+cleef|vca|bulgari|bvlgari|harry\s+winston|mikimoto|buccellati|boucheron|chopard|david\s+yurman|john\s+hardy|james\s+avery|kendra\s+scott|pandora|mejuri|catbird|maria\s+tash|aurate|brilliant\s+earth)\b/i;
// Signed vintage costume jewelry brands — separate tier ($20–$120 per prompt) from
// fine-jewelry designers above. Without this list, correctly-named "Trifari brooch"
// falls through to the no-hallmark $30 cap.
const SIGNED_COSTUME_RX = /\b(trifari|coro|weiss|haskell|eisenberg|hob[eé]|whiting\s*&?\s*davis|sarah\s+coventry|monet|napier|boucher|hattie\s+carnegie|kenneth\s+jay\s+lane|jelly\s+belly)\b/i;
// Stamp/signature evidence that the designer brand is actually present on the piece.
const DESIGNER_STAMP_RX = /\b(t&co|©\s?tiffany|tiffany\s*&\s*co|cartier\s+signature|ale\s+925|\bale\b|\bdy\b|\bjh\b|vca\s+\w+|bvlgari\s+stamp|hallmark|maker'?s?\s+mark|stamp(ed)?|signed|signature|engraved|serial)\b/i;
const WATCH_LUXURY_RX = /\b(rolex|omega|patek|audemars|piguet|\bap\b|cartier|vacheron|jaeger|jlc|breitling|iwc|panerai|hublot|richard\s+mille|tudor)\b/i;

// MCM designer brands. Authentic Saarinen Tulip / Knoll / Eames pieces use laminate as
// original construction — bypass particleboard clamp when these names appear.
const MCM_BRAND_RX = /\b(eames|knoll|herman\s+miller|wegner|saarinen|cassina|vitra|nakashima|jacobsen|breuer|le\s+corbusier|mies\s+van\s+der\s+rohe|nelson|florence\s+knoll|b&b\s+italia|poltrona\s+frau|minotti)\b/i;

// Bag and sneaker authentication gates — same shape as the jewelry hallmark gate.
const LUXURY_BAG_BRAND_RX = /\b(louis\s+vuitton|\blv\b|chanel|herm[eè]s|gucci|prada|dior|fendi|goyard|balenciaga|saint\s+laurent|ysl|celine|bottega|loewe|valentino|givenchy|burberry)\b/i;
const BAG_AUTH_STAMP_RX = /\b(date\s+code|heat[\s-]?stamp|blind\s+stamp|serial(\s+(number|sticker))?|creed(\s+patch)?|authentication\s+card|stitch\s+count|interior\s+stamp|made\s+in\s+(italy|france|spain)|hallmark|maker'?s?\s+mark|stamp(ed)?|signed|signature|engraved|plaque|leather\s+tab)\b/i;
const SNEAKER_COLLAB_RX = /\b(travis\s+scott|off[\s-]?white|fragment|sacai|union\s+la|cact[uú]s\s+jack|salehe\s+bembury|comme\s+des\s+gar[cç]ons|cdg|virgil|jordan\s+x|dunk\s+x)\b/i;
const SNEAKER_AUTH_RX = /\b(sku|tongue\s+tag|box\s+label|inner\s+label|insole\s+(tag|branding)|stockx|goat|deadstock|legit\s+check|serial|cactus\s+jack\s+laces|reverse\s+swoosh\s+stitched)\b/i;

function detectCustomFromText(...fields: unknown[]): boolean {
  return fields.some((f) => typeof f === 'string' && CUSTOM_KEYWORDS.test(f));
}

// Wide price ranges = sparse comps. Downgrade only — never upgrade.
// 3.0× ratio is normal for a single tier; >3× starts to lie about confidence.
function confidenceFromRangeWidth(
  aiConfidence: 'high' | 'medium' | 'low',
  low: number,
  high: number,
): 'high' | 'medium' | 'low' {
  if (low <= 0 || high <= 0) return aiConfidence;
  const ratio = high / low;
  if (ratio > 4) return 'low';
  if (ratio > 3) return aiConfidence === 'high' ? 'medium' : aiConfidence;
  return aiConfidence;
}

/** Gemini 2.5 thinking can consume most of a small output budget; JSON never arrives. */
const MAX_OUTPUT_TOKENS = 16384;

const PROMPT = `You are an expert thrift reseller. Analyze this photo of a thrift store item.

Return ONLY a valid JSON object with this exact structure — no markdown fences, no explanation:
{
  "name": "Descriptive item name; prepend brand ONLY if a label/logo/tag is visibly readable in the photo",
  "sub": "Brief description: estimated size if visible (e.g. \"Women's 8\", \"Men's L\", \"US 10\"), color, material, condition. Omit any field that can't be determined from the photo — never echo the field name as a placeholder.",
  "category": "denim|bottoms|tops|dresses|outerwear|shoes|bags|accessories|furniture|other",
  "isCustom": <boolean>,
  "suggestedPaid": <number>,
  "suggestedResaleLow": <number>,
  "suggestedResaleHigh": <number>,
  "confidence": "high|medium|low",
  "ideas": [
    {"t": "Listing/pricing suggestion", "ideaIcon": "pricetag"},
    {"t": "Photography or styling tip", "ideaIcon": "camera"},
    {"t": "Bundle or upsell idea (if item is already a bundle, suggest how to split or market it instead — never say 'not applicable')", "ideaIcon": "flame"}
  ],
  "upcycle": [
    "First distinct upcycle idea (technique + aesthetic)",
    "Second distinct upcycle idea using a different technique",
    "Third distinct upcycle idea using a different technique"
  ],
  "authFlags": ["Specific physical check to verify authenticity (only for items prone to counterfeiting)"],
  "redFlags": ["Prominent warning about AI-generated prints or other red flags — see RED FLAG DETECTION rule"],
  "beforeAfterDetected": <boolean — only relevant on multi-photo scans; see PHOTO INTERPRETATION rule. Default false on single-photo scans.>
}

CRITICAL — isCustom detection (evaluate FIRST before anything else):
Carefully examine the item for ANY sign it was handmade, modified, reworked, or upcycled. This is one of the most important fields — getting it wrong means the user misprices the item. When in doubt, set isCustom = true. Missing a handmade item is far worse than over-flagging.
Set isCustom = true if you see ONE OR MORE of:
  • Structural rework: raw/unfinished cut edges, cropped hems, tapering, deconstruction/reconstruction, two garments combined (franken-pieces), asymmetric cuts, non-original seams, altered silhouette that doesn't match the original design
  • Mismatched or repurposed materials: different fabric panels sewn together, non-original lining, repurposed textiles (curtain/blanket/tablecloth/quilt fabric turned into garment), denim patchwork from mixed washes, bandana fabric reworked
  • Hand-applied elements: fabric paint, puff paint, rhinestones, studs, patches (sewn or ironed), safety pins as decoration, beadwork, decorative buttons
  • Hand dye work: irregular tie-dye (uneven saturation, wobbly spirals), bleach splatter/patterns, custom overdyeing, ombre dip-dye
  • Surface decoration: hand-painted designs, DIY screen prints (slightly uneven), hand embroidery (irregular stitches vs machine-perfect), marker/pen artwork, block/lino prints
  • Distressing: hand-distressed holes/fraying at irregular placement (not factory-uniform), hand-sanded areas
  • Fiber arts (ALWAYS true): crochet, hand-knit, macrame, weaving, punch needle, tufting, latch hook
  • Visible mending/sashiko (ALWAYS true): contrasting-thread running stitches, decorative darning, patchwork repairs as design
  • Leather/shoe customization: hand-tooled, pyrography, hand-stitched (angled saddle stitch), hand-painted sneakers, custom-dyed leather/suede, spike/stud additions
  • Handmade jewelry: wire-wrapped, resin, polymer clay, hand-stamped metal, spoon/fork rings, friendship bracelets, beaded straps
  • Key visual tells for clothing upcycles: seams that don't match (different thread color/weight), hems at unexpected lengths, hardware that doesn't match the garment era/brand, fabric grain running in different directions on the same panel, waistbands added or removed, collars reshaped, sleeves that don't match the body
Set isCustom = false ONLY when you are confident the item is entirely factory-made: factory distressing (uniform across units), mass-produced tie-dye (consistent patterns), standard brand embroidery, machine-knit with uniform tension and factory tags, mass-produced jewelry with brand stamps

Guidelines:
- category: use "bottoms" for pants, leggings, joggers, athletic bottoms, shorts (non-denim); "denim" for jeans; "outerwear" for jackets and coats; "tops" for shirts, sweatshirts worn as tops, hoodies when not outerwear
- category "furniture": use for any furniture, lighting, mirror, rug, or large home good — chairs, sofas/sectionals/loveseats, dining/coffee/side/console tables, desks, dressers/cabinets/bookshelves/nightstands/sideboards/credenzas/armoires, bed frames/headboards, lamps/sconces/chandeliers, mirrors, rugs, vases/sculptures/wall art, outdoor patio furniture. In the "name" field include the specific subtype (e.g. "Vintage Walnut Credenza", "MCM-Style Dining Chair", "Vintage Brass Floor Lamp", "Persian Wool Rug").
- BRAND IN NAME — HARD RULE: Only include a brand word in "name" if you can see an actual LOGO, WORDMARK, PRINTED TAG, EMBROIDERED LABEL, WOVEN LABEL, or STAMPED HARDWARE bearing that brand's text or recognized logomark, and it is legible enough to read. You must be able to point to the specific region of the photo where the brand marking appears. DO NOT infer brand from silhouette, cut, aesthetic, era, embellishment pattern, stitching style, fabric weight, hardware style, or resemblance to brands known for a similar look. Inference from aesthetic is a guess, not identification.
- JEWELRY HALLMARK — HARD RULE: Yellow-tone metal is NOT gold. Silver-tone metal is NOT sterling. Clear sparkly stones are NOT diamonds. To price a jewelry piece at a metal-specific tier (sterling, gold-filled, vermeil, solid gold, platinum), you MUST be able to see a readable hallmark stamp in the photo:
  • Silver: 925 / STER / STERLING / 800
  • Gold-filled or plated: 1/20 GF / GF / GP / RGP / vermeil / 925 with gold tone (vermeil = sterling base + gold layer)
  • Solid gold by karat: 10k / 14k / 18k / 22k / 24k / 375 / 585 / 750 / 916 / 999
  • Platinum: PLAT / 950 / 900
  Hallmarks live INSIDE ring bands, on necklace clasps and chain end-links, on earring posts and butterfly backs, on brooch and pin backs, and inside watch case-backs. When the photo doesn't show these surfaces, you cannot confirm metal — default to "yellow-tone metal" or "silver-tone metal" in the "name" field and price at the costume tier ($5–$20). Patina pattern is a SUPPORTING signal, not identification: brass turns greenish at touch points, gold-plated/vermeil wears through to silver/copper underneath at high-touch areas, sterling darkens and oxidizes (warm grey/black tarnish), stainless stays bright. Stamp absence = costume tier even when the piece looks high-quality. The same logic applies to designer maker stamps (T&Co, Cartier signature, ALE, DY, VCA): silhouette is NOT identification — see COMMON HALLUCINATION TRAPS for the specific patterns to watch for.
- BAG AUTHENTICATION — HARD RULE: To assert a luxury or designer bag brand in "name" or to price at the luxury tier ($500+), the photo MUST show specific authentication evidence:
  • Louis Vuitton: a date code stamped inside (FL/SD/CT/MI/SP + 4 digits in pre-2021 bags) OR the heat-stamped logo plate inside; on genuine pieces the monogram pattern flows continuously and never has cut letters at panel joins (cheap fakes show cut Ls/Vs at seams).
  • Chanel: serial sticker (8-digit, post-1984) inside flap pocket OR authentication card; quilting forms perfect interlocking diamonds with single-piece leather panels.
  • Hermès: blind stamp on inside near strap base (year letter inside box/circle/square + craftsman code); Birkin/Kelly require white saddle stitching with even, hand-pulled stitch count.
  • Goyard: hand-painted chevron pattern with subtle natural variation (dropship fakes are uniformly printed); "MAISON GOYARD" stamp on interior leather tab.
  • Coach: creed patch inside with a clean serial number engraved (vintage) or "COACH" + creed serial (modern); leather hangtag with "COACH" embossed.
  • Gucci: GG monogram alignment continuous at seams; "Made in Italy" interior stamp + serial dust-card; double-G logo plates have crisp engraving.
  • Prada: triangle-shaped metal logo plate with "PRADA Milano DAL 1913"; nylon "Vela" bags have engraved-zipper signature.
  • Dior: "Christian Dior PARIS Made in Italy" interior leather plaque, heat-stamped.
  Without this evidence, do NOT use the brand word in "name". Describe by silhouette/material instead ("Brown Monogram Canvas Tote", "Black Quilted Leather Flap Bag", "Tan Painted Chevron Tote"). Price at the unbranded designer-style tier ($60–$200), NOT the luxury tier. Box, dust-bag, or authenticity card alone is NOT proof — those are sold separately on resale.
- SNEAKER AUTHENTICATION — HARD RULE: For BASE hyped silhouettes (Jordan 1 / 4 / 11, Nike Dunk Low/High, Yeezy 350 / 700, NB 990 / 2002R / 550) the side-photo silhouette is sufficient to use the brand word in "name" — these are widely recognizable and the existing tier ranges absorb legitimate spread. For COLLAB claims (Travis Scott, Off-White, Fragment, Sacai, Union LA, Cactus Jack, Salehe Bembury, Comme des Garçons) you MUST see specific evidence:
  • SKU code on inner tongue tag (e.g. "555088-XXX" for Jordan 1, "DD1391-XXX" for Dunk Panda)
  • Box label with matching SKU + colorway name
  • Insole branding ("AIR JORDAN", "Nike Air", "Yeezy", or co-brand signature)
  • StockX / GOAT verification tag if pre-authenticated
  Specific collab tells: Travis Scott Jordan 1 has reverse mini-swoosh with Cactus Jack-branded shoelace bag; Off-White has signature zip-tie + quotation marks ("AIR", "FOR NIKE"); Fragment has lightning-bolt insole; Sacai has dual-tongue, dual-swoosh stacking.
  Without collab-specific evidence, do NOT use the collab name in "name" — describe as the base silhouette only ("Black/White Jordan 1 High", "Panda Dunk Low") and price at the base hyped tier, NOT the collab tier. Reverse-swoosh styling alone is the most replicated detail in sneaker fakes.
- COMMON HALLUCINATION TRAPS — do NOT assume these brands without a visible label:
  • Y2K low-rise flare jeans with rhinestone swirls, butterflies, crosses, or decorative back-pocket embellishments → NOT Vigoss, Miss Me, Rock Revival, Affliction, True Religion, Buckle, Silver Jeans, Grace in LA, or any "fashion denim" brand
  • Chunky white or beige sneakers → NOT Nike, Adidas, New Balance, Asics, Hoka, On Cloud
  • Brown/tan workwear jackets or double-knee pants → NOT Carhartt, Dickies, Wrangler, Duluth
  • Plain ringer tees, baby tees, or graphic tees → NOT Urban Outfitters, Brandy Melville, Abercrombie, Aeropostale
  • Tan trench coats → NOT Burberry
  • Flannel shirts → NOT Pendleton, LL Bean, Eddie Bauer
  • Gorpcore fleece or shell jackets → NOT Patagonia, Arc'teryx, North Face, Columbia
  • Square-toe knee-high boots → NOT Frye, Steve Madden, Jeffrey Campbell
  • JEWELRY look-alikes — these are heavily counterfeited and frequently misidentified by silhouette alone:
    – Heart pendants, "T" motifs, blue boxes, beaded chains → NOT Tiffany without "T&Co", "©Tiffany & Co.", or "Please Return to Tiffany & Co." stamp
    – Thin gold cuff with screws or nail-shaped bangles → NOT Cartier Love or Juste un Clou without Cartier signature + serial number engraved
    – Charm bracelets with snap clasps and threaded charms → NOT Pandora without "ALE 925" or "ALE" stamp on the inner ring
    – Cable-twist rings, cuffs, and bracelets → NOT David Yurman without "DY" stamp
    – Four-leaf clover motif (mother-of-pearl, malachite, onyx, carnelian) → NOT Van Cleef & Arpels without "VCA" stamp + serial
    – Roman numeral, B.zero1, or Serpenti patterns → NOT Bulgari without "BVLGARI" stamp
    – Cable-link necklace with toggle clasp or dragon-scale detail → NOT John Hardy without "JH" stamp
    – Yellow metal of any tone → NOT gold without a karat stamp visible
    – Silver-tone metal → NOT sterling without a 925 / STER / STERLING stamp visible
    – Clear sparkly stones → NOT diamond without grading cert visible OR set in stamped 14k+ gold/platinum prongs
    – Pearl-look beads → photo alone cannot confirm real pearls; default cultured-freshwater tier with confidence: low
  • BAG look-alikes — luxury and designer bags are the most-counterfeited category on resale:
    – Brown LV-monogram canvas pattern → NOT Louis Vuitton without date code OR heat-stamp interior plate visible
    – Quilted leather chain bag (CC interlocking quilt diamond) → NOT Chanel without serial sticker visible
    – Trapezoid top-handle with padlock (Birkin) or rectangular with sangles (Kelly) → NOT Hermès without blind stamp visible
    – Brown C-monogram canvas → NOT Coach without creed patch + serial visible
    – Hand-painted chevron Y/V pattern → NOT Goyard without "MAISON GOYARD" stamp visible
    – Black nylon with triangle metal plate → NOT Prada without "PRADA Milano DAL 1913" + interior serial card
    – GG / FF / DD repeating logo canvas → NOT Gucci / Fendi / Dior respectively without authenticated stamp + serial
    – Cabas-style double-handle tote with red-painted edges → NOT Saint Laurent / Celine luggage without heat-stamp visible
  • SNEAKER COLLAB look-alikes — collab tier prices 2-3x over base hyped, hallucination is expensive:
    – Reverse mini-swoosh on Jordan 1 → NOT Travis Scott without Cactus Jack-branded laces / SKU label
    – Zip-tie or quotation-mark detailing → NOT Off-White without "for Nike" insole branding
    – Lightning-bolt accent → NOT Fragment without Hiroshi Fujiwara double-bolt insole
    – Dual-tongue / stacked-swoosh sneaker → NOT Sacai without Sacai/Nike co-brand insole
    – Reggae or rasta colorway 990 → NOT Salehe Bembury without "Salehe Bembury" tongue tag
  • VINTAGE GRAPHIC TEE look-alikes — modern repros mimic vintage tells. Require at least 3 of 4 together: single-stitch hem, blank or USA-made tag, no side seams (tubular), soft cracked print:
    – Modern band tee (Metallica, Nirvana, AC/DC, Pink Floyd) with side seams + double-stitched hems → NOT vintage tier; this is a modern repro at $15–$35
    – Modern Disney character tee (side seams, current Hanes/Gildan tag) → NOT vintage Disney tier; this is a current-production tee $8–$20
    – "Vintage-style" distressed graphic tee from Brandy Melville / Urban Outfitters / Forever 21 → NOT actual vintage; tag will read modern brand
  • SUNGLASSES look-alikes — designer eyewear is heavily counterfeited:
    – Black acetate Wayfarer-style frames → NOT Ray-Ban without "RB" lens etching + "Ray-Ban" temple text
    – Aviator metal frames → NOT Ray-Ban without "RB" lens etching + Ray-Ban hinge stamp
    – Sport wraparound frames → NOT Oakley without laser-etched "O" logo on lens + stamped Oakley on hinge
    – Round metal frames with logo → NOT Cartier / Versace / Gucci without temple etching + serial inside earpiece
    – Box, cleaning cloth, or branded case alone is NOT authentication — these are sold separately on resale
- When no brand marking is visible, name the item by its distinctive features — silhouette, wash or color, material, era, embellishment, or notable construction. Examples: "Y2K Rhinestone Flare Jeans", "Dark Wash Low Rise Swirl-Embellished Flares", "Chunky Cream Dad Sneakers", "Tan Canvas Double-Knee Work Pants". Never use the word "generic" in the name.
- For upcycled or handmade items: the base garment's brand does NOT transfer to the upcycled piece unless the base brand's label is still visibly intact on the garment. Describe the upcycle itself, not a guessed source brand.
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- PRICING — mentally benchmark against comparable recently-sold listings on Depop, Poshmark, eBay, and Etsy before setting any price. Do not default to the low end of a range — price for what the item actually sells for in current market.
  PRICING DECISION — check isCustom first, then follow exactly ONE path. Do not mix paths. Your price output is final — there is no second pass to correct it, so commit fully to whichever path applies.

  ► IF isCustom = true → HANDMADE PRICING (use this path; ignore all factory brand tiers below). Price by FINISHED LOOK that an unknown maker actually sells for on Depop/Etsy/Poshmark. Do NOT use a labor-hour formula — unknown makers cannot command labor-rate pricing in a saturated handmade market, and labor math consistently overshoots actual sold comps by 30–80%. Default assumption is unknown maker; named established Etsy/Depop creators with documented sale history may exceed unknown-maker ceilings only when the creator name is explicitly visible/known.
    FIRST-PASS ANCHORING — within any tier band you select, DEFAULT to the lower-middle of the band (band low + 30% of band width), NOT the upper edge. Unknown-maker handmade sold comps cluster at lower-middle of every band on Depop/Etsy. Reserve the upper third of a band only for items showing EXPLICIT upper-tier signals: named established creator visibly identified, NWT or original tags visible, documented vintage Big E/501XX base, exceptional construction keywords matched, or unmistakable mint condition. For ambiguous items, lower-middle IS the sold-comp median. Example: HANDMADE DRESS moderate band $50–$120 — default position $50–$85 (band low + 30% width), NOT $90–$120. The tier-band ceilings exist to cap inflated estimates, not to be the default landing point. The note on line 194 ("do not default to low end") applies to FACTORY items; for handmade, lower-middle IS the comp-aligned answer, not lowballing.
    CONDITION DEFAULT (handmade) — assume "used-good" when condition is not explicitly visible. Visual cleanness from camera distance is NOT "excellent" — most resale items photograph clean but have close-up pilling, fading, or thread wear. Reserve "excellent" or "NWT" pricing for visible original tags, factory creases, or unmistakable mint condition signals. When unsure, used-good is the safe assumption — overshooting condition is a top driver of first-pass overpricing.
    suggestedPaid: materials cost estimate ($10–$60).
    DEFAULT TIER LADDER (apply when no specific category exception below matches):
      Simple (small piece, basic execution, beginner-tier work, friendship-bracelet level): $15–$45
      Moderate (mid-size, refined execution, clear skill, on-trend aesthetic): $30–$80
      Complex (large, intricate technique, multi-stage construction): $60–$160
    Hard ceiling $160 for unknown makers via the default ladder. Named established creators may reach $300.
    DENIM EXCEPTION — if category = "denim": Upcycled jeans is saturated on Depop/Etsy and prices by finished look. Simple mods (crops, distress, basic patches, dye/bleach) $25–$55; moderate rework (panel swap, contrasting patchwork, decorative topstitching, studded) $45–$85; elaborate custom (intricate beading/embroidery, franken-construction, verifiable vintage Big E/501XX base, known creator) $70–$140. Hard ceiling: do not exceed $140 for upcycled denim unless the base is documented vintage Levi's Big E/501XX or the maker is a named established creator — in which case cap at $220. EXCEPTIONAL CONSTRUCTION OVERRIDE — rare case only: when denim is rebuilt into a new garment shape via woven/lattice patchwork, sculpted halter/corset/bustier, deconstructed couture-style assembly, or denim quilted into a wholly new silhouette, price $150–$300. To unlock this band you MUST include at least one of these exact words in the "sub" field so the band can be recognized: "lattice", "woven denim", "sculpted", "corset", "bustier", "halter", "deconstructed", "couture", or "quilted denim". Without exceptional construction stay under $140.
    ALTERED FACTORY BASE EXCEPTION — if the item is a factory-made base (sneaker, top, jacket, bag, cap) with hand-added surface decoration (paint, patches, studs, hand embroidery, hand-painted design, rhinestones) rather than from-scratch handmade construction: Price = base brand tier as starting point + 30–60% customization premium for detail and craftsmanship. Hard caps: painted or customized sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans, Converse) / $260 for hyped silhouettes (Jordan 1/4, Dunk, Yeezy) — exceed only if the artist is a named established creator with documented resale history. Altered tops (hoodies, tees, halter tops, tank tops, crop tops, blouses, camis) and jackets: $60 unbranded / $90 branded / $130 premium streetwear or designer base. Altered pants/trousers/joggers (NON-DENIM — for denim see DENIM EXCEPTION above): pants are a secondary canvas vs jackets and the resale ceiling is lower. Light paint/few patches $40–$70; skilled hand-painted or dense applique/embroidery $80–$140 unbranded / $100–$160 branded base; hard ceiling $180 unless the maker is a named established creator with documented resale history. Do NOT price altered pants in jacket tiers ($200+). Custom bags/caps: $40 unbranded / $80 branded. Altered dresses (NON-DENIM — for denim see DENIM EXCEPTION above): $40 to $200 ceiling, unless named established maker. Altered skirts (NON-DENIM — mini, midi, maxi): $30 to $140 ceiling. Altered shorts (NON-DENIM): $25 to $120 ceiling. Custom swimwear (swimsuit, bikini, one-piece, swimwear, trunks): $25 to $120 ceiling. Altered non-sneaker shoes (boots, heels, sandals, loafers): $40 to $200 ceiling. To unlock these bands you MUST include the relevant term ("skirt", "shorts", "bikini", "swim", "boots", "heels", "sandals", "loafers") in the "name" or "sub" field. This exception does NOT apply to genuinely from-scratch handmade items (crochet, knit, sewn from raw fabric, fiber art) — those use the from-scratch category exceptions below.
    HANDMADE OUTERWEAR EXCEPTION — handmade cardigans, dusters, knit/crochet jackets, hand-loomed coats, fiber-art outerwear (category = "outerwear" AND from-scratch handmade, not altered factory base): simple (basic granny-square cardigan, plain knit duster) $35–$80; moderate (intricate stitch pattern, mid-size, mosaic crochet, fitted construction) $55–$120; complex (multi-color tapestry crochet, hand-spun yarn, structured tailoring, large-format) $90–$180. Hard ceiling $180 unless named established maker.
    HANDMADE DRESS EXCEPTION — non-denim, non-altered handmade dresses (category = "dresses" AND from-scratch, not altered factory base): simple (plain crochet/knit slip, basic sewn shift) $30–$70; moderate (cottagecore midi, fitted construction, lace trim, bias-cut sewn) $50–$120; complex (full-skirt crochet maxi, multi-panel sewn gown, smocked or boned construction) $90–$200. Hard ceiling $200 unless named established maker.
    HANDMADE SKIRT EXCEPTION — non-denim, non-altered handmade skirts: simple $20–$50; moderate (granny-square midi, fitted maxi) $35–$85; complex (full-skirt crochet, multi-panel sewn) $65–$140. Hard ceiling $140 unless named established maker.
    HANDMADE BAG EXCEPTION — from-scratch handmade bags (crochet, macrame, woven, hand-loomed, hand-stitched leather): simple (crochet pouch, macrame mini bag, basic clutch) $20–$50; moderate (mid-size crochet tote, market bag, woven shoulder bag) $35–$85; complex (large hand-loomed leather, structured macrame, hand-stitched designer-grade) $60–$140. Hard ceiling $140 unless named established maker.
    HANDMADE ACCESSORY EXCEPTION (non-jewelry) — handmade scarves, hats, beanies, gloves, mittens, leg warmers, belts, hair accessories, headbands: simple (basic crochet beanie, plain scarf) $15–$40; moderate (intricate stitch, on-trend silhouette, fitted) $25–$70; complex (oversized hand-loomed, multi-color tapestry, named technique) $50–$120. Hard ceiling $120 unless named established maker.
    HANDMADE FIBER-ART STANDALONE EXCEPTION — tapestry, wall hanging, weaving, blanket, throw, quilt, wall art, embroidery hoop art, punch-needle art (not garment): small (under 18", embroidery hoop, small wall art) $25–$80; medium (24–36", lap blanket, mid-size tapestry) $60–$160; large (large tapestry, full quilt, oversized weaving, statement piece) $120–$300. Hard ceiling $300 unless named established fiber artist.
    HANDMADE TOP CEILING — for ANY isCustom = true item where category = "tops" (whether altered factory base OR from-scratch crochet/knit/sewn halter, tank, crop top, blouse, cami): hard ceiling $180 unless the maker is a named established creator with documented resale history. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). Exemption: denim-based handmade tops that meet the DENIM EXCEPTION exceptional-construction override (woven/lattice denim, sculpted halter/corset/bustier, deconstructed couture, quilted denim) follow that override's $300 ceiling, not this $180 cap. Routine denim halters/tops without exceptional construction stay under $180.
    HANDMADE SEWN-FABRIC TOP EXCEPTION — if the item is a from-scratch handmade or restructured top sewn or constructed from fabric (satin, silk, cotton, jersey, knit fabric, stretchy knit, ribbed knit, ponte, woven, polyester, rayon, viscose, chiffon, linen — NOT crochet, hand-knit, or knitwear): Sewn handmade tops on Depop/Etsy price by finished look. Tiers (calibrated to actual unknown-maker Depop sold comps): simple (basic tank, tee, cami, plain shape, basic crop, off-shoulder cut) $20–$45; moderate (fitted with detail — V-neck, ruching, lace trim, gathered waist, darts, dolman/wrap silhouettes, halter conversion from a tee) $30–$60; complex (tailored blouse, structured top, intricate seaming, French seams, boning, multi-panel construction) $50–$95. Hard ceiling $95 unless the maker is a named established creator with documented sales history. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). A tee restructured into a dolman/halter/ruched/draped silhouette belongs in the moderate band ($30–$60).
    NO TRENDING BOOST — do NOT apply any "+20–30% trending handmade", "uniqueness premium", or "+30% craftsmanship" markup. The tiers above are already calibrated for unknown-maker Depop sold comps. "Looks impressive", "took a long time to make", or "trending aesthetic" are NOT reasons to exceed the listed unknown-maker ceiling — buyers price on finished look + maker reputation, not perceived effort.

  ► IF isCustom = false → FACTORY ITEM PRICING (use this path; ignore handmade section above):
    suggestedPaid: typical thrift store shelf price ($3–$30). For jewelry: thrift stores often underprice precious metals/stones — if gold, gemstones, or designer marks are visible, suggestedPaid can be $5–$100+.
    suggestedResaleLow: realistic sold-price floor. Use these brand-tier benchmarks:
      Fast fashion — Shein/H&M/Forever 21: $5–$25 (basic Shein tees commodity-priced $3–$8 used-good); Zara skews higher, especially dresses: $10–$50, NWT midi/maxi/satin slip $30–$85. Do NOT lump Zara dresses in with Shein.
      Mall brands — Gap/Old Navy: $8–$18; J.Crew/Banana Republic/Abercrombie: $14–$30; Madewell (premium within tier — wide-leg/flare jeans $30–$60 used-good, NWT to $80; skinny softening $6–$14)
      Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): standard tees/hoodies/joggers $8–$55; Nike Phoenix Fleece oversized hoodie premium sub-tier $60–$90; Adidas Samba XLG $31–$65. CARHARTT WOMEN'S WJ130/WJ141 JACKET CALLOUT — when the jacket is in a rare color (pink, purple, teal, cream, coral — NOT brown/black/khaki/tan) it commands $100–$350, far above the standard $25–$80 range. Identify by the chest pocket and quilted lining. Standard brown/black/khaki Carhartt stays in the regular range.
      Lululemon (premium activewear, prices well above generic athletic — visible Lululemon logo, Reflective Triangle, or interior care tag required): Align leggings $30–$75 used-good, NWT $70–$100; Wunder Train / Fast & Free / Speed Up leggings $25–$60; Define jacket $50–$140 used, NWT $100–$185 (Lunar New Year and limited-edition colorways skew top of range); Scuba hoodie / Define hoodie $40–$95; Everywhere Belt Bag $25–$60 standard, $80–$150 limited/discontinued colors. Athleta and Alo Yoga track 30–40% below Lululemon comparables. Do NOT lump Lululemon in with generic athletic.
      Sneakers (factory, not custom-painted) — Generic athletic (standard Nike, Adidas, Vans, Converse): $20–$60; Premium athletic (Nike Air Max, Adidas Samba/Gazelle, NB 990/2002R/9060): $30–$80; Hyped silhouettes (Jordan 1 Low women's $40–$97, Jordan 1 High $120–$250, Dunk Low Panda $35–$70, Yeezy 350/700 $80–$200); Designer/collab (Travis Scott Jordan 1 Low $250–$400, NB 2002R Salehe Bembury $108–$253, Margiela/Balenciaga sneakers $250+). For custom-painted/altered sneakers see ALTERED FACTORY BASE EXCEPTION.
      Contemporary — Aritzia/Wilfred Free: $8–$40; Free People: $14–$85 used-good, NWT to $110 (boho/embroidered/linen/floral actively spiking spring 2026); Anthropologie: $20–$115; Patagonia (outerwear-focused — Nano Puff $87–$138, Down Sweater $100–$155, Synchilla fleece $45–$75; vintage Gore-Tex $70–$300); Reformation (commands retail premium): $80–$195. Arc'teryx and North Face price 2–4x over comparable contemporary outerwear: Arc'teryx fleece/soft-shell used-good $89–$200, NWT $300–$450; North Face shell/puffer $35–$150 standard. Mountain Hardwear and Marmot serve as the budget gorpcore floor: $25–$65 for fleece/jackets.
      Knit sets / matching lounge sets: mall-tier (Shein, Amazon-adjacent) $8–$25; contemporary-tier (Aritzia, Free People, etc.) $25–$85. For Juicy Couture velour sets, see the Y2K viral brands tier — they price separately and higher.
      Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince, Polo Ralph Lauren): Coach pre-owned bags $17–$200, Coach NWT current-season Willow/Maggie $105–$385; Kate Spade $25–$120; Tory Burch $30–$150; vintage Coach signature pre-owned $25–$160; Polo Ralph Lauren tops/sweaters $15–$65
      Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada, Saint Laurent, Balenciaga) — model-dependent, wide spread: LV monogram pre-owned $100–$1700+; LV Neverfull MM $300–$850; LV Speedy 25 bandoulière $500–$1200; LV crossbody/small (Pochette, Saumur) $100–$350; Gucci GG canvas bag $100–$400. Chanel/Hermès authenticated bags start $1000+. NWT/like-new commands top of range; verified-authentic listings (with cards/dust-bags) command 20–40% over otherwise-equivalent.
      Designer small leather goods (wallets, cardholders, belts, scarves) — separate from the bag tier above; SLGs price differently. Authentication HARD RULE applies — date code / heat stamp / serial required for the brand word in "name"; without it, default to "monogram canvas wallet" / "calfskin reversible belt" descriptor at $40–$150 unbranded-style tier. Brand-confirmed: LV wallets (Zippy, Sarah, Brazza, Multiple) $80–$400 used; Chanel wallets (caviar, lambskin) $200–$700; Goyard St. Sulpice / St. Marc cardholder $200–$500; Coach wallet/wristlet $25–$120; Hermès H belt (calfskin reversible, "H" buckle) $300–$700 used, NWT $700–$1100 — discontinued colors appreciate above retail; Gucci Marmont belt $150–$400 (declining trend Q2 2026 — no longer auto-spike); LV monogram belt $200–$500; Gucci Web belt $80–$250; Hermès silk twill scarf 90cm $120–$600 (huge resale category — discontinued patterns command upper band); Burberry nova-check scarf $80–$300. Box, dust-bag, or authenticity card alone is NOT proof.
      Mass-market denim (Levi's 501/550/514/Wedgie, Wrangler, Lee, Old Navy, Gap denim): $15–$35
      Premium denim (7 For All Mankind, Citizens of Humanity, AG, Paige, Frame, Joe's, Mother) — CUT MATTERS A LOT: skinny is FALLING ($3–$25 used-good, $14 median, soft); wide-leg / flare / bootcut / Dojo are SPIKING ($30–$70 used-good, NWT to $100). Mother and Citizens skew +20–30% above 7FAM within tier. NWT premium denim wide-leg can reach $100. When you see flare/wide-leg cut, price at the upper band.
      Authenticated Y2K premium denim (True Religion big-stitch, Diesel, Rock Revival, Miss Me, Buckle, Affliction — check stitching and hardware): standard styles $9–$50; OG LOW-RISE FLARE WITH RHINESTONE / EMBELLISHMENT IS ACTIVELY SPIKING (Q2 2026): True Religion OG flare $35–$95; Diesel flare/wide-leg vintage $45–$120 (+45–58% in 30 days); Rock Revival / Miss Me embellished $20–$65 (+27%). When the item shows visible rhinestones, embellished back pockets, low-rise flare, or factory whiskering, price at the spike band, not the standard band.
      Y2K viral brands (Juicy Couture, Von Dutch, Ed Hardy, Baby Phat, Apple Bottoms — visible logos required, do NOT infer from silhouette): Juicy Couture velour tracksuit set NWT $55–$130, vintage Y2K USA-made set $100–$200 (+22% spike), Juicy terry tracksuit OG 2000s cotton $100–$165; Von Dutch trucker hat $20–$65; Ed Hardy graphic tee $25–$95; Baby Phat jacket/top $30–$120. These have real resale value now — Q2 2026 active spike reinforced by Euphoria S3 demand. Do NOT confuse with the COMMON HALLUCINATION TRAPS list — that warns against inferring these brands from look-alike silhouettes; this tier applies only when you can read an actual logo.
      Vintage Levi's tiered: Big E / 501XX / pre-1980s redline raw selvedge: $300–$590 (top of vintage market); LVC Big E selvedge reproduction (501/505/701): $42–$100; Premium Big E 90s–00s 501s: $25–$100; Standard post-Big-E vintage 501s/505s/550s button-fly: $19–$65; Vintage 70505 trucker jacket: $35–$120. Vintage Wrangler Blue Bell: $60–$250+.
      Vintage non-denim Americana (Pendleton, Filson, LL Bean, Eddie Bauer, Woolrich): Pendleton wool jacket/coat $35–$120, flannel shirt $20–$55; Filson jacket/shirt $45–$180 (premium of the tier); LL Bean fleece/flannel $15–$50; Eddie Bauer vintage down/puffer $25–$85; Woolrich wool coat/jacket $35–$120. These are common thrift finds with real Americana/workwear resale value.
      Vintage graphic tees / band tees — single-stitch hems, blank or USA-made tag, no side seams, soft cracked print are vintage tells (modern repros use side seams + double-stitched hems): Generic vintage 80s/90s graphic tee unbranded $20–$60; Vintage Disney / cartoon (Mickey, Looney Tunes, Garfield, theme-park souvenir) $30–$120; Vintage 80s/90s rock band tee $50–$200; Vintage 90s hip-hop / rap tee $60–$220; Vintage Disneyland / Six Flags / souvenir park tee $25–$100; Vintage NASCAR / racing crew tee 90s $40–$150. Grail-tier collector pieces (Nirvana Sub-Pop, Metallica Metal Up Your Ass) exist in the $500–$2000+ market but are rare enough to flag for manual research rather than auto-price — set confidence low and stay at the upper band of the standard tier above.
      Vintage sports jerseys & college: Mitchell & Ness Authentic NBA/NFL throwback jersey $80–$300; Vintage 90s Champion NBA jersey $60–$250; Vintage Starter NFL jersey $50–$200; Vintage Russell / Majestic MLB jersey $40–$150; Champion Reverse-Weave 80s/90s college sweatshirt (single-stitch, USA-made, blank tag) $40–$200, rare schools/colors to $300; Vintage college tee 80s/90s $25–$95. Modern Mitchell & Ness NWT current-season $120–$250.
      Boots — Combat boot (Steve Madden, Free People, generic): $20–$65; Doc Martens 1460 8-eye standard color (black, cherry) $40–$95 used, NWT $100–$140; Doc Martens Jadon platform / 1461 3-eye / Mary Jane $50–$120 used, NWT $120–$180; Vintage Made-in-England Doc Martens (smooth leather, MIE stamp on heel) $120–$300; Vintage western/cowboy boot $35–$180 (genuine vintage leather commands upper band); Knee-high heeled boot (designer-adjacent) $25–$95.
      Hats — Vintage trucker (Von Dutch era, distressed snapbacks): $20–$65; Branded dad cap (Patagonia, Arc'teryx, North Face, designer logos): $18–$55; Beanie (Carhartt, Patagonia): $10–$28.
      Sunglasses & eyewear (heavily counterfeited — verify hinges, brand etching on lens, "RB" lens etching for Ray-Ban, Oakley laser-etched logo + "O" hinge): Drugstore / mass market $5–$15; Ray-Ban Wayfarer / Aviator / Clubmaster modern $30–$90 used, vintage USA-made Bausch & Lomb-era $80–$250; Oakley sport (Holbrook, Frogskins, Radar) $25–$120, vintage premium frames (Romeo, Juliet, Mars, X-Metal) $100–$400+; Persol / Maui Jim / Costa Del Mar $40–$150; Designer (Tom Ford, Celine, Gucci, Prada, Versace, Dior, Saint Laurent, Miu Miu, Chanel) $50–$300; Vintage 80s/90s designer (Versace Medusa, vintage Cazal, vintage Dior monogram, vintage Chanel CC) $80–$500+. Branded case or cleaning cloth alone is NOT proof of authenticity — require maker etching on lens or temple.
      Luxury denim (Acne Studios, Balenciaga, Gucci, Balmain, Saint Laurent, R13): $80–$400+
      Unbranded or generic jeans: $12–$28
      Vintage (20+ years, good condition): add 30–60% over what comparable modern items sell for
      Unknown/unbranded: price by material quality, construction, and visual appeal — $10–$30
      Costume/fashion jewelry (no precious metal or stones, unbranded): $5–$20
      Sterling silver jewelry (925 stamp) — sub-tiered: plain ring no stones $8–$35; earrings (plain or stones) $8–$40; maker-signed necklace $15–$85; with semi-precious stones (amethyst, turquoise, garnet, opal, citrine) $15–$60.
      Gold-filled or gold-plated jewelry (vermeil, GF stamp): $20–$65
      Solid gold jewelry (10k/14k/18k/24k — price by karat and weight; heavier = higher): $40–$200+
      Fine jewelry with diamonds (solitaire, halo, pavé — evaluate visible size, cut, setting quality): $80–$500+
      Fine jewelry with precious gemstones (ruby, sapphire, emerald — evaluate color saturation, size, setting): $60–$400+
      Platinum jewelry: add 30–50% over equivalent gold piece
      Designer jewelry houses (Tiffany, Cartier, Van Cleef & Arpels, David Yurman, Bulgari, Harry Winston): $100–$2000+
      Accessible designer jewelry (Pandora, Kendra Scott, Lagos, John Hardy, James Avery): $25–$120
      Estate/antique jewelry (Art Deco, Victorian, Edwardian, signed vintage): add 40–80% over base material value
      Celebrity-associated or trending designer collabs: add 20–50% trend premium
      Gemstone/crystal-embellished clothing (Swarovski crystals, rhinestone detailing, beaded gowns, crystal appliqués, gem-studded denim): price using the garment's brand tier as base, then add 30–60% for embellishment quality and density. Intact, densely-set crystals on designer pieces command top premiums. Missing stones or loose settings reduce value.
    Platform context: Depop runs higher for Y2K, vintage, trendy aesthetics, and unique pieces; Poshmark higher for workwear, contemporary brands, and NWT items; eBay for sportswear, collectibles, authenticated luxury, and fine jewelry (especially with GIA certs or brand boxes); Etsy for handmade, vintage 20yr+, cottagecore/artisan aesthetics, and estate jewelry. For furniture: Facebook Marketplace and Craigslist for local-pickup mid-tier (broadest buyer pool, no fees); Chairish and 1stDibs for vetted MCM/vintage premium (commission cuts but prices skew 30–50% higher); AptDeco for NYC/LA local-pickup contemporary; OfferUp for casual local; Etsy for vintage-only smalls (lamps, mirrors, decor under 30 lbs); eBay for shippable smalls (lighting, decor, hardware, small mirrors).
    Trend premiums (+20–40% to base): gorpcore/outdoor, quiet luxury, coquette, vintage collegiate, 90s minimalism, western/Americana, mesh/sheer, ballet/balletcore. Apply when the item clearly fits.
    BOOST STACKING — HARD RULE: Never compound 3 or more independent percentage boosts on the same factory item. The boost categories are: (a) era — vintage / Y2K / 90s / 80s / 70s / deadstock; (b) embellishment — rhinestone / crystal / beaded / sequin / studded / appliqué; (c) trend — coquette / gorpcore / balletcore / Q2 spikes / quiet luxury; (d) collab/celebrity — Travis Scott, Virgil, Fragment, named-artist collab; (e) denim spike — low-rise / flare / wide-leg / Y2K premium denim brands. Apply at most TWO boosts and pick the highest-percentage one as the primary; treat the rest as already implied by the brand tier. Compounding all of "vintage Y2K rhinestone flare trending Diesel" is double-counting — Diesel's +58% spike already factors in the Y2K low-rise flare aesthetic. Stay anchored to comparable Depop/Poshmark sold-comp prices, not formulaic stacking.
    Q2 2026 ACTIVE SPIKES (refresh this list quarterly — current as of 2026-04-30): crochet tops & matching sets, cargo pants, boho/romantic dresses, spring knits, polka dots, surf-aesthetic, peeptoe heels, wedding-guest dresses. Y2K maximalist demand is reinforced by the Euphoria Season 3 × Depop collab — keep Y2K aesthetic premium active. Apply +30–50% over base when an item clearly fits one of these spikes.
    suggestedResaleHigh: best-case sold price, typically 40–60% above low. For hyped items (trending brand + trending aesthetic), can reach 2x low.

  ► IF category = "furniture" → FURNITURE PRICING (use this path; IGNORE the clothing factory tiers and handmade labor formulas above — furniture has its own market dynamics):
    suggestedPaid: typical thrift/estate-sale shelf price ($10–$150). Antique mall and estate sales price higher than thrift; reflect that in suggestedPaid.

    BRAND/ERA TIERS (resale comp ranges based on Facebook Marketplace, Chairish, 1stDibs, Craigslist, eBay, AptDeco):
      Mass-market particleboard (IKEA, Wayfair budget, Target Threshold, dorm-tier): $15–$80. Larger dressers/wardrobes top out $80–$120 only when assembled and undamaged.
      Modern contemporary (West Elm, CB2, Crate & Barrel, Pottery Barn, Article, Joybird): chairs $80–$400, sofas $200–$800, dining tables $150–$600, storage $150–$500. NWT or like-new commands top of range; heavy use drops 50%.
      Premium contemporary (Restoration Hardware, Room & Board, Design Within Reach, Blu Dot): $200–$1500. RH leather/linen sofas $400–$2000+ used.
      MCM authenticated (Eames, Knoll, Herman Miller, Hans Wegner, Eero Saarinen, George Nakashima, Arne Jacobsen, Marcel Breuer, Le Corbusier, Mies van der Rohe, George Nelson, Florence Knoll, Cassina, Vitra, B&B Italia, Poltrona Frau): $500–$8000+. Eames Lounge Chair authenticated $2500–$8000; Saarinen Tulip Table $400–$2500; Wegner Wishbone $400–$1200; Barcelona Chair (Knoll/Cassina) $800–$3500; Eames Shell Chair $200–$700; Nelson Bench $400–$2000.
      Vintage Danish/Scandinavian Modern unbranded (teak/walnut/rosewood, sleek tapered legs, dovetail joints): credenza/sideboard $300–$1500, dining chair set of 4 $300–$1200, dining table $200–$900, lounge chair $200–$700.
      Vintage American mid-tier (Heywood-Wakefield, Drexel, Lane, Henredon, Baker, Thomasville, Ethan Allen, Stickley, Broyhill Brasilia, Kent Coffey, American of Martinsville): chairs/tables $100–$800, case goods $200–$2000. Stickley Mission and Broyhill Brasilia spike toward upper band.
      Hollywood Regency / Postmodern 70s–80s (Memphis Group, Karl Springer, Milo Baughman, Gabriella Crespi, Vladimir Kagan, Pierre Cardin): $400–$3000+ (Q2 2026 spike — Memphis revival especially). Lacquer, brass, lucite, mirrored surfaces are tells.
      Vintage industrial (factory carts, machinist tables, school chairs, warehouse stools, Toledo): $80–$600. Cast iron and patinated steel premium.
      Generic vintage no-brand decent solid-wood quality: $40–$300 depending on size and condition.
      Antique 100yr+ solid wood (cherry, oak, walnut, mahogany, dovetail joinery, hand-cut details): $100–$1000; carved/signed/Eastlake/Victorian/Empire/Art Deco $200–$2000+. Look for hand-cut dovetails (irregular, slightly uneven) vs machine-cut (uniform).
      Outdoor: Brown Jordan / Janus et Cie / Crate & Barrel outdoor / RH outdoor $100–$800; teak outdoor (Smith & Hawken, Gloster) $80–$500; generic plastic patio $20–$100.
      Lamps: generic floor/table lamp $25–$120; vintage brass/Stiffel/mid-century ceramic $40–$200; designer modern (Artemide, Flos, Louis Poulsen) $150–$800; Tiffany authenticated $500–$5000+; Tiffany-style reproduction $40–$150.
      Mirrors: generic $20–$100; vintage gilt/MCM/sunburst/convex $80–$400; antique/Art Deco/large floor mirror $150–$800.
      Rugs: machine-made polypropylene/synthetic $20–$80; wool no-brand $50–$300; vintage Persian/Turkish/Moroccan/Oushak (hand-knotted, natural dye) $150–$2000+; antique Heriz/Kashan/Tabriz $300–$5000+. Look for hand-knotted vs machine-made (back of rug shows individual knots vs uniform machine pattern).
      Decor smalls (vases, sculpture, wall art, brass objects, ceramics): unbranded $10–$80; signed studio pottery $40–$300; vintage signed sculptors $100–$1000+.

    MATERIAL SIGNALS (price modifier ±30–50%):
      Solid wood (especially walnut, teak, cherry, mahogany, oak, rosewood): +30–50% over comparable veneer-built piece.
      Veneer over plywood (legitimate construction technique used by mid-century brands): baseline.
      Particleboard / MDF / laminate / melamine / pressed wood / engineered wood: HARD FLOOR — rarely above $80 used regardless of original retail price or brand mention. Tells: visible particle texture at edges, wood-grain printed paper veneer (not real wood), swelling around water exposure, weight far less than expected for size.
      Solid brass / bronze / iron / steel hardware: +20–30%.
      Marble or stone tops (genuine, not laminate imitation): +30–50%.
      Genuine leather upholstery in good condition: +20–40%.
      8-way hand-tied springs (premium sofa/chair construction, visible underneath): premium signal.
      Dovetail joints, mortise-and-tenon, hand-cut joinery: quality signals reinforcing era/brand authenticity.
      Stapled/glued/screwed construction: floor signal.
      Stained, torn, sagging, or pet-damaged upholstery: -50% (assume buyer reupholsters).

    CONDITION (huge for furniture, applied IN ADDITION to the general CONDITION ADJUSTMENT below):
      Refinishable surface scratches, light wear: neutral to -20%.
      Structural damage (broken legs, wobbly frame, cracked seat, busted spring): -50% to -80%.
      Smoke or pet odor: -50% (kills resale even when invisible in photo).
      Water damage, swelling, mold, bubbling veneer: pulls toward scrap value.
      Refinished/reupholstered to high standard: +20–50% over base tier (counts as isCustom — treat as labor premium).

    SIZE PENALTY: large items (sofas, sectionals, dining tables seating 6+, beds, full-size dressers, armoires) -30% vs comparable smaller piece because the buyer pool is local-pickup-only on Facebook Marketplace/Craigslist/OfferUp. Small shippable items (lamps, mirrors under 36", side tables, decor under 30 lbs) command full price because they list nationally on eBay/Etsy.

    MCM ATTRIBUTION — HARD RULE: Eames / Knoll / Wegner / Saarinen / Herman Miller / Vitra / Cassina / Nakashima / Jacobsen / Breuer / Le Corbusier / Mies van der Rohe / Nelson attribution requires a visible maker label, sticker, stamp, paper tag, or burn-in mark. Without it, do NOT include the designer name in "name". Describe as "MCM-style", "mid-century", "Danish modern", or "in the manner of [era]" and price as unattributed MCM tier ($80–$300). Silhouette resemblance is NOT identification — knockoffs of Eames Shell Chair, Wegner Wishbone, and Saarinen Tulip Table are mass-produced and common in thrift. Same trap pattern as the COMMON HALLUCINATION TRAPS list for clothing.

    Q2 2026 FURNITURE SPIKES (refresh quarterly): boucle and sherpa reupholstery; limewash and whitewash refinish; cane and rattan accent pieces (chairs, headboards, peacock chairs); postmodern Memphis revival; Italian designer (Cassina, B&B Italia, Poltrona Frau, Minotti) on resale; Japandi minimalism; vintage Persian/Moroccan/Turkish/Oushak rugs; antique wooden ladders; architectural salvage (corbels, mantles, doors); brass and lucite accents. Apply +20–40% over base tier when item clearly fits a spike.

    FURNITURE isCustom: refinished, restained, repainted, limewashed, whitewashed, reupholstered, recaned, or repurposed (dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard) qualifies as isCustom. Pricing: brand/era tier as base + 30–50% labor premium for skilled work. Do NOT exceed the subcategory ceiling for the base piece — refinished IKEA stays under $120 regardless of effort. Refinishing only meaningfully boosts pieces with quality bones (solid wood, MCM lines, antique structure). Refinish on particleboard adds $0 — call out as red flag if the user invested labor in particleboard.

  ► IF category = "accessories" AND the item is jewelry or a watch → JEWELRY PRICING (use this path; IGNORE the jewelry lines in FACTORY ITEM PRICING above — the tiers below are refreshed Q2 2026 and supersede them. Jewelry has its own market dynamics: metal + stamp + maker, not era × embellishment × trend stacking):
    Detection: name or sub contains ring, necklace, pendant, chain, earrings, bracelet, bangle, cuff, brooch, pin, charm, locket, choker, anklet, watch, jewelry, or jewellery.
    suggestedPaid: thrift stores often underprice precious metals and stones — when gold karat stamp, designer maker mark, or visible gemstones are present, suggestedPaid can be $5–$100+; otherwise $3–$15.

    METAL / MATERIAL TIERS — apply only with a readable hallmark stamp visible (see JEWELRY HALLMARK — HARD RULE above). Without a stamp, default to the costume tier even when the piece looks high-quality:
      Costume / fashion (no hallmark, unbranded): $5–$20
      Signed vintage costume (Trifari, Coro, Eisenberg, Weiss, Haskell, Hobé, Whiting & Davis, Sarah Coventry, Monet, Napier, Trifari Jelly Belly, Boucher, Hattie Carnegie, Kenneth Jay Lane): $20–$120 — only when the maker mark is visibly readable on the back/clasp. Statement brooches, Bakelite, and rhinestone parures skew the upper band. Strong Etsy/eBay resale category often misclassified as generic costume.
      Sterling silver (925 / STER / STERLING / 800 stamp) — sub-tiered: plain ring no stones $8–$35; earrings (plain or stones) $8–$40; maker-signed necklace $15–$95; with semi-precious stones (amethyst, turquoise, garnet, opal, citrine, moonstone) $15–$70.
      Gold-filled / gold-plated / vermeil (1/20 GF / GF / GP / RGP / vermeil / 925 stamp with gold tone): $20–$75 (gold spot ~$3000/oz Q2 2026 has lifted the floor on plated and filled categories).
      Solid gold by karat (priced by visible karat stamp + chain weight + pendant size; heavier = higher): 10k $40–$160; 14k $80–$300; 18k $150–$500+; 22k–24k $200–$700+.
      Diamond fine jewelry (solitaire, halo, pavé, tennis, eternity — evaluate visible size, cut, setting quality): $80–$600+. Visible grading cert (GIA / AGS / EGL) adds 30%; missing cert = drop confidence to "low" even if setting looks correct.
      Colored gemstone fine jewelry (ruby, sapphire, emerald, tanzanite, alexandrite — evaluate color saturation, size, setting): $60–$450+.
      Pearl: costume faux $5–$20; cultured freshwater $20–$80; Akoya $80–$300; Tahitian / South Sea / baroque / keshi $150–$800+. Photo alone cannot confirm pearl type — default cultured-freshwater tier with low confidence unless brand cert/box visible (Mikimoto).
      Platinum (PLAT / 950 / 900 stamp): +30–50% over equivalent gold piece.

    DESIGNER HOUSE TIERS — apply only with a visible maker stamp on the piece itself (T&Co, ©Tiffany & Co., "Please Return to Tiffany & Co.", Cartier signature + serial, ALE 925, DY, VCA + serial, BVLGARI, etc.). Box/dust-bag alone is NOT proof — boxes are sold separately. Without the stamp, route to the costume tier or the silhouette-knockoff red flag:
      Designer house (Tiffany, Cartier, Van Cleef & Arpels, Bulgari, Harry Winston, Mikimoto, Buccellati, Boucheron, Chopard, David Yurman): $100–$2500+. Tiffany sterling sub-tier (Return-to-Tiffany, Elsa Peretti bone cuff, T1, Atlas): $80–$350 — runs much higher than non-Tiffany sterling because of brand premium.
      Accessible designer (Pandora, Kendra Scott, Lagos, John Hardy, James Avery, Mejuri, Catbird, Maria Tash, Aurate, Awe Inspired, Brilliant Earth Heirlooms): $25–$200 depending on metal (sterling base lower band, 14k base upper band).

    WATCHES (sub-tier — apply only with visible brand mark on dial AND matching case-back signal):
      Fashion watches (Fossil, Michael Kors, Skagen, Anne Klein, Guess, DKNY): $20–$80
      Mid-tier (Tag Heuer, Tissot, Hamilton, Seiko Presage / Prospex, vintage Bulova, vintage Omega quartz, Citizen Eco-Drive premium, Movado): $80–$400
      Luxury (Rolex, Omega Seamaster / Speedmaster, Cartier Tank, Patek Philippe, Audemars Piguet, IWC, Breitling, Vacheron Constantin, Jaeger-LeCoultre): $400–$15,000+. REQUIRES visible maker mark on dial AND serial number / model reference visible. Without both, drop to mid-tier ceiling. Authenticated luxury watch with matching papers/box adds 20–40% over equivalent unboxed.

    ESTATE / ANTIQUE: Art Deco, Victorian, Edwardian, Georgian, Retro, Mid-Century signed pieces — add 40–80% over base material value. Hand-engraving, mine-cut diamonds, foiled-back stones, and rose-cut stones are era authentication signals.

    Q2 2026 JEWELRY SPIKES (refresh quarterly): chunky gold chains, charm necklaces and locket revival, signet rings, stacked rings, bow charms, Y2K choker, vintage cameo, mismatched pearl, mourning jewelry, dainty layered chains. Apply +20–40% over base when item clearly fits.

    Trend premiums and embellishment boosts from the clothing factory branch DO NOT apply to jewelry — jewelry pricing is metal-and-maker driven, not aesthetic-trend driven. The BOOST STACKING rule still applies to prevent compounding era × trend × embellishment on the same piece.

  CONDITION ADJUSTMENT (applies to both handmade and factory): Reduce both suggestedResaleLow and suggestedResaleHigh by 30–50% for visible damage — prominent stains, non-decorative holes, heavy pilling, faded/washed-out color, stretched or warped necklines, broken zippers, missing buttons, loose stitching, scuffed/cracked/peeling leather, yellowed whites, broken or cloudy hardware, tarnish on jewelry. Reduce by 15–25% for moderate wear — minor pilling, slight fading, small spots, faint creases, light patina. NWT or like-new condition (crisp fabric, intact hardware, no visible wear, original tags) commands the top of the range. When condition is unclear from the photo, assume "used-good" and make no adjustment. Never apply condition bonuses above the tier ceiling.

  FINAL SANITY CHECK — DO THIS BEFORE RETURNING (applies to ALL pricing paths):
  After computing suggestedResaleLow and suggestedResaleHigh, pause and ask yourself: "Would this specific item actually sell on Depop / Poshmark / eBay TODAY at these prices?" Mentally picture 3 recently-sold listings of the closest comparable item (same brand tier, same silhouette, same condition, same trend bucket).
    • If your suggestedResaleHigh exceeds the most likely sold-comp by more than 30%, pull BOTH ends down toward the comp median. Tier ladders and brand-tier benchmarks are starting estimates, not the final answer — actual sold comps are the ground truth.
    • If your range straddles two clearly different tiers (e.g., $40–$200), narrow it. A range that wide signals you have NOT picked a tier — pick one and commit, then set confidence: "low" via the confidence rule.
    • For handmade items: the tier ladder above is calibrated for UNKNOWN MAKERS on Depop/Etsy. Do NOT inflate above the listed hard ceilings unless the maker name is explicitly an established Etsy/Depop creator with documented sale history. "Looks impressive", "took a long time to make", or "trending aesthetic" are NOT reasons to exceed the unknown-maker ceiling — buyers price on finished look + maker reputation, not perceived effort. ALSO check band-position: if your output sits in the upper third of a tier band without explicit upper-tier signals (named maker, NWT, exceptional construction keyword, mint condition), pull both ends down toward the lower-middle of the band. First-pass overshoot = anchoring at band ceiling instead of lower-middle median.
    • For factory items with multiple boosts (era + embellishment + trend): re-check the BOOST STACKING rule. If you applied 3+ boosts, you're double-counting — strip back to one or two.
  This check exists because first-pass pricing consistently anchors high; rescans land closer to true comps because they self-correct against a prior verdict. Do that self-correction here, on the first pass.
- ideas[].t = short, actionable tip (no price amounts)
- If multiple items are visible, identify only the most prominent one
- If the photo appears to be AI-generated, a screenshot, or not a real physical item, set name to "Not a real item" and confidence to "low"
- For Sanrio characters (Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, etc.) or other collectible character brands, the bundle idea should suggest pairing with related items from the same universe — e.g. "Bundle with other Sanrio items for a themed lot — character bundles sell 30-50% higher on Depop"
- authFlags: 0–3 short authenticity checks ONLY for items where counterfeits commonly exist:
  luxury brands (Louis Vuitton, Gucci, Chanel, Prada, Burberry, Hermès, Dior, Fendi, Balenciaga, Saint Laurent),
  designer goods (Coach, Kate Spade, Tory Burch, Michael Kors, Marc Jacobs),
  brand-name sneakers (Nike Dunk, Jordan, Yeezy, New Balance 550/2002R),
  designer sunglasses, premium denim (True Religion, Diesel), branded watches, precious stones/fine jewelry,
  MCM/designer furniture (Eames, Knoll, Herman Miller, Wegner, Saarinen, Cassina, Vitra, Nakashima, Jacobsen, Breuer, Nelson), designer modern repros (Saarinen Tulip Table, Barcelona Chair, Wegner Wishbone, Eames Shell Chair, Eames Lounge), Tiffany lamps, antique signed pieces.
  Each flag = a specific, actionable physical check the buyer can do in-store — e.g.:
  "Check stitching evenness — authentic LV uses single continuous thread, no loose ends"
  "Verify heat stamp depth and font — counterfeits have shallow or inconsistent stamping"
  "Look for a date code inside the interior pocket or under the flap"
  "Inspect zipper pulls — should be branded hardware with smooth action, no rough edges"
  "Feel the leather — genuine should be supple with natural grain, not plasticky or uniform"
  "Check for hallmarks inside the band or clasp — 10k/14k/18k/750/925/PLAT stamps indicate real precious metal"
  "Examine stones closely — real gemstones have natural inclusions; glass and CZ appear flawless and overly brilliant"
  "Test metal weight — genuine gold and platinum feel noticeably heavier than plated or costume metals"
  "Check the underside of seat or inside the drawer for a Herman Miller / Knoll / Cassina / Vitra / maker label, sticker, or burn-in stamp — knockoffs of MCM designer pieces are mass-produced"
  "Verify Tiffany lamp signature on bronze base and feel the glass weight — leaded glass is significantly heavier than reproduction"
  "Look for a maker's mark, paper label, or stamp on the back or underside — authenticates antique era and origin"
  "Look for 'T&Co' or '©Tiffany & Co.' stamp on clasp or back — heart pendants, beaded chains, and Return-to-Tiffany silhouettes are heavily counterfeited"
  "Cartier Love and Juste un Clou pieces have a serial number engraved beside the Cartier signature — knockoffs lack the serial or use shallow / uneven engraving"
  "Pandora charms and bracelets have 'ALE 925' stamped on the inner ring or charm core — counterfeits omit ALE or use blurry / off-center stamping"
  "Look for the LV date code (FL/SD/CT/MI/SP + 4 digits) inside an interior pocket or under the flap — pre-2021 bags require this; counterfeits omit or print the wrong format"
  "Coach creed patch should have a clean serial number engraved; superfakes use blurry shallow stamps and inconsistent font kerning"
  "Hermès Birkin/Kelly: blind stamp on inside near strap base (year letter in box/circle/square + craftsman code) — counterfeits skip the blind stamp or use generic placement"
  "Chanel: 8-digit serial sticker inside flap pocket should match authenticity card font; counterfeits use uneven adhesive and wrong font weight"
  "Jordan / Dunk: cross-check the SKU on the inner tongue tag against the original colorway on Nike SNKRS or StockX — fakes often have valid-looking SKUs that don't match the photographed colorway"
  "Travis Scott Jordan 1: verify Cactus Jack-branded shoelace bag is included AND that the reverse mini-swoosh is stitched (not glued/printed) — replica swooshes peel"
  Empty array [] for: unbranded items, fast fashion, mall brands, handmade items, basic athletic wear, generic IKEA-tier furniture, or anything where counterfeits are uncommon.
  Frame as verification tips, not accusations — the goal is to help the buyer verify before purchasing.
- RED FLAG DETECTION — HARD RULE — populate redFlags (1–2 items) when ANY of the following are true. This is NOT optional — if ANY condition matches, you MUST include at least one redFlag. Empty array [] ONLY when zero conditions match.

  UPCYCLE EXEMPTION — evaluate before any other red flag rule: If isCustom = true (per the isCustom criteria above), treat unusual visual qualities of the GARMENT as expected features of handmade work, NOT as red flags. Frankensteined/patchwork/reconstructed garments legitimately combine mismatched fabric panels, clashing prints, jarring color blocks, asymmetric construction, and logos spliced with unrelated textiles — that IS the craft, not a red flag. Do not return "All-over sublimation print" or the "stock-photo" sentinel for upcycled garments whose "weirdness" comes from the upcycle itself. This exemption does NOT waive the text-garbling, anatomical-impossibility, or diffusion-smearing tells — those remain red flags regardless of isCustom.

  ALL-OVER DIGITAL PRINT: The garment has an all-over sublimation or digital print covering most of its surface WITH PICTORIAL CONTENT — tattoo flash art, paintings, illustrations, photorealistic imagery, anime stills, meme/bootleg-style graphic collage, or AI-looking artwork printed on cheap polyester. These are almost always mass-produced dropship items.
    Do NOT flag classic textile repeats — ditzy florals, watercolor / painterly / abstract / tropical / Hawaiian florals, cherry/fruit prints, gingham, houndstooth, polka dots, stripes, checks, paisleys, toile, geometric tile repeats, bandana patterns, animal prints, tie-dye, marbled / ink-wash / watercolor abstracts, simple all-over logo monograms. These are traditional woven or printed fabrics that have existed for decades, not dropship sublimation.
    Do NOT flag garments visibly constructed from MULTIPLE DIFFERENT FABRIC PANELS — patchwork, pieced/spliced panels, mismatched front/back/side fabrics, fringe or beadwork trim added on top, lace-up or grommet inserts in contrasting fabric, visible reconstruction seams. Mass-produced dropship sublimation is printed on ONE continuous polyester panel; handmade upcycles combine different source fabrics. Multi-panel construction overrides this bullet regardless of whether each panel's print looks "pictorial."
    → Flag: "All-over sublimation print — commonly mass-produced. Check label for brand, artist credit, and material quality before buying."
  AI-GENERATED ARTWORK: The printed design on the garment shows ANY visual signs of AI generation:
    • Text in the design that is garbled, misspelled, fused, or nonsensical
    • Human figures with anatomical errors — extra/missing fingers, melted faces, impossible limbs
    • Elements that dissolve or blend into each other without logical boundaries
    • Photorealistic art style with no visible artist credit, brand, or studio name
    If ANY of these tells are present → Flag: "Artwork on this garment shows signs of AI generation — verify source and artist attribution before reselling."
  AI-GENERATED PHOTO: The photo itself — not the garment's printed design — was generated by an AI model rather than taken with a real camera.

    SCREENSHOT/UI EXEMPTION — evaluate before any artifact below: Many real photos are screenshots or shares from social media, resale apps, and phone cameras. App UI chrome, watermarks, captions, and overlay text are NOT AI artifacts and MUST NOT trip any bullet below. Do NOT flag for any of the following, regardless of how "off" the text or layout looks:
      • TikTok, Reels, YouTube Shorts, Instagram, Snapchat, BeReal, Pinterest, Twitter/X, Threads UI — like/comment/share icons, follow buttons, music attribution, sound-off labels, view/like/comment counts, progress bars, "live" badges, sticker overlays, emoji reactions, drawing/marker overlays, GIF stickers, location pins, polls, time stamps
      • Resale-platform watermarks and overlays — Depop @username, Poshmark, eBay, Mercari, Vinted, Etsy, Grailed, StockX
      • Captions, hashtag stacks (#fyp #foryou …), auto-translate banners, closed-caption text, on-screen subtitles, song lyrics overlays
      • Usernames containing emoji, special characters, decorative Unicode, or zero-width joiners
      • Foreign-language text in any script (Korean, Chinese, Japanese, Arabic, Hebrew, Cyrillic, Thai, Devanagari, etc.) — looking unreadable to an English speaker is NOT a sign of AI generation
      • Phone status bar, battery indicator, signal bars, notification banners, system time, control center, keyboard, app switchers, screenshot edges
      • Stylized or decorative fonts (gothic, script, distressed, sticker-style), kerning artifacts from compression or scaling, low-resolution text from re-shares
      • Professional product photography, brand catalog shots, flat lays, model photos, video stills, lookbook scans, magazine spreads, polaroid scans
      • Furniture refurb / thrift-flip content from TikTok / Reels / YouTube Shorts / Instagram — workshop in-progress shots, before/after pairs, painted/refinished pieces under controlled lighting, glossy painted surfaces, painted antique chests being repurposed. Refurb tutorials are real workshop documentation. Glossy paint, smooth refinished surfaces, perfectly-staged styling shots, and "too clean" looks on furniture are evidence of skilled refurb work, NOT AI generation. Do NOT flag refurb cover photos for AI artifacts on the basis of finish quality alone.

    Only AFTER confirming the image is not exempt above, flag when one or more of these specific AI generation artifacts are clearly visible:
    • Diffusion/smearing artifacts: areas of the image that look melted, smeared, or dissolved rather than sharply rendered
    • Impossible or physically inconsistent shadows — shadows that point in multiple directions, float, or have no logical light source
    • Background geometry that is physically impossible or "painterly" in a way no camera could produce
    • Garment edges that bleed, feather, or dissolve into the background without a clean transition
    • Fabric texture that looks CG-rendered — but ONLY when paired with another artifact in this list (smear, impossible shadow, edge bleed, garbled physical-surface text). Smooth synthetic fabrics (satin, taffeta, polyester, vinyl), uniformly-dyed garments, and saturated solid colors naturally look "perfect" in good lighting — that alone is NOT a CG tell. Real ruffles, pleats, smocking, concentric/radial garment construction, and tutu-style layered structure produce highly repetitive patterns that ARE NOT neural-network artifacts.
    • Garbled, fused, or melted text on a PHYSICAL SURFACE inside the photo — a storefront sign, hangtag, product label, book/paper in the scene, mirror reflection, brand label sewn into the garment. The text must clearly belong to a 3D object in the photographed scene, not to any UI overlay, caption, watermark, sticker, hashtag, username, foreign-script overlay, or screenshot chrome (all exempt above). Pair with at least one other artifact in this list before flagging — text alone is not enough.
    • Anatomical impossibilities if a person is shown — wrong number of fingers, melted facial features, impossible limbs
    Do NOT flag based on how the GARMENT itself looks — mismatched fabrics, patchwork panels, Frankensteined construction, clashing prints, unusual silhouette, logos spliced with unrelated fabrics, radial/concentric symmetry, ruffles, pleating, smocking, accordion folds, fan/petal/flower-shaped silhouettes, voluminous tulle/taffeta layering, parasol or umbrella shapes, and other geometrically perfect garment construction are all real fashion design — not AI photo artifacts. High symmetry and uniform color are properties of well-made garments, not generated images.
    For AI-GENERATED PHOTO specifically, do NOT err on the side of flagging — require at least one specific artifact from the list above. Real camera photos of upcycled or unusual clothing are common; AI-generated photos of clothing on real humans are rare.
    If genuine AI generation artifacts are present → add the string "stock-photo" to redFlags (no other text — this is an internal trigger only).
  When in doubt about whether a PRINT ON THE GARMENT is AI-generated (AI-GENERATED ARTWORK branch only), ERR ON THE SIDE OF FLAGGING. A false positive on a print is less harmful than a false negative. This erring applies ONLY to the artwork branch — it does NOT apply to ALL-OVER DIGITAL PRINT (require pictorial content) or AI-GENERATED PHOTO (require specific camera artifacts).

  FURNITURE RED FLAGS — apply ONLY when category = "furniture". Evaluate every flag below against the COVER PHOTO (the finished item being sold), NOT against any "before" or in-progress photos in a multi-photo refurb pair. A weathered/raw before-state photo is evidence of LABOR (the user invested work to refinish), NOT evidence of hidden defects in the finished cover piece. Do NOT speculate about defects that "might be hiding" under paint, refinish, or new upholstery — flag ONLY when the relevant tell is visibly present on the COVER.
  PARTICLEBOARD MASQUERADE: the COVER piece shows particleboard, MDF, or pressed wood with printed wood-grain paper veneer imitating solid wood. Tells (must be visibly present in the cover photo): visible particle texture or peeling paper at edges, swelling around water exposure, weight far less than expected for size, mass-market dorm/IKEA brand context. Do NOT flag painted refurb pieces, MCM-style flips, or refinished antique wood just because "it could be hiding particleboard underneath" — paint over solid wood is the most common refurb finish, and speculating about what's under the paint produces false positives. Do NOT flag dovetail-jointed antique chests, traditional drawer construction, or pieces with visible wood grain at unpainted areas (drawer interiors, undersides). → Flag: "Verify solid wood vs printed-veneer particleboard before paying solid-wood prices — particleboard rarely resells above $80 regardless of look."
  MCM KNOCKOFF: the silhouette resembles a famous MCM design (Eames Shell, Wegner Wishbone, Saarinen Tulip, Barcelona Chair, Eames Lounge) but no maker label, sticker, or stamp is visible in the photo. → Flag: "Verify maker stamp or label (typically underside of seat or inside drawer) before paying authenticated-MCM prices — knockoffs are mass-produced and common."
  HIDDEN ODOR: ONLY for visibly UPHOLSTERED furniture in the COVER photo (fabric or leather sofas, fabric chairs, padded headboards, mattresses, ottomans with fabric tops, fabric sectionals). Do NOT flag hard-surface pieces — wood dressers, painted/repainted/restained/limewashed/whitewashed wood, refinished antique chests, repurposed cabinets, wicker, rattan, cane, metal, glass, lacquer, lucite, fully refinished surfaces, or any refurb piece where the user has done refinish/repaint labor visible in the cover. A freshly painted or refinished surface is by definition NOT a smoke/pet/mildew vector — paint encapsulates and refinish strips the prior finish. Hard surfaces don't trap odor the way fabric does. → Flag: "Smell-verify in person — upholstery odor (smoke, pet, mildew) isn't photogenic but tanks resale."
  BEDBUG INDICATORS: rust-colored or dark spots along mattress seams, upholstery seams, or frame joints. Especially flag for curbside finds, apartment sources, and any mattress. → Flag: "Inspect seams and joints closely for rust-colored stains — bedbug indicators kill resale and create infestation risk."
  STRUCTURAL DAMAGE: ONLY when damage is unambiguously visible in the photo — a snapped/missing leg, a clearly cracked or split frame, a torn-through seat with springs poking out, dark water staining/swelling/bubbling on a wood surface, visible mold, a drawer hanging off-track, or a clearly broken joint. Do NOT flag for normal patina, light surface wear, intact wicker/cane that simply looks vintage, or pieces that appear sound. When in doubt, do NOT flag — false damage warnings erode trust. → Flag: "Structural damage visible — verify the piece is sittable/usable; refinishing won't compensate if the bones are compromised."

  JEWELRY RED FLAGS — apply ONLY when the item is jewelry or a watch (see JEWELRY PRICING detection):
  GOLD MASQUERADE: yellow-tone metal but no karat stamp visible (10k / 14k / 18k / 24k / 375 / 585 / 750 / 916). Common when only the front/face of a piece is photographed and the inner band or clasp is hidden. → Flag: "No karat stamp visible — verify a 10k/14k/18k/750 stamp inside the band or on the clasp before paying solid-gold prices. Brass and gold-plated are commonly mistaken for solid gold."
  STERLING MASQUERADE: silver-tone metal but no 925 / STER / STERLING stamp visible. → Flag: "No 925 or sterling stamp visible — could be silver-plated, stainless steel, or pewter. Verify stamp on clasp or inside the band before paying sterling prices."
  DIAMOND MASQUERADE: clear sparkly stones with no grading cert and no hallmarked precious-metal setting visible. → Flag: "Without a grading cert (GIA / AGS / EGL) or a stamped 14k+ gold or platinum setting, clear stones may be CZ, moissanite, or glass — verify before paying diamond prices."
  DESIGNER KNOCKOFF: silhouette resembles an iconic designer piece (Tiffany heart or "T" pendant, Cartier Love or Juste un Clou bracelet, Van Cleef Alhambra clover, Pandora charm bracelet, David Yurman cable cuff, Bulgari B.zero1 or Serpenti) but no maker stamp is visible in the photo. → Flag: "Iconic designer silhouette but no maker stamp visible — verify hallmark on clasp, inner band, or back before paying designer prices. Counterfeits of this exact silhouette are widespread."

  BAG / SNEAKER RED FLAGS — apply ONLY when the item is a bag or sneaker:
  LUXURY BAG KNOCKOFF: silhouette + canvas pattern resembles iconic luxury (LV monogram, Chanel CC quilt, Hermès Birkin/Kelly, Goyard chevron, Gucci GG, Prada triangle, Dior CD) but no date code, heat stamp, blind stamp, serial sticker, or interior brand plaque is visible. → Flag: "Iconic luxury bag silhouette but no date code / heat stamp / serial visible — verify on the interior pocket, leather tab, or under the flap before paying luxury prices. Counterfeit luxury bags dominate resale traffic."
  DESIGNER BAG KNOCKOFF: signature canvas (Coach C-monogram, Tory T-emblem, Michael Kors MK-monogram) without creed patch / interior brand stamp visible. → Flag: "Designer-bag silhouette but no interior creed patch or serial visible — verify before paying designer prices. Lookalike contemporary bag knockoffs are common."
  SUPERFAKE SEAM TELL: monogram canvas pattern (LV, Gucci, Goyard) shows visibly cut letters at the panel seams, off-color stitching, or laser-printed pattern with no fabric depth. Genuine luxury houses align canvas pattern across panels so letters never break at seams. → Flag: "Monogram pattern breaks at seams or shows printed (not woven) detail — superfake tell. Verify weave and seam alignment in person."
  HYPED SNEAKER COLLAB KNOCKOFF: collab-claim silhouette (Travis Scott reverse swoosh, Off-White zip-tie, Fragment bolt, Sacai dual-tongue) but no SKU label, box label, or co-brand insole signature visible. → Flag: "Collab-specific styling but no SKU / box / co-brand insole visible — collab fakes are the most-replicated sneaker category. Verify with StockX or GOAT before paying collab prices."
- upcycle[]: exactly 3 short, specific ideas for transforming this item to increase resale value. Before writing, identify: (1) exact material and texture, (2) specific construction details like hardware, seams, collar, lining, silhouette, (3) the era or subculture it references, (4) what niche aesthetic or current resale trend it could tap into if transformed. Use those observations to write ideas that could ONLY apply to this exact item — not any other. Each idea names a specific technique AND the niche aesthetic it creates. CLOTHING BANNED techniques (apply when category is NOT "furniture"): bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery — if you catch yourself writing one, think harder about what makes this item unique. BANNED aesthetic defaults (apply to ALL categories): do not use any of these unless the item is literally from that era/style and you can point to a specific visible detail that justifies it: cottagecore, floral, bohemian, coquette, fairy-tale, whimsical, romantic. If you catch yourself writing one of these aesthetics, delete it and think of something more specific to this item.
  FURNITURE upcycle (category = "furniture" only): the clothing BANNED list above does NOT apply. Allowed techniques: refinish (sand to natural / dark walnut stain / whitewash / limewash / cerusing / fuming); reupholster (boucle, mohair, vintage kilim, vintage textile, leather); paint frame (chalk paint, eggshell lacquer, automotive lacquer, milk paint); swap hardware (vintage brass pulls, leather pulls, ceramic knobs, custom-cast); recane or rerush (replace damaged caning or rush seat with new natural fiber); repurpose (dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard, suitcase → side table). Match technique to current spike — boucle reupholstery, limewash refinish, brass-and-cane revival are all Q2 2026 actively trending. Each idea targets a different aesthetic.
  Each of the 3 ideas must target a DIFFERENT aesthetic or subculture — never repeat the same aesthetic across the 3 ideas. Keep each under 15 words. Do not mention platforms or where to sell. Do not say "not applicable"`;

function inferMimeType(uri: string): string {
  const u = uri.split('?')[0].toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

/** Copy non-file URIs (e.g. Android content://) to cache so base64 read is reliable. */
async function resolveReadableUri(photoUri: string): Promise<{ uri: string; mimeType: string }> {
  const mimeType = inferMimeType(photoUri);
  if (photoUri.startsWith('file:')) {
    return { uri: photoUri, mimeType };
  }
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('No cache directory');
  const dest = `${cacheDir}scan_${Date.now()}.${extForMime(mimeType)}`;
  await FileSystem.copyAsync({ from: photoUri, to: dest });
  return { uri: dest, mimeType };
}

function extractModelText(data: Record<string, unknown>): string {
  const feedback = data?.promptFeedback as { blockReason?: string } | undefined;
  if (feedback?.blockReason) {
    throw new Error(`Request blocked: ${feedback.blockReason}`);
  }

  const cand = (data?.candidates as Record<string, unknown>[] | undefined)?.[0] as
    | { content?: { parts?: unknown[] }; finishReason?: string }
    | undefined;

  if (!cand) {
    throw new Error(`No response: ${JSON.stringify(data).slice(0, 280)}`);
  }

  const parts = (cand.content?.parts ?? []) as { text?: string; thought?: boolean }[];
  const withText = parts.filter((p) => typeof p.text === 'string' && p.text.trim().length > 0);

  if (!withText.length) {
    throw new Error(
      `Empty model output (${cand.finishReason ?? 'unknown'}): ${JSON.stringify(data).slice(0, 280)}`,
    );
  }

  const nonThought = withText.filter((p) => !p.thought);
  const chosen = (nonThought.length ? nonThought : withText)[
    (nonThought.length ? nonThought : withText).length - 1
  ];
  return chosen.text ?? '';
}

function parseJsonFromModelText(text: string): Record<string, unknown> {
  let s = text.trim();
  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) s = fenceMatch[1].trim();

  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    const braceMatch = s.match(/\{[\s\S]*\}/);
    if (!braceMatch) throw new Error(`No JSON: ${s.slice(0, 150)}`);
    return JSON.parse(braceMatch[0]) as Record<string, unknown>;
  }
}

/** Returns true if the error looks like a transient overload / rate-limit. */
export function isOverloadError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'overload' in err && (err as { overload?: boolean }).overload) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /API (429|503|529)/i.test(msg) || /overloaded|high demand|resource exhausted/i.test(msg);
}

const MAX_RETRIES = 2;
const RETRY_DELAYS = [3000, 8000]; // ms — Gemini 503 spikes need more breathing room

async function callGemini(url: string, images: Array<{ base64: string; mimeType: string }>, promptSuffix = '', signal?: AbortSignal, promptOverride?: string, temperature = 0.1): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: promptOverride ?? (PROMPT + promptSuffix) },
          ...images.map(img => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
        ],
      }],
      generationConfig: {
        temperature,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    const errMsg = `API ${res.status}: ${errBody.slice(0, 200)}`;
    const err = new Error(errMsg);
    if (res.status === 429 || res.status === 503 || res.status === 529 || /overloaded|high demand|resource exhausted/i.test(errBody)) {
      (err as Error & { overload?: boolean }).overload = true;
    }
    throw err;
  }

  const data = (await res.json()) as Record<string, unknown>;

  const apiError = data?.error as { message?: string; code?: number } | undefined;
  if (apiError) {
    const err = new Error(`API ${apiError.code ?? 'error'}: ${apiError.message ?? 'unknown'}`);
    if (apiError.code === 429 || apiError.code === 503 || /overloaded|high demand|resource exhausted/i.test(apiError.message ?? '')) {
      (err as Error & { overload?: boolean }).overload = true;
    }
    throw err;
  }

  const text = extractModelText(data);
  return parseJsonFromModelText(text);
}

async function callAnthropic(images: Array<{ base64: string; mimeType: string }>, promptSuffix = '', signal?: AbortSignal, promptOverride?: string, temperature = 0.1): Promise<Record<string, unknown>> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      temperature,
      messages: [{
        role: 'user',
        content: [
          ...images.map(img => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
          })),
          { type: 'text', text: promptOverride ?? (PROMPT + promptSuffix) },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    const errMsgStr = `Anthropic ${res.status}: ${errBody.slice(0, 200)}`;
    const err = new Error(errMsgStr);
    if (res.status === 429 || res.status === 529 || res.status === 503 || /overloaded/i.test(errBody)) {
      (err as Error & { overload?: boolean }).overload = true;
    }
    throw err;
  }

  const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  if (!text) throw new Error('Empty Anthropic response');
  return parseJsonFromModelText(text);
}

type ImagePart = { base64: string; mimeType: string };

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? 'unknown');
}

/**
 * Try Gemini 2.5 Flash first, fall back to 2.5 Flash Lite (different quota pool),
 * then Claude Sonnet 4.5 if configured. Non-overload errors skip retries and
 * fail over immediately. If all providers fail, throws an error containing all
 * underlying causes.
 */
async function callWithFallback(
  images: ImagePart[],
  promptSuffix: string,
  signal?: AbortSignal,
  promptOverride?: string,
  temperature = 0.1,
): Promise<Record<string, unknown>> {
  if (!GEMINI_KEY && !ANTHROPIC_KEY) throw new Error('API key not configured');

  let geminiError: unknown = null;
  let geminiFallbackError: unknown = null;
  let anthropicError: unknown = null;

  if (GEMINI_KEY) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await callGemini(GEMINI_URL, images, promptSuffix, signal, promptOverride, temperature);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        geminiError = err;
        // Non-overload errors: skip retries and try next provider — retrying won't help.
        if (!isOverloadError(err)) break;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }

    // Fallback to Gemini 2.5 Flash Lite — separate quota pool, so an overload on 2.5 Flash doesn't take it down.
    try {
      return await callGemini(GEMINI_URL_FALLBACK, images, promptSuffix, signal, promptOverride, temperature);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      geminiFallbackError = err;
    }
  }

  if (ANTHROPIC_KEY) {
    try {
      return await callAnthropic(images, promptSuffix, signal, promptOverride, temperature);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      anthropicError = err;
    }
  }

  const geminiPart = GEMINI_KEY ? `Gemini 2.5: ${errMsg(geminiError)}` : 'Gemini: key not configured';
  const geminiFallbackPart = GEMINI_KEY ? `Gemini 2.5 Lite: ${errMsg(geminiFallbackError)}` : '';
  const anthropicPart = ANTHROPIC_KEY ? `Claude Sonnet 4.5: ${errMsg(anthropicError)}` : 'Claude: key not configured';
  const parts = [geminiPart, geminiFallbackPart, anthropicPart].filter(Boolean).join(' | ');
  throw new Error(`All scan providers failed — ${parts}`);
}

async function runScanPipeline(photoUris: string[], promptSuffix = '', signal?: AbortSignal, priorResult?: ScanScenario): Promise<ScanScenario> {
  const resolved = await Promise.all(photoUris.map(uri => resolveReadableUri(uri)));
  const images = await Promise.all(
    resolved.map(async ({ uri, mimeType }) => ({
      base64: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
      mimeType,
    }))
  );

  const multiPhotoSuffix = images.length > 1
    ? `\n\nPHOTO INTERPRETATION — you are given ${images.length} photos. Photo 1 is the COVER (the item being sold).

Most multi-photo scans are SAME-ITEM, MULTI-ANGLE shots — front, back, label, hangtag, condition close-ups. THIS IS THE EXPECTED, COMMON CASE. Most scans will NOT have a "before" photo. Only flag a transformation when the visual evidence is unambiguous.

For each ADDITIONAL photo (slots 2 through ${images.length}, in any order — a "before" photo, if one exists, can land in ANY of these slots; do not assume a fixed position), independently classify it as:

(a) Another angle of the SAME finished item — front/back, label/hangtag close-up, condition detail. (DEFAULT — choose this when uncertain, when no clear transformation is visible, or when the user has just staged angles of one finished piece.)

(b) The BEFORE state — the original thrifted base before the user customized it.

Classify a photo as (b) when AT LEAST TWO of these are true relative to photo 1:
  • Shared fabric identity — same print, color palette, fabric weight, weave, or material visible in both photos. This is the strongest single tell because fabric carries through even when the garment shape changes drastically.
  • Photo 1 shows hand-applied or restructured elements (paint, patches, embroidery, dye work, studs, beadwork, hand-distressing, hand-stitching, ruching, gathering, cinching, halter conversion, corset boning, asymmetric cut, panel splicing, raw/unfinished cut edges, restitched seams, deconstruction; for furniture: fresh stain/paint/limewash, new upholstery, new hardware, recaning, refinished surface) that this photo clearly lacks.
  • This photo shows the original factory garment intact — uniform color, original silhouette, factory hems and labels still attached, no surface decoration, no construction modification.
  • Different silhouette but same fabric — one photo shows the source garment in its original shape, the other shows that fabric/material restructured into a new garment shape.

IMPORTANT — silhouette CAN change dramatically in real upcycles. Do NOT require the two photos to share a silhouette; that requirement causes false negatives precisely on the high-labor pieces where detection matters most. Common shape-shifting transformations:
  • T-shirt → ruched top, halter, tube top, corset, asymmetric crop, bandeau, tied-back top
  • Sweater or sweatshirt → cardigan (cut open + finished edge), shrug, cropped top, vest
  • Long dress → mini dress, top + skirt set, halter
  • Jeans → skirt, shorts, tote bag, frankenpants from two pairs
  • Curtains, bedsheets, quilts, blankets, tablecloths → dress, top, jacket, pants
  • Two or more garments combined → franken-shirt, panel dress, patchwork piece
  • Furniture repurpose: dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard

Strong tells for (b):
  • Same fabric / print / color / material in both photos but the construction differs — the strongest single signal, especially when one photo shows that fabric in its plain factory state and the other shows it gathered, ruched, cinched, halter-converted, corset-converted, or restructured into a new shape
  • Color/pattern shift on the same shape: plain white tee → tie-dyed tee, blue denim → bleached/painted denim, plain hoodie → embroidered hoodie
  • One photo has factory tags or original branding visible; the other has them obscured, removed, or built over with custom work
  • One photo styled for resale (good lighting, full garment, modeled); the other casual (hanger, floor, flat lay, harsh lighting)
  • Furniture refurb pair on the same piece: worn-finish dresser → refinished/painted/limewashed dresser; stained-fabric chair → reupholstered (boucle, mohair, kilim); damaged caning → recaned; old hardware → new brass/leather/ceramic pulls

Tells AGAINST (b) — keep as (a) angle:
  • Same surface treatment / decoration / construction as photo 1
  • Clearly a different side or detail of the finished piece (e.g., back of jacket + front of same painted jacket — both painted)
  • Consistent styling/lighting with photo 1 suggests one product shoot
  • No shared fabric, print, color, or material identity at all between the two photos — likely two unrelated items rather than a before/after pair
  • Same restructured garment shown from a different angle (front, back, side, off-shoulder, modeled in different poses). Asymmetric/draped/cinched/dolman/halter silhouettes won't be equally visible from every angle — the back of a dolman top looks "plainer" than the front because the drape and asymmetry are on the front. If the fabric, hem placement, overall garment length, and finished construction match, it's multi-angle of the AFTER, not a before/after pair.
  • Same scene/background/setting/wardrobe/styling across all photos (same room, same mirror, same bottoms, same model in the same outfit) — that's a single try-on session of one finished piece, not a transformation reveal which would require two distinct moments
  • Caption text, watermarks, or social media overlay describing the technique in general terms ("how I make dolman tops", "whenever I'm bored I take an old tee and...", "POV: you upcycle thrifted") is NOT evidence of a before photo. Only VISUAL evidence of an unmodified original counts. Caption claims about transformation must still be visually verified.

Outcomes:
  • All additional photos are (a) → SAME-ITEM scan. Use them together to identify the cover item. Set beforeAfterDetected = false. (Expected default.)
  • AT LEAST ONE photo is (b) → BEFORE/AFTER scan. Set beforeAfterDetected = true AND isCustom = true. Use any (a) photos to identify the cover item; treat (b) photos as evidence of labor only — do NOT price them as separate items. Pick pricing tier: if category = "furniture" → FURNITURE PRICING with FURNITURE isCustom logic (brand/era tier + 30–50% refurb premium; particleboard $80 ceiling and "refinished IKEA stays under $120" rule still apply); else if denim base → DENIM EXCEPTION; else → ALTERED FACTORY BASE EXCEPTION.

When uncertain about a single photo, default to (a). But if shared fabric identity is clear AND one photo shows hand-applied or restructured work the other lacks, classify as (b) even when the silhouettes differ — that combination is the signature of a real upcycle pair.`
    : '';

  const parsed = await callWithFallback(images, promptSuffix + multiPhotoSuffix, signal);

  const paid = Number(parsed.suggestedPaid) || 10;
  let resaleLow = Number(parsed.suggestedResaleLow) || 0;
  let resaleHigh = Number(parsed.suggestedResaleHigh) || resaleLow;

  const isDenim = parsed.category === 'denim';
  // Before/after detection forces isCustom: AI saw a transformation pair (cover photo
  // shows custom work, another staged photo shows the plain base). On single-photo
  // scans the AI can't have evidence — fall back to prior verdict (which was set
  // with multi-photo evidence) so single-photo rescans don't drop the pill.
  const beforeAfter = images.length >= 2
    ? parsed.beforeAfterDetected === true
    : priorResult?.beforeAfterDetected === true;
  const isCustomScan = parsed.isCustom === true || detectCustomFromText(parsed.name, parsed.sub) || beforeAfter;
  // Exceptional-construction override: rare denim items rebuilt into a new garment shape
  // (lattice/woven, sculpted halter/corset/bustier, deconstructed couture, quilted denim)
  // unlock a $300 ceiling. Keyword-gated via the AI's own name/sub vocabulary so common
  // denim items still bind to the default $140/$180 caps. Vocabulary mirrors the prompt.
  const exceptionalText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
  const isDenimBaseText = /\b(denim|jeans?)\b/i.test(exceptionalText);
  const isExceptionalText = /\b(lattice|woven|sculpt(ed|ural)|corset|bustier|halter|deconstructed|couture|frankenstein(ed)?|quilt(ed)?)\b/i.test(exceptionalText);
  const isExceptionalDenim = isCustomScan && isDenimBaseText && isExceptionalText;

  if (isDenim && isCustomScan) {
    const cap = isExceptionalDenim ? 300 : 140;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(25, Math.round(resaleLow * scale));
    }
  }
  const isAlteredPants = parsed.category === 'bottoms' && isCustomScan && !isDenim;
  if (isAlteredPants && resaleHigh > 180) {
    const scale = 180 / resaleHigh;
    resaleHigh = 180;
    resaleLow = Math.max(40, Math.round(resaleLow * scale));
  }
  // Handmade tops split by material tier. Crochet/hand-knit/cottagecore/mending legitimately
  // commands $80–$180 on Depop (visible labor + trending). Sewn-fabric does not — Depop
  // prices by finished look because the market is saturated with hobbyist tutorials.
  // Bare "knit"/"knitted" excluded from the trending regex — they almost always describe
  // knit FABRIC (jersey, spandex, ponte, stretchy knit), not hand-knit yarn craft. Require
  // explicit handmade-craft signals: "hand-knit", "knitwear", "yarn", etc.
  const isCrochetKnitText = /\b(crochet(ed)?|hand[-\s]?knit(ted)?|knitwear|yarn|cottagecore|milkmaid|mending|patchwork|embroider(ed|y)|macrame|needlepoint)\b/i.test(exceptionalText);
  const isHandmadeTop = parsed.category === 'tops' && isCustomScan;
  if (isHandmadeTop) {
    let cap: number;
    let floor: number;
    if (isExceptionalDenim) { cap = 300; floor = 40; }
    else if (isCrochetKnitText) { cap = 180; floor = 30; }
    else { cap = 95; floor = 20; }
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(floor, Math.round(resaleLow * scale));
    }
  }

  const isSkirtText = /\b(skirts?|mini-skirt|midi-skirt|maxi-skirt)\b/i.test(exceptionalText);
  const isShortsText = /\bshorts?\b/i.test(exceptionalText);
  const isSwimText = /\b(swim|swimsuit|bikini|one[\s-]?piece|swimwear|trunks)\b/i.test(exceptionalText);
  const isSneakerText = /\b(sneakers?|nike|adidas|vans|converse|jordan|dunk|yeezy|puma|new\s*balance|reebok|asics)\b/i.test(exceptionalText);
  const isCapText = /\b(caps?|hats?|beanies?|trucker)\b/i.test(exceptionalText);

  const isAlteredDress = parsed.category === 'dresses' && isCustomScan && !isSkirtText && !isSwimText;
  if (isAlteredDress) {
    const cap = isExceptionalDenim ? 300 : 200;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(40, Math.round(resaleLow * scale));
    }
  }

  // Skirts have no enum value — AI tags as dresses, bottoms, or other. Keyword-gated.
  const isAlteredSkirt = isCustomScan && isSkirtText && !isDenim;
  if (isAlteredSkirt) {
    const cap = isExceptionalDenim ? 300 : 140;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(30, Math.round(resaleLow * scale));
    }
  }

  // Tightens isAlteredPants further — shorts have less canvas than full-length pants.
  const isAlteredShorts = isCustomScan && isShortsText && !isDenim;
  if (isAlteredShorts && resaleHigh > 120) {
    const scale = 120 / resaleHigh;
    resaleHigh = 120;
    resaleLow = Math.max(25, Math.round(resaleLow * scale));
  }

  // Swimwear has no enum value — AI tags across categories. Keyword-gated.
  const isAlteredSwim = isCustomScan && isSwimText;
  if (isAlteredSwim && resaleHigh > 120) {
    const scale = 120 / resaleHigh;
    resaleHigh = 120;
    resaleLow = Math.max(25, Math.round(resaleLow * scale));
  }

  // Sneakers stay on prompt-only tiers ($120/$180/$260); only non-sneaker shoes clamp.
  const isAlteredShoe = parsed.category === 'shoes' && isCustomScan && !isSneakerText;
  if (isAlteredShoe && resaleHigh > 200) {
    const scale = 200 / resaleHigh;
    resaleHigh = 200;
    resaleLow = Math.max(40, Math.round(resaleLow * scale));
  }

  // Outerwear ceiling covers both altered factory bases ($60/$90/$130 per prompt) and
  // from-scratch handmade jackets/cardigans/dusters (HANDMADE OUTERWEAR EXCEPTION $35–$180).
  const isCustomOuterwear = parsed.category === 'outerwear' && isCustomScan;
  if (isCustomOuterwear && resaleHigh > 180) {
    const scale = 180 / resaleHigh;
    resaleHigh = 180;
    resaleLow = Math.max(30, Math.round(resaleLow * scale));
  }

  // Bag ceiling covers altered factory bases ($40/$80) and from-scratch handmade bags
  // (HANDMADE BAG EXCEPTION $20–$140 by complexity).
  const isCustomBag = parsed.category === 'bags' && isCustomScan;
  if (isCustomBag && resaleHigh > 140) {
    const scale = 140 / resaleHigh;
    resaleHigh = 140;
    resaleLow = Math.max(20, Math.round(resaleLow * scale));
  }

  // Caps/hats/beanies — keyword-gated like skirts/shorts/swim because category enum has no
  // dedicated value. Covers altered trucker caps ($80) and handmade beanies (HANDMADE
  // ACCESSORY EXCEPTION $15–$120 ceiling, but caps top out lower than scarves/wraps).
  const isCustomCap = isCustomScan && isCapText;
  if (isCustomCap && resaleHigh > 80) {
    const scale = 80 / resaleHigh;
    resaleHigh = 80;
    resaleLow = Math.max(20, Math.round(resaleLow * scale));
  }

  // Boost-stacking guard for FACTORY items only — custom items have their own
  // clamps above. Catches the compound case: 3+ independent boost buckets
  // triggered on the same item (era × embellishment × denim_spike × trend).
  // Single/double legitimate boosts (vintage Big E, Diesel flare alone, NWT
  // designer drop) stay below threshold and pass through. Luxury keywords
  // bypass entirely — those tiers price legitimately above the ceilings.
  if (!isCustomScan) {
    const stackText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
    if (!LUXURY_EXEMPT_RX.test(stackText)) {
      const boostCount = BOOST_BUCKETS.reduce((n, b) => n + (b.rx.test(stackText) ? 1 : 0), 0);
      if (boostCount >= 3) {
        const cat = parsed.category as ItemCategory | undefined;
        const ceiling =
          cat === 'denim' ? 180 :
          cat === 'tops' ? 130 :
          cat === 'dresses' ? 130 :
          cat === 'bottoms' ? 120 :
          cat === 'outerwear' ? 200 :
          cat === 'shoes' ? 200 :
          cat === 'bags' ? 220 :
          cat === 'accessories' ? 120 :
          null;
        if (ceiling != null && resaleHigh > ceiling) {
          const scale = ceiling / resaleHigh;
          resaleHigh = ceiling;
          resaleLow = Math.max(15, Math.round(resaleLow * scale));
        }
      }
    }
  }

  // Furniture-specific clamps. The prompt's MCM HARD RULE handles designer
  // hallucinations (silhouette ≠ identification); a code-level clamp on
  // designer name would create false negatives on legitimately authenticated
  // pieces. Particleboard is the one signal worth a hard floor — printed-paper
  // veneer on MDF/laminate never resells above $80 regardless of brand.
  const isFurniture = parsed.category === 'furniture';
  if (isFurniture) {
    const furnitureText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
    const PARTICLEBOARD_RX = /\b(particleboard|particle\s*board|mdf|laminate|melamine|press(ed)?\s*(wood|board)|engineered\s*wood)\b/i;
    if (PARTICLEBOARD_RX.test(furnitureText) && !MCM_BRAND_RX.test(furnitureText) && resaleHigh > 80) {
      resaleHigh = 80;
      resaleLow = Math.min(resaleLow > 0 ? resaleLow : 20, 40);
    }
  }

  // Jewelry-specific clamps. Mirrors the particleboard pattern. Skipped on
  // isCustomScan because handmade jewelry (wire-wrap, polymer clay, beaded)
  // legitimately has no metal hallmark — the HANDMADE JEWELRY EXCEPTION tier
  // governs those. Order matters: watch luxury → designer-without-stamp → no-hallmark
  // (most specific first).
  const isJewelry = parsed.category === 'accessories' && JEWELRY_RX.test(`${parsed.name ?? ''} ${parsed.sub ?? ''}`);
  if (isJewelry && !isCustomScan) {
    const jewelryText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
    const isWatch = /\bwatch(es)?\b/i.test(jewelryText);
    const hasStamp = DESIGNER_STAMP_RX.test(jewelryText);
    const hasHallmark = HALLMARK_RX.test(jewelryText);
    const hasDesignerName = DESIGNER_JEWELRY_RX.test(jewelryText);
    const hasSignedCostume = SIGNED_COSTUME_RX.test(jewelryText);

    if (isWatch && WATCH_LUXURY_RX.test(jewelryText) && !hasStamp) {
      // Rolex/Omega/Patek/etc. mentioned without serial/signature/stamp evidence:
      // drop to mid-tier ceiling. Authenticated luxury watches require dial mark + serial.
      if (resaleHigh > 400) {
        const scale = 400 / resaleHigh;
        resaleHigh = 400;
        resaleLow = Math.max(80, Math.round(resaleLow * scale));
      }
    } else if (hasDesignerName && !hasStamp && !isWatch) {
      // Tiffany/Cartier/VCA/Pandora/Yurman silhouette without maker stamp:
      // cap at accessible-designer ceiling to prevent silhouette hallucinations
      // from blowing out price.
      if (resaleHigh > 150) {
        const scale = 150 / resaleHigh;
        resaleHigh = 150;
        resaleLow = Math.max(25, Math.round(resaleLow * scale));
      }
    } else if (hasSignedCostume && !isWatch) {
      // Signed vintage costume tier (Trifari/Coro/Weiss/Haskell/etc.) — these have
      // real resale value when the maker mark is visibly readable on back/clasp.
      if (resaleHigh > 120) {
        const scale = 120 / resaleHigh;
        resaleHigh = 120;
        resaleLow = Math.max(20, Math.round(resaleLow * scale));
      }
    } else if (!hasHallmark && !hasDesignerName && !hasSignedCostume && !isWatch) {
      // No metal stamp + no designer name + no signed-costume mark on a non-watch
      // jewelry piece: costume tier. Yellow-tone metal commonly mistaken for gold;
      // silver-tone commonly mistaken for sterling.
      if (resaleHigh > 30) {
        const scale = 30 / resaleHigh;
        resaleHigh = 30;
        resaleLow = Math.max(5, Math.round(resaleLow * scale));
      }
    }
  }

  // Bag and sneaker authentication clamps. Mirror the jewelry designer-without-stamp
  // pattern. Skipped on isCustomScan (custom bags/sneakers have their own ALTERED
  // FACTORY BASE EXCEPTION caps in the prompt).
  const bagSneakerText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
  const isLuxuryBag = parsed.category === 'bags' && LUXURY_BAG_BRAND_RX.test(bagSneakerText);
  if (isLuxuryBag && !isCustomScan && !BAG_AUTH_STAMP_RX.test(bagSneakerText)) {
    // LV/Chanel/Hermès/Gucci silhouette without auth evidence: cap at the
    // unbranded designer-style ceiling. Genuine luxury claims require date code,
    // heat stamp, blind stamp, serial sticker, or interior brand plaque.
    if (resaleHigh > 300) {
      const scale = 300 / resaleHigh;
      resaleHigh = 300;
      resaleLow = Math.max(50, Math.round(resaleLow * scale));
    }
  }

  if (parsed.category === 'shoes' && !isCustomScan
      && SNEAKER_COLLAB_RX.test(bagSneakerText)
      && !SNEAKER_AUTH_RX.test(bagSneakerText)) {
    // Travis Scott / Off-White / Fragment / Sacai claim without SKU, box label,
    // or co-brand insole evidence: cap at base hyped ceiling. The reverse-swoosh
    // styling is the most replicated detail in sneaker fakes.
    if (resaleHigh > 250) {
      const scale = 250 / resaleHigh;
      resaleHigh = 250;
      resaleLow = Math.max(40, Math.round(resaleLow * scale));
    }
  }

  let correction: 'lower' | 'higher' | undefined;
  if (priorResult) {
    const priorLow = priorResult.suggestedResaleLow ?? 0;
    const priorHigh = priorResult.suggestedResaleHigh ?? 0;
    const priorMid = (priorLow + priorHigh) / 2;
    const newMid = (resaleLow + resaleHigh) / 2;
    if (priorMid > 0) {
      const threshold = Math.max(2, priorMid * 0.05);
      if (newMid < priorMid - threshold) correction = 'lower';
      else if (newMid > priorMid + threshold) correction = 'higher';
      // Within noise tolerance: no toast, new prices stand. The user explicitly
      // disagreed with the prior estimate — don't lock them back to it.
    }
  }

  if (resaleLow > resaleHigh) [resaleLow, resaleHigh] = [resaleHigh, resaleLow];
  const resale = resaleLow > 0 ? roundDisplayPrice((resaleLow + resaleHigh) / 2) : 0;

  return {
    name: String(parsed.name || 'Unknown Item'),
    sub: String(parsed.sub || ''),
    profit: resaleLow > 0 ? `${formatMoney(resaleLow)}–${formatMoney(resaleHigh)}` : '',
    suggestedPaid: paid,
    suggestedResale: resale,
    suggestedResaleLow: resaleLow,
    suggestedResaleHigh: resaleHigh,
    isCustom: parsed.isCustom === true || detectCustomFromText(parsed.name, parsed.sub),
    category: VALID_CATEGORIES.includes(parsed.category as ItemCategory)
      ? (parsed.category as ItemCategory)
      : 'other',
    // Furniture, jewelry, and luxury bags have legitimately wide tier ranges
    // (vintage walnut credenza $80–$2000; solid gold tier $40–$700+; LV monogram
    // $100–$1700) that are not low confidence — just by-karat-by-weight,
    // sparse-comps, or model-dependent reality. Skip the range-width downgrade
    // for these. The hallmark / auth-stamp HARD RULES govern confidence on those
    // categories (stamp absence = AI should set 'low' itself).
    confidence: parsed.category === 'furniture' || isJewelry || isLuxuryBag
      ? (['high', 'medium', 'low'].includes(parsed.confidence as string)
          ? (parsed.confidence as 'high' | 'medium' | 'low')
          : 'low')
      : confidenceFromRangeWidth(
          ['high', 'medium', 'low'].includes(parsed.confidence as string)
            ? (parsed.confidence as 'high' | 'medium' | 'low')
            : 'low',
          resaleLow,
          resaleHigh,
        ),
    ideas: Array.isArray(parsed.ideas)
      ? parsed.ideas.slice(0, 3).map((idea: Record<string, unknown>) => ({
          e: '',
          t: String(idea.t || ''),
          p: String(idea.p || ''),
          ideaIcon: String(idea.ideaIcon || 'pricetag'),
        }))
      : [],
    upcycle: Array.isArray(parsed.upcycle)
      ? parsed.upcycle.slice(0, 3).map((u: unknown) => String(u || '')).filter(Boolean)
      : [],
    authFlags: Array.isArray(parsed.authFlags)
      ? parsed.authFlags.slice(0, 3).map((f: unknown) => String(f || '')).filter(Boolean)
      : [],
    redFlags: Array.isArray(parsed.redFlags)
      ? parsed.redFlags.slice(0, 3).map((f: unknown) => String(f || '')).filter(Boolean)
      : [],
    beforeAfterDetected: beforeAfter,
    ...(correction ? { correction } : {}),
  };
}

export async function scanWithGemini(photoUris: string | string[], signal?: AbortSignal, onPhaseChange?: (status: string) => void, priorResult?: ScanScenario): Promise<ScanScenario> {
  const uris = Array.isArray(photoUris) ? photoUris : [photoUris];
  const suffix = priorResult ? RESCAN_CORRECTION_SUFFIX(priorResult) : '';
  return runScanPipeline(uris, suffix, signal, priorResult);
}

function buildUpcyclePrompt(itemName?: string, category?: string, sub?: string): string {
  const itemContext = itemName
    ? `\nThe item is: ${itemName}${category ? ` (category: ${category})` : ''}${sub ? `. Description: ${sub}` : ''}.`
    : '';

  return `You are a fashion-forward thrift upcycler known for transformations that feel surprising, specific, and trend-aware. Look at this item and suggest 3 ways to transform it.
${itemContext}
Before writing anything, answer these questions internally:
1. What is this item made of — exact material, weight, and texture?
2. What details does it have — hardware, seams, collar, cuffs, lining, print, silhouette?
3. What era or subculture does it reference — workwear, Y2K, vintage prep, 90s grunge, etc.?
4. What niche aesthetic or current resale trend could this specific item tap into if transformed?

Use those answers to generate 3 ideas that could ONLY apply to this exact item — not to any other item. Each idea should feel like it was written by someone who actually studied this specific photo, not someone brainstorming crafts in general.

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "upcycle": [
    "First transformation idea",
    "Second transformation idea",
    "Third transformation idea"
  ]
}

Rules:
- Each idea names a specific technique AND the niche aesthetic or trend it creates
- BANNED techniques — never suggest regardless of item: bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery. If you catch yourself writing one, delete it and think harder about what makes THIS item unique
- BANNED aesthetic defaults — do not use any of these unless the item is literally from that era/style and you can point to a specific visible detail that justifies it: cottagecore, floral, bohemian, coquette, fairy-tale, whimsical, romantic. If you catch yourself writing one of these, delete it and think of something more specific to this item
- Each of the 3 ideas must target a DIFFERENT aesthetic or subculture — never repeat the same aesthetic across the 3 ideas
- Each idea must be something you could only suggest because of what you see in this specific photo
- Keep each under 15 words
- Do not mention platforms or where to sell`;
}

export async function refreshUpcycleIdeas(
  photoUri: string,
  itemContext?: { name?: string; category?: string; sub?: string },
  signal?: AbortSignal
): Promise<string[]> {
  const { uri: readUri, mimeType } = await resolveReadableUri(photoUri);
  const base64 = await FileSystem.readAsStringAsync(readUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const prompt = buildUpcyclePrompt(itemContext?.name, itemContext?.category, itemContext?.sub);
  const parsed = await callWithFallback([{ base64, mimeType }], '', signal, prompt, 0.9);
  return Array.isArray(parsed.upcycle)
    ? parsed.upcycle.slice(0, 3).map((u: unknown) => String(u || '')).filter(Boolean)
    : [];
}

const HANDMADE_SUFFIX = `\n\nIMPORTANT: The user has confirmed this item IS handmade/custom. Set isCustom = true.
Pricing: price by FINISHED LOOK that an unknown maker actually sells for on Depop/Etsy/Poshmark. Do NOT use a labor-hour formula — unknown makers cannot command labor-rate pricing in a saturated handmade market, and labor math consistently overshoots actual sold comps by 30–80%. Default to unknown-maker tiers below; named established Etsy/Depop creators with documented sale history may exceed ceilings.
FIRST-PASS ANCHORING: within any tier band, DEFAULT to lower-middle (band low + 30% of band width), NOT the upper edge. Unknown-maker comps cluster at lower-middle. Reserve upper third for items with EXPLICIT upper-tier signals (named established creator, NWT/tags visible, documented vintage Big E/501XX base, exceptional construction keywords matched, mint condition).
CONDITION DEFAULT: assume "used-good" when condition is not explicitly visible. Visual cleanness ≠ excellent. Reserve top-of-range for visible tags or unmistakable mint condition. When unsure, used-good is safe.
suggestedPaid = materials cost estimate ($10–$60).
DEFAULT TIER LADDER (apply when no specific category exception below matches): simple (small, basic execution) $15–$45; moderate (mid-size, refined execution, on-trend aesthetic) $30–$80; complex (large, intricate technique, multi-stage construction) $60–$160. Hard ceiling $160 unknown maker; named established creators may reach $300.
CONDITION ADJUSTMENT: reduce both low and high by 30–50% for visible damage (stains, non-decorative holes, heavy pilling, fading, broken hardware, scuffed/peeling leather, tarnish). Reduce 15–25% for moderate wear. NWT/like-new commands the top of the range. Unclear condition = assume "used-good" and no adjustment.
DENIM EXCEPTION — if category = "denim": Upcycled jeans is saturated on Depop/Etsy and prices by finished look. Simple mods (crops/distress/basic patches/dye) $25–$55; moderate rework (panel swap, contrasting patchwork, studded) $45–$85; elaborate custom (intricate beading, franken-construction, verifiable vintage Big E/501XX base) $70–$140. Hard ceiling $140 unless the base is documented vintage Levi's Big E/501XX or maker is a named established creator (then cap $220). EXCEPTIONAL CONSTRUCTION OVERRIDE — rare case only: denim rebuilt into a new garment shape via woven/lattice patchwork, sculpted halter/corset/bustier, deconstructed couture-style assembly, or denim quilted into a wholly new silhouette: $150–$300. To unlock you MUST include at least one of "lattice", "woven denim", "sculpted", "corset", "bustier", "halter", "deconstructed", "couture", or "quilted denim" in the sub field. Without exceptional construction stay under $140.
FURNITURE EXCEPTION — if category = "furniture": Pricing = brand/era tier as base + 30–50% labor premium for skilled refinish/refurb work. Do NOT exceed the subcategory ceiling for the base piece — refinished IKEA stays under $120 regardless of effort. Particleboard $80 hard ceiling; refinish on particleboard adds $0 — call out as red flag if user invested labor in particleboard. Refinishing only meaningfully boosts pieces with quality bones (solid wood, MCM lines, antique structure). Authenticated MCM (Eames, Knoll, Wegner, Saarinen, Cassina, Vitra, Nakashima with visible label/stamp) refurbed: brand tier + 30–50% premium per main FURNITURE PRICING.
ALTERED FACTORY BASE EXCEPTION — if the item is a factory-made base (sneaker, top, jacket, bag, cap) with hand-added surface decoration (paint, patches, studs, hand embroidery, rhinestones) rather than from-scratch construction: Price = base brand tier + 30–60% customization premium. Caps: painted sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans) / $260 hyped silhouettes (Jordan, Dunk, Yeezy) — exceed only for named established artists. Altered tops (hoodies, tees, halter tops, tank tops, crop tops, blouses, camis) and jackets: $60 unbranded / $90 branded / $130 premium streetwear. Altered pants/trousers/joggers (NON-DENIM — for denim see DENIM EXCEPTION above): pants are a secondary canvas vs jackets and the resale ceiling is lower. Light paint/few patches $40–$70; skilled hand-painted or dense applique/embroidery $80–$140 unbranded / $100–$160 branded base; hard ceiling $180 unless the maker is a named established creator. Do NOT price altered pants in jacket tiers ($200+). Custom bags/caps: $40 unbranded / $80 branded. Altered dresses (NON-DENIM — for denim see DENIM EXCEPTION above): $40 to $200 ceiling, unless named established maker. Altered skirts (NON-DENIM — mini, midi, maxi): $30 to $140 ceiling. Altered shorts (NON-DENIM): $25 to $120 ceiling. Custom swimwear (swimsuit, bikini, one-piece, swimwear, trunks): $25 to $120 ceiling. Altered non-sneaker shoes (boots, heels, sandals, loafers): $40 to $200 ceiling. To unlock these bands you MUST include the relevant term ("skirt", "shorts", "bikini", "swim", "boots", "heels", "sandals", "loafers") in the "name" or "sub" field. This exception does NOT apply to from-scratch handmade (crochet, knit, sewn from raw fabric, fiber art).
HANDMADE OUTERWEAR EXCEPTION — handmade cardigans, dusters, knit/crochet jackets, hand-loomed coats, fiber-art outerwear (category = "outerwear" AND from-scratch handmade, not altered factory base): simple (basic granny-square cardigan, plain knit duster) $35–$80; moderate (intricate stitch pattern, mid-size, mosaic crochet, fitted construction) $55–$120; complex (multi-color tapestry crochet, hand-spun yarn, structured tailoring, large-format) $90–$180. Hard ceiling $180 unless named established maker.
HANDMADE DRESS EXCEPTION — non-denim, non-altered handmade dresses (category = "dresses" AND from-scratch, not altered factory base): simple (plain crochet/knit slip, basic sewn shift) $30–$70; moderate (cottagecore midi, fitted construction, lace trim, bias-cut sewn) $50–$120; complex (full-skirt crochet maxi, multi-panel sewn gown, smocked or boned construction) $90–$200. Hard ceiling $200 unless named established maker.
HANDMADE SKIRT EXCEPTION — non-denim, non-altered handmade skirts: simple $20–$50; moderate (granny-square midi, fitted maxi) $35–$85; complex (full-skirt crochet, multi-panel sewn) $65–$140. Hard ceiling $140 unless named established maker.
HANDMADE BAG EXCEPTION — from-scratch handmade bags (crochet, macrame, woven, hand-loomed, hand-stitched leather): simple (crochet pouch, macrame mini bag, basic clutch) $20–$50; moderate (mid-size crochet tote, market bag, woven shoulder bag) $35–$85; complex (large hand-loomed leather, structured macrame, hand-stitched designer-grade) $60–$140. Hard ceiling $140 unless named established maker.
HANDMADE ACCESSORY EXCEPTION (non-jewelry) — handmade scarves, hats, beanies, gloves, mittens, leg warmers, belts, hair accessories, headbands: simple (basic crochet beanie, plain scarf) $15–$40; moderate (intricate stitch, on-trend silhouette, fitted) $25–$70; complex (oversized hand-loomed, multi-color tapestry, named technique) $50–$120. Hard ceiling $120 unless named established maker.
HANDMADE FIBER-ART STANDALONE EXCEPTION — tapestry, wall hanging, weaving, blanket, throw, quilt, wall art, embroidery hoop art, punch-needle art (not garment): small (under 18", embroidery hoop, small wall art) $25–$80; medium (24–36", lap blanket, mid-size tapestry) $60–$160; large (large tapestry, full quilt, oversized weaving, statement piece) $120–$300. Hard ceiling $300 unless named established fiber artist.
HANDMADE TOP CEILING — for from-scratch crochet/hand-knit/knitwear/cottagecore/embroidered/mending tops (category = "tops"): hard ceiling $180 unless the maker is a named established creator. NOTE: bare "knit" or "knitted" describing fabric (jersey, stretchy knit, ribbed knit, ponte) is NOT this tier — that's factory knit fabric, route through HANDMADE SEWN-FABRIC TOP EXCEPTION below. This tier requires explicit handmade-craft signal: "hand-knit", "crochet", "knitwear", "yarn", etc.
HANDMADE SEWN-FABRIC TOP EXCEPTION — if the item is a from-scratch handmade or restructured top sewn or constructed from fabric (satin, silk, cotton, jersey, knit fabric, stretchy knit, ribbed knit, ponte, woven, polyester, rayon, viscose, chiffon, linen — NOT crochet, hand-knit, or knitwear): Sewn handmade tops on Depop/Etsy price by finished look. Tiers (calibrated to actual unknown-maker Depop sold comps): simple (basic tank, tee, cami, plain shape, basic crop, off-shoulder cut) $20–$45; moderate (fitted with detail — V-neck, ruching, lace trim, gathered waist, darts, dolman/wrap silhouettes, halter conversion from a tee) $30–$60; complex (tailored blouse, structured top, intricate seaming, French seams, boning, multi-panel construction) $50–$95. Hard ceiling $95 unless the maker is a named established creator with documented sales history. To unlock these bands you MUST include the relevant material term ("satin", "silk", "cotton", "knit fabric", "stretchy knit", "jersey", "sewn", "stitched", "fabric") in the "name" or "sub" field. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). A tee restructured into a dolman/halter/ruched/draped silhouette belongs in moderate ($30–$60).
HANDMADE JEWELRY EXCEPTION — if the item is handmade jewelry (wire-wrap pendants, polymer clay earrings, beaded necklaces, hemp/macrame chokers, resin pieces, hand-stamped metal, spoon/fork rings, friendship bracelets): IGNORE the metal-hallmark requirement. Tiers by complexity: simple (single bead/charm, basic wire-wrap, plain hand-stamped tag, friendship bracelet) $15–$40; moderate (multi-bead/stone, intricate wire-wrap, resin with inclusions, hand-stamped detailed, polymer clay set) $30–$80; complex (gemstone wire-wrap, micro-macrame, electroformed, sterling/copper base + cabochon stones, hand-fabricated metalsmithing) $60–$180. Hard ceiling $180 unless the maker is a named established Etsy/Depop creator with documented sale history. To unlock these bands you MUST include the relevant term ("wire-wrap", "polymer clay", "beaded", "macrame", "resin", "hand-stamped", "handmade", or a jewelry-type word like "earrings", "pendant", "necklace", "bracelet", "ring") in the "name" or "sub" field.
NO TRENDING BOOST — do NOT apply any "+20–30% trending handmade" or "uniqueness premium" markup. The tiers above are already calibrated for unknown-maker Depop comps. "Looks impressive" or "took a long time to make" are NOT reasons to exceed the unknown-maker ceiling — buyers price on finished look + maker reputation, not perceived effort.`;

const RESCAN_CORRECTION_SUFFIX = (prior: ScanScenario) => `\n\nIMPORTANT: This is a RESCAN. The user tapped "this scan is wrong" on your previous output for this exact photo. Your previous output was:
- name: "${prior.name}"
- sub: "${prior.sub}"
- category: "${prior.category ?? 'other'}"
- isCustom: ${prior.isCustom === true}
- beforeAfterDetected: ${prior.beforeAfterDetected === true}
- suggestedResaleLow: $${prior.suggestedResaleLow ?? 0}
- suggestedResaleHigh: $${prior.suggestedResaleHigh ?? 0}
- confidence: ${prior.confidence ?? 'low'}

Re-examine the photo with FRESH EYES. The user believes something is wrong — but did NOT say what. Consider what you may have missed:
1. BRAND — visible logo, label, or stitching you overlooked? Misidentified brand can swing price 3–10x.
2. CONDITION — pilling, stains, holes, fading, hardware damage that should pull price DOWN?
3. ERA / MATERIAL — vintage construction (single-stitch, union-made tag, chain-stitched hem), genuine leather, silk, cashmere, wool that should pull price UP?
4. CATEGORY — did you miscategorize? (e.g. dress called a top, denim called bottoms)
5. CUSTOM/HANDMADE — is this actually reworked/handmade in a way that changes the pricing tier?

Then return your normal JSON output PLUS one extra top-level field:
"correction": "lower" | "higher"

- "lower" — prior price was too HIGH; output new lower prices.
- "higher" — prior price was too LOW; output new higher prices.

The user explicitly flagged this scan as wrong. Commit to a direction. Do NOT echo the prior prices unchanged — re-examine brand, condition, era, material, and category, and let your verdict shift the price.`;

export async function rescanAsHandmade(photoUri: string, signal?: AbortSignal, priorResult?: ScanScenario): Promise<ScanScenario> {
  const suffix = HANDMADE_SUFFIX + (priorResult ? RESCAN_CORRECTION_SUFFIX(priorResult) : '');
  return runScanPipeline([photoUri], suffix, signal, priorResult);
}
