import * as FileSystem from 'expo-file-system/legacy';
import { ITEM_CATEGORIES, type ItemCategory, type ScanScenario } from '@/types/inventory';
import { formatMoney } from '@/utils/currency';

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

function detectCustomFromText(...fields: unknown[]): boolean {
  return fields.some((f) => typeof f === 'string' && CUSTOM_KEYWORDS.test(f));
}

/** Gemini 2.5 thinking can consume most of a small output budget; JSON never arrives. */
const MAX_OUTPUT_TOKENS = 16384;

const PROMPT = `You are an expert thrift reseller. Analyze this photo of a thrift store item.

Return ONLY a valid JSON object with this exact structure — no markdown fences, no explanation:
{
  "name": "Descriptive item name; prepend brand ONLY if a label/logo/tag is visibly readable in the photo",
  "sub": "Brief description (size guess, color, material, condition)",
  "category": "denim|bottoms|tops|dresses|outerwear|shoes|bags|accessories|other",
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
  "redFlags": ["Prominent warning about AI-generated prints or other red flags — see RED FLAG DETECTION rule"]
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
- BRAND IN NAME — HARD RULE: Only include a brand word in "name" if you can see an actual LOGO, WORDMARK, PRINTED TAG, EMBROIDERED LABEL, WOVEN LABEL, or STAMPED HARDWARE bearing that brand's text or recognized logomark, and it is legible enough to read. You must be able to point to the specific region of the photo where the brand marking appears. DO NOT infer brand from silhouette, cut, aesthetic, era, embellishment pattern, stitching style, fabric weight, hardware style, or resemblance to brands known for a similar look. Inference from aesthetic is a guess, not identification.
- COMMON HALLUCINATION TRAPS — do NOT assume these brands without a visible label:
  • Y2K low-rise flare jeans with rhinestone swirls, butterflies, crosses, or decorative back-pocket embellishments → NOT Vigoss, Miss Me, Rock Revival, Affliction, True Religion, Buckle, Silver Jeans, Grace in LA, or any "fashion denim" brand
  • Chunky white or beige sneakers → NOT Nike, Adidas, New Balance, Asics, Hoka, On Cloud
  • Brown/tan workwear jackets or double-knee pants → NOT Carhartt, Dickies, Wrangler, Duluth
  • Plain ringer tees, baby tees, or graphic tees → NOT Urban Outfitters, Brandy Melville, Abercrombie, Aeropostale
  • Tan trench coats → NOT Burberry
  • Flannel shirts → NOT Pendleton, LL Bean, Eddie Bauer
  • Gorpcore fleece or shell jackets → NOT Patagonia, Arc'teryx, North Face, Columbia
  • Square-toe knee-high boots → NOT Frye, Steve Madden, Jeffrey Campbell
- When no brand marking is visible, name the item by its distinctive features — silhouette, wash or color, material, era, embellishment, or notable construction. Examples: "Y2K Rhinestone Flare Jeans", "Dark Wash Low Rise Swirl-Embellished Flares", "Chunky Cream Dad Sneakers", "Tan Canvas Double-Knee Work Pants". Never use the word "generic" in the name.
- For upcycled or handmade items: the base garment's brand does NOT transfer to the upcycled piece unless the base brand's label is still visibly intact on the garment. Describe the upcycle itself, not a guessed source brand.
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- PRICING — mentally benchmark against comparable recently-sold listings on Depop, Poshmark, eBay, and Etsy before setting any price. Do not default to the low end of a range — price for what the item actually sells for in current market.
  PRICING DECISION — check isCustom first, then follow exactly ONE path. Do not mix paths. Your price output is final — there is no second pass to correct it, so commit fully to whichever path applies.

  ► IF isCustom = true → HANDMADE PRICING (use this path; ignore all factory brand tiers below). Apply this formula with confidence — do not blend with or anchor to factory price ranges:
    suggestedPaid: materials cost estimate ($10–$60)
    suggestedResaleLow = materials + (labor hrs × $15). Estimate labor hours by technique: simple mods/rework 1–2hr, intermediate crochet/knit/sewing 4–8hr, complex fiber art/tapestry/quilting 10–20hr.
    suggestedResaleHigh = materials + (labor hrs × $25) + 30% uniqueness premium. Trending handmade categories (crochet tops, visible mending on non-denim, handmade jewelry, polymer clay, tufting, punch needle) add another 20–30%. Benchmark against Etsy and Depop sold prices for similar handmade items — do not lowball handmade work.
    DENIM EXCEPTION — if category = "denim": IGNORE the labor-hour formula. The denim resale market prices the finished aesthetic, not hours of labor, and upcycled jeans is a saturated category on Depop/Etsy. Price by finished look: simple mods (crops, distress, basic patches, dye/bleach) $25–$55; moderate rework (panel swap, contrasting patchwork, decorative topstitching, studded) $45–$85; elaborate custom (intricate beading/embroidery, franken-construction, verifiable vintage Big E/501XX base, known creator) $70–$140. Hard ceiling: do not exceed $140 for upcycled denim unless the base is documented vintage Levi's Big E/501XX or the maker is a named established creator — in which case cap at $220. Do NOT apply the trending-handmade +20–30% boost to denim.
    ALTERED FACTORY BASE EXCEPTION — if the item is a factory-made base (sneaker, hoodie, t-shirt, jacket, bag, cap) with hand-added surface decoration (paint, patches, studs, hand embroidery, hand-painted design, rhinestones) rather than from-scratch handmade construction: IGNORE the labor-hour formula. Price = base brand tier as starting point + 30–60% customization premium for detail and craftsmanship. Hard caps: painted or customized sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans, Converse) / $260 for hyped silhouettes (Jordan 1/4, Dunk, Yeezy) — exceed only if the artist is a named established creator with documented resale history. Altered hoodies/tees/jackets: $60 unbranded / $90 branded / $130 premium streetwear or designer base. Custom bags/caps: $40 unbranded / $80 branded. Do NOT apply the trending-handmade +20–30% boost to altered factory bases. This exception does NOT apply to genuinely from-scratch handmade items (crochet, knit, sewn from raw fabric, fiber art) — those still use the labor-hour formula.

  ► IF isCustom = false → FACTORY ITEM PRICING (use this path; ignore handmade section above):
    suggestedPaid: typical thrift store shelf price ($3–$30). For jewelry: thrift stores often underprice precious metals/stones — if gold, gemstones, or designer marks are visible, suggestedPaid can be $5–$100+.
    suggestedResaleLow: realistic sold-price floor. Use these brand-tier benchmarks:
      Fast fashion (Shein, H&M, Zara, Forever 21): $10–$20
      Mall brands (Gap, J.Crew, Banana Republic, Abercrombie, Madewell): $18–$40
      Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): $25–$65
      Contemporary (Free People, Anthropologie, Reformation, Patagonia, Aritzia): $35–$90
      Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince): $45–$130
      Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada): $80–$500+
      Mass-market denim (Levi's 501/550/514/Wedgie, Wrangler, Lee, Old Navy, Gap denim): $15–$35
      Premium denim (7 For All Mankind, Citizens of Humanity, AG, Paige, Frame, Joe's — brand peaked ~2015, price conservatively): $25–$55
      Authenticated Y2K premium denim (True Religion big-stitch, Diesel, Rock Revival, Miss Me — check stitching and hardware): $35–$90
      Vintage Levi's Big E / 501XX / pre-1980s redline selvedge / vintage Wrangler Blue Bell: $60–$250+
      Luxury denim (Acne Studios, Balenciaga, Gucci, Balmain, Saint Laurent, R13): $80–$400+
      Unbranded or generic jeans: $12–$28
      Vintage (20+ years, good condition): add 30–60% over what comparable modern items sell for
      Unknown/unbranded: price by material quality, construction, and visual appeal — $10–$30
      Costume/fashion jewelry (no precious metal or stones, unbranded): $5–$20
      Sterling silver jewelry (925 stamp, with semi-precious stones — amethyst, turquoise, garnet, opal, citrine): $15–$60
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
    Platform context: Depop runs higher for Y2K, vintage, trendy aesthetics, and unique pieces; Poshmark higher for workwear, contemporary brands, and NWT items; eBay for sportswear, collectibles, authenticated luxury, and fine jewelry (especially with GIA certs or brand boxes); Etsy for handmade, vintage 20yr+, cottagecore/artisan aesthetics, and estate jewelry.
    Trend premiums (+20–40% to base): gorpcore/outdoor, quiet luxury, coquette, vintage collegiate, 90s minimalism, western/Americana, mesh/sheer, ballet/balletcore. Apply when the item clearly fits.
    suggestedResaleHigh: best-case sold price, typically 40–60% above low. For hyped items (trending brand + trending aesthetic), can reach 2x low.

  CONDITION ADJUSTMENT (applies to both handmade and factory): Reduce both suggestedResaleLow and suggestedResaleHigh by 30–50% for visible damage — prominent stains, non-decorative holes, heavy pilling, faded/washed-out color, stretched or warped necklines, broken zippers, missing buttons, loose stitching, scuffed/cracked/peeling leather, yellowed whites, broken or cloudy hardware, tarnish on jewelry. Reduce by 15–25% for moderate wear — minor pilling, slight fading, small spots, faint creases, light patina. NWT or like-new condition (crisp fabric, intact hardware, no visible wear, original tags) commands the top of the range. When condition is unclear from the photo, assume "used-good" and make no adjustment. Never apply condition bonuses above the tier ceiling.
- ideas[].t = short, actionable tip (no price amounts)
- If multiple items are visible, identify only the most prominent one
- If the photo appears to be AI-generated, a screenshot, or not a real physical item, set name to "Not a real item" and confidence to "low"
- For Sanrio characters (Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, etc.) or other collectible character brands, the bundle idea should suggest pairing with related items from the same universe — e.g. "Bundle with other Sanrio items for a themed lot — character bundles sell 30-50% higher on Depop"
- authFlags: 0–3 short authenticity checks ONLY for items where counterfeits commonly exist:
  luxury brands (Louis Vuitton, Gucci, Chanel, Prada, Burberry, Hermès, Dior, Fendi, Balenciaga, Saint Laurent),
  designer goods (Coach, Kate Spade, Tory Burch, Michael Kors, Marc Jacobs),
  brand-name sneakers (Nike Dunk, Jordan, Yeezy, New Balance 550/2002R),
  designer sunglasses, premium denim (True Religion, Diesel), branded watches, precious stones/fine jewelry.
  Each flag = a specific, actionable physical check the buyer can do in-store — e.g.:
  "Check stitching evenness — authentic LV uses single continuous thread, no loose ends"
  "Verify heat stamp depth and font — counterfeits have shallow or inconsistent stamping"
  "Look for a date code inside the interior pocket or under the flap"
  "Inspect zipper pulls — should be branded hardware with smooth action, no rough edges"
  "Feel the leather — genuine should be supple with natural grain, not plasticky or uniform"
  "Check for hallmarks inside the band or clasp — 10k/14k/18k/750/925/PLAT stamps indicate real precious metal"
  "Examine stones closely — real gemstones have natural inclusions; glass and CZ appear flawless and overly brilliant"
  "Test metal weight — genuine gold and platinum feel noticeably heavier than plated or costume metals"
  Empty array [] for: unbranded items, fast fashion, mall brands, handmade items, basic athletic wear, or anything where counterfeits are uncommon.
  Frame as verification tips, not accusations — the goal is to help the buyer verify before purchasing.
- RED FLAG DETECTION — HARD RULE — populate redFlags (1–2 items) when ANY of the following are true. This is NOT optional — if ANY condition matches, you MUST include at least one redFlag. Empty array [] ONLY when zero conditions match.

  UPCYCLE EXEMPTION — evaluate before any other red flag rule: If isCustom = true (per the isCustom criteria above), treat unusual visual qualities of the GARMENT as expected features of handmade work, NOT as red flags. Frankensteined/patchwork/reconstructed garments legitimately combine mismatched fabric panels, clashing prints, jarring color blocks, asymmetric construction, and logos spliced with unrelated textiles — that IS the craft, not a red flag. Do not return "All-over sublimation print" or the "stock-photo" sentinel for upcycled garments whose "weirdness" comes from the upcycle itself. This exemption does NOT waive the text-garbling, anatomical-impossibility, or diffusion-smearing tells — those remain red flags regardless of isCustom.

  ALL-OVER DIGITAL PRINT: The garment has an all-over sublimation or digital print covering most of its surface WITH PICTORIAL CONTENT — tattoo flash art, paintings, illustrations, photorealistic imagery, anime stills, meme/bootleg-style graphic collage, or AI-looking artwork printed on cheap polyester. These are almost always mass-produced dropship items.
    Do NOT flag classic textile repeats — ditzy florals, cherry/fruit prints, gingham, houndstooth, polka dots, stripes, checks, paisleys, toile, geometric tile repeats, bandana patterns, animal prints, simple all-over logo monograms. These are traditional woven or printed fabrics that have existed for decades, not dropship sublimation.
    → Flag: "All-over sublimation print — commonly mass-produced. Check label for brand, artist credit, and material quality before buying."
  AI-GENERATED ARTWORK: The printed design on the garment shows ANY visual signs of AI generation:
    • Text in the design that is garbled, misspelled, fused, or nonsensical
    • Human figures with anatomical errors — extra/missing fingers, melted faces, impossible limbs
    • Elements that dissolve or blend into each other without logical boundaries
    • Photorealistic art style with no visible artist credit, brand, or studio name
    If ANY of these tells are present → Flag: "Artwork on this garment shows signs of AI generation — verify source and artist attribution before reselling."
  AI-GENERATED PHOTO: The photo itself — not the garment's printed design — was generated by an AI model rather than taken with a real camera. Only flag when one or more of these specific AI generation artifacts are clearly visible:
    • Diffusion/smearing artifacts: areas of the image that look melted, smeared, or dissolved rather than sharply rendered
    • Impossible or physically inconsistent shadows — shadows that point in multiple directions, float, or have no logical light source
    • Background geometry that is physically impossible or "painterly" in a way no camera could produce
    • Garment edges that bleed, feather, or dissolve into the background without a clean transition
    • Fabric texture that looks CG-rendered — unnaturally perfect, plastic-like, or with repeating neural-network patterns
    • Garbled, fused, or nonsensical text anywhere in the image environment (not on the garment's own design)
    • Anatomical impossibilities if a person is shown — wrong number of fingers, melted facial features, impossible limbs
    Do NOT flag based on how the GARMENT itself looks — mismatched fabrics, patchwork panels, Frankensteined construction, clashing prints, unusual silhouette, or logos spliced with unrelated fabrics are features of real upcycled/handmade clothing, not AI photo artifacts.
    Do NOT flag: professional product photography, brand catalog shots, flat lays, model photos, screenshots from TikTok/Instagram or other social media (including images with visible social media UI like like/comment/share icons, usernames, or captions), video stills, or any image that could have been taken by a real camera regardless of how polished it looks.
    For AI-GENERATED PHOTO specifically, do NOT err on the side of flagging — require at least one specific artifact from the list above. Real camera photos of upcycled or unusual clothing are common; AI-generated photos of clothing on real humans are rare.
    If genuine AI generation artifacts are present → add the string "stock-photo" to redFlags (no other text — this is an internal trigger only).
  When in doubt about whether a PRINT ON THE GARMENT is AI-generated (AI-GENERATED ARTWORK branch only), ERR ON THE SIDE OF FLAGGING. A false positive on a print is less harmful than a false negative. This erring applies ONLY to the artwork branch — it does NOT apply to ALL-OVER DIGITAL PRINT (require pictorial content) or AI-GENERATED PHOTO (require specific camera artifacts).
- upcycle[]: exactly 3 short, specific ideas for transforming this item to increase resale value. Before writing, identify: (1) exact material and texture, (2) specific construction details like hardware, seams, collar, lining, silhouette, (3) the era or subculture it references, (4) what niche aesthetic or current resale trend it could tap into if transformed. Use those observations to write ideas that could ONLY apply to this exact item — not any other. Each idea names a specific technique AND the niche aesthetic it creates. BANNED techniques regardless of item: bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery — if you catch yourself writing one, think harder about what makes this item unique. BANNED aesthetic defaults — do not use any of these unless the item is literally from that era/style and you can point to a specific visible detail that justifies it: cottagecore, floral, bohemian, coquette, fairy-tale, whimsical, romantic. If you catch yourself writing one of these aesthetics, delete it and think of something more specific to this item. Each of the 3 ideas must target a DIFFERENT aesthetic or subculture — never repeat the same aesthetic across the 3 ideas. Keep each under 15 words. Do not mention platforms or where to sell. Do not say "not applicable"`;

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

