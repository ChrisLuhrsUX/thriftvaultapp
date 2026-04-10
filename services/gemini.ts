import * as FileSystem from 'expo-file-system/legacy';
import { ITEM_CATEGORIES, type ItemCategory, type ScanScenario } from '@/types/inventory';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

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
  "name": "Brand + Item Name",
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
  "authFlags": ["Specific physical check to verify authenticity (only for items prone to counterfeiting)"]
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
- Include brand in name if clearly visible; if brand is unknown, describe by type, color, and material (e.g. "Black Cropped Hoodie" not "Generic Hoodie")
- Never use the word "generic" in the name field
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- PRICING — mentally benchmark against comparable recently-sold listings on Depop, Poshmark, eBay, and Etsy before setting any price. Do not default to the low end of a range — price for what the item actually sells for in current market.
  suggestedPaid: typical thrift store shelf price ($3–$30) or materials cost if isCustom ($10–$60). For jewelry: thrift stores often underprice precious metals/stones — if gold, gemstones, or designer marks are visible, suggestedPaid can be $5–$100+.
  suggestedResaleLow: realistic sold-price floor. Use these brand-tier benchmarks:
    Fast fashion (Shein, H&M, Zara, Forever 21): $10–$20
    Mall brands (Gap, J.Crew, Banana Republic, Abercrombie, Madewell): $18–$40
    Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): $25–$65
    Contemporary (Free People, Anthropologie, Reformation, Patagonia, Aritzia): $35–$90
    Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince): $45–$130
    Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada): $80–$500+
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
  If isCustom: estimate labor hours by technique complexity — simple mods/rework 1–2hr, intermediate crochet/knit/sewing 4–8hr, complex fiber art/tapestry/quilting 10–20hr. Rate: $15–$25/hr. suggestedResaleLow = materials + (hours × $15). suggestedResaleHigh = materials + (hours × $25) + 30% uniqueness premium. Trending handmade categories (crochet tops, patchwork, visible mending, handmade jewelry, polymer clay) add another 20–30%. Benchmark against Etsy sold listings.
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
- upcycle[]: exactly 3 short, specific ideas for transforming this item to increase resale value. Before writing, identify: (1) exact material and texture, (2) specific construction details like hardware, seams, collar, lining, silhouette, (3) the era or subculture it references, (4) what niche aesthetic or current resale trend it could tap into if transformed. Use those observations to write ideas that could ONLY apply to this exact item — not any other. Each idea names a specific technique AND the niche aesthetic it creates. BANNED regardless of item: bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery — if you catch yourself writing one, think harder about what makes this item unique. Keep each under 15 words. Do not mention platforms or where to sell. Do not say "not applicable"`;

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
function isOverloadError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'overload' in err && (err as { overload?: boolean }).overload) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /API (429|503|529)/i.test(msg) || /overloaded|high demand|resource exhausted/i.test(msg);
}

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 4000]; // ms

async function callGemini(images: Array<{ base64: string; mimeType: string }>, promptSuffix = '', signal?: AbortSignal, promptOverride?: string, temperature = 0.1): Promise<Record<string, unknown>> {
  const res = await fetch(GEMINI_URL, {
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

async function callOpenAI(images: Array<{ base64: string; mimeType: string }>, promptSuffix = '', signal?: AbortSignal, promptOverride?: string, temperature = 0.1): Promise<Record<string, unknown>> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptOverride ?? (PROMPT + promptSuffix) },
          ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'low' } })),
        ],
      }],
      temperature,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty OpenAI response');
  return parseJsonFromModelText(text);
}

async function runScanPipeline(photoUris: string[], promptSuffix = '', signal?: AbortSignal): Promise<ScanScenario> {
  if (!GEMINI_KEY && !OPENAI_KEY) throw new Error('API key not configured');

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

  let parsed: Record<string, unknown> | null = null;

  // Try Gemini first (free), fall back to OpenAI on overload
  if (GEMINI_KEY) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        parsed = await callGemini(images, promptSuffix + multiPhotoSuffix, signal);
        break;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        if (!isOverloadError(err)) throw err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }
  }

  // Fallback to OpenAI if Gemini failed or unavailable
  if (!parsed && OPENAI_KEY) {
    parsed = await callOpenAI(images, promptSuffix + multiPhotoSuffix, signal);
  }

  if (!parsed) throw new Error('All scan providers failed');

  const paid = Number(parsed.suggestedPaid) || 10;
  const resaleLow = Number(parsed.suggestedResaleLow) || 0;
  const resaleHigh = Number(parsed.suggestedResaleHigh) || resaleLow;
  const resale = resaleLow > 0 ? Math.round((resaleLow + resaleHigh) / 2) : 0;

  return {
    name: String(parsed.name || 'Unknown Item'),
    sub: String(parsed.sub || ''),
    profit: resaleLow > 0 ? `$${resaleLow}–$${resaleHigh}` : '',
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
  };
}

export async function scanWithGemini(photoUris: string | string[], signal?: AbortSignal): Promise<ScanScenario> {
  const uris = Array.isArray(photoUris) ? photoUris : [photoUris];
  return runScanPipeline(uris, '', signal);
}

function buildUpcyclePrompt(itemName?: string, category?: string): string {
  const itemContext = itemName
    ? `\nThe item is: ${itemName}${category ? ` (category: ${category})` : ''}.`
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
- BANNED — never suggest regardless of item: bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery. If you catch yourself writing one, delete it and think harder about what makes THIS item unique
- Each idea must be something you could only suggest because of what you see in this specific photo
- All 3 ideas use different techniques and target different aesthetics
- Keep each under 15 words
- Do not mention platforms or where to sell`;
}