async function runScanPipeline(photoUris: string[], promptSuffix = '', signal?: AbortSignal): Promise<ScanScenario> {
  const resolved = await Promise.all(photoUris.map(uri => resolveReadableUri(uri)));
  const images = await Promise.all(
    resolved.map(async ({ uri, mimeType }) => ({
      base64: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
      mimeType,
    }))
  );

  const multiPhotoSuffix = images.length > 1
    ? '\n\nYou are given multiple photos of the SAME item (e.g. front, back, label). Use all photos together to identify the item more accurately. Do not treat them as separate items.'
    : '';

  const parsed = await callWithFallback(images, promptSuffix + multiPhotoSuffix, signal);

  const paid = Number(parsed.suggestedPaid) || 10;
  let resaleLow = Number(parsed.suggestedResaleLow) || 0;
  let resaleHigh = Number(parsed.suggestedResaleHigh) || resaleLow;

  const isDenim = parsed.category === 'denim';
  const isCustomScan = parsed.isCustom === true || detectCustomFromText(parsed.name, parsed.sub);
  if (isDenim && isCustomScan && resaleHigh > 140) {
    const scale = 140 / resaleHigh;
    resaleHigh = 140;
    resaleLow = Math.max(25, Math.round(resaleLow * scale));
  }

  if (resaleLow > resaleHigh) [resaleLow, resaleHigh] = [resaleHigh, resaleLow];
  const resale = resaleLow > 0 ? Math.round((resaleLow + resaleHigh) / 2) : 0;

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
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence as string)
      ? (parsed.confidence as 'high' | 'medium' | 'low')
      : 'low',
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
  };
}