export async function refreshUpcycleIdeas(
  photoUri: string,
  itemContext?: { name?: string; category?: string },
  signal?: AbortSignal
): Promise<string[]> {
  if (!GEMINI_KEY && !OPENAI_KEY) throw new Error('API key not configured');
  const { uri: readUri, mimeType } = await resolveReadableUri(photoUri);
  const base64 = await FileSystem.readAsStringAsync(readUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const prompt = buildUpcyclePrompt(itemContext?.name, itemContext?.category);
  const images = [{ base64, mimeType }];
  let parsed: Record<string, unknown> | null = null;
  if (GEMINI_KEY) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        parsed = await callGemini(images, '', signal, prompt, 0.9);
        break;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        if (!isOverloadError(err)) throw err;
        if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  if (!parsed && OPENAI_KEY) {
    parsed = await callOpenAI(images, '', signal, prompt, 0.9);
  }
  if (!parsed) throw new Error('All providers failed');
  return Array.isArray(parsed.upcycle)
    ? parsed.upcycle.slice(0, 3).map((u: unknown) => String(u || '')).filter(Boolean)
    : [];
}

const HANDMADE_SUFFIX = `\n\nIMPORTANT: The user has confirmed this item IS handmade/custom. Set isCustom = true.
Pricing: estimate labor hours by complexity (simple mods/rework 1–2hr, intermediate crochet/knit/sewing 4–8hr, complex fiber art/tapestry 10–20hr). suggestedPaid = materials cost estimate. suggestedResaleLow = materials + (labor hrs × $15). suggestedResaleHigh = materials + (labor hrs × $25) + 30% uniqueness premium. Trending handmade (crochet tops, patchwork, visible mending, cottagecore, handmade jewelry, polymer clay earrings) adds 20–30% more. Benchmark against Etsy and Depop sold prices for similar handmade items — do not lowball handmade work.`;

export async function rescanAsHandmade(photoUri: string, signal?: AbortSignal): Promise<ScanScenario> {
  return runScanPipeline([photoUri], HANDMADE_SUFFIX, signal);
}