export async function scanWithGemini(photoUris: string | string[], signal?: AbortSignal, onPhaseChange?: (status: string) => void): Promise<ScanScenario> {
  const uris = Array.isArray(photoUris) ? photoUris : [photoUris];
  return runScanPipeline(uris, '', signal);
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
Pricing: estimate labor hours by complexity (simple mods/rework 1–2hr, intermediate crochet/knit/sewing 4–8hr, complex fiber art/tapestry 10–20hr). suggestedPaid = materials cost estimate. suggestedResaleLow = materials + (labor hrs × $15). suggestedResaleHigh = materials + (labor hrs × $25) + 30% uniqueness premium. Trending handmade (crochet tops, visible mending on non-denim, cottagecore, handmade jewelry, polymer clay earrings, tufting, punch needle) adds 20–30% more. Benchmark against Etsy and Depop sold prices for similar handmade items — do not lowball handmade work.
CONDITION ADJUSTMENT: reduce both low and high by 30–50% for visible damage (stains, non-decorative holes, heavy pilling, fading, broken hardware, scuffed/peeling leather, tarnish). Reduce 15–25% for moderate wear. NWT/like-new commands the top of the range. Unclear condition = assume "used-good" and no adjustment.
DENIM EXCEPTION — if category = "denim": IGNORE the labor-hour formula. Upcycled jeans is saturated on Depop/Etsy and prices by finished look, not labor hours. Simple mods (crops/distress/basic patches/dye) $25–$55; moderate rework (panel swap, contrasting patchwork, studded) $45–$85; elaborate custom (intricate beading, franken-construction, verifiable vintage Big E/501XX base) $70–$140. Hard ceiling $140 unless the base is documented vintage Levi's Big E/501XX or maker is a named established creator (then cap $220). Do NOT apply the trending-handmade +20–30% boost to denim.
ALTERED FACTORY BASE EXCEPTION — if the item is a factory-made base (sneaker, hoodie, t-shirt, jacket, bag, cap) with hand-added surface decoration (paint, patches, studs, hand embroidery, rhinestones) rather than from-scratch construction: IGNORE the labor-hour formula. Price = base brand tier + 30–60% customization premium. Caps: painted sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans) / $260 hyped silhouettes (Jordan, Dunk, Yeezy) — exceed only for named established artists. Altered hoodies/tops: $60 unbranded / $90 branded / $130 premium streetwear. Custom bags/caps: $40 unbranded / $80 branded. Do NOT apply the trending-handmade +20–30% boost to altered factory bases. This exception does NOT apply to from-scratch handmade (crochet, knit, sewn from raw fabric, fiber art).`;

export async function rescanAsHandmade(photoUri: string, signal?: AbortSignal): Promise<ScanScenario> {
  return runScanPipeline([photoUri], HANDMADE_SUFFIX, signal);
}
