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
const MAX_OUTPUT_TOKENS = 8192;

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
  ]
}

Guidelines:
- category: use "bottoms" for pants, leggings, joggers, athletic bottoms, shorts (non-denim); "denim" for jeans; "outerwear" for jackets and coats; "tops" for shirts, sweatshirts worn as tops, hoodies when not outerwear
- Include brand in name if clearly visible; if brand is unknown, describe by type, color, and material (e.g. "Black Cropped Hoodie" not "Generic Hoodie")
- Never use the word "generic" in the name field
- Be conservative with prices
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- isCustom detection — examine the item carefully for ANY sign of modification before deciding. Set isCustom = true if you see ONE OR MORE of these:
  • Hand-applied elements: fabric paint, puff paint, rhinestones, studs, patches sewn or ironed on, safety pins as decoration, beadwork, buttons added decoratively
  • Dye/color work: hand tie-dye (irregular spirals, uneven saturation), bleach splatter, bleach-dyed patterns, custom overdyeing, ombre dip-dye
  • Structural rework: cropped/cut hems (raw or unfinished edges), tapering, deconstruction/reconstruction, franken-pieces (two garments combined), asymmetric cuts
  • Surface decoration: hand-painted designs, screen prints that look DIY (slightly uneven, small-batch feel), hand embroidery (irregular stitch patterns vs machine-perfect), marker/pen artwork, block/lino prints (slight ink inconsistency, repeated motif with minor variations)
  • Distressing: hand-distressed holes/fraying (irregular placement, not factory-uniform), hand-sanded areas, patchwork repairs used as design
  • Handcrafted fiber arts: crochet (any gauge — granny squares, lace, amigurumi, bead crochet), hand-knit, macrame, weaving, punch needle, rug hooking, tufting (dense loop pile in non-industrial patterns), latch hook. These are ALWAYS isCustom = true
  • Visible mending and sashiko: Japanese-style running stitches in contrasting thread, decorative darning, patchwork repairs intended as design. Always isCustom = true
  • Leather and shoe customization: hand-tooled or pyrography-burned leather, hand-stitched leather goods (angled saddle stitch), hand-painted sneakers/shoes (paint on typically unpainted surfaces), custom-dyed leather or suede, spike/stud additions to boots
  • Handmade jewelry and accessories: wire-wrapped stones/crystals, resin jewelry (pressed flowers, pigment, glitter), polymer clay earrings/pendants, hand-stamped metal (hammer marks, slightly uneven letters), spoon/fork rings from bent flatware, friendship bracelets, beaded phone/bag straps
  • Upcycling indicators: mismatched fabric panels, visible re-stitching, non-original hardware, repurposed materials (e.g. curtain fabric as lining, blanket turned into garment, tablecloth into skirt, vintage quilt turned into jacket/coat, vintage tee cut into tote bag, denim patchwork from multiple washes, bandana fabric reworked into tops/scrunchies)
  Set isCustom = false for: factory distressing (uniform, repeated across units), mass-produced tie-dye (consistent patterns), standard brand embroidery, screen prints with barcode/SKU tags, machine-knit garments with uniform tension and factory tags, factory leather tooling (uniform depth, repeated pattern), mass-produced jewelry with brand markings
  When uncertain, lean toward isCustom = true — it's better to flag a potential custom piece than to miss one
- suggestedPaid = if isCustom is true, estimate total materials cost ($15–$60); otherwise, realistic thrift store price ($3–$30)
- suggestedResaleLow = conservative realistic resale price on Depop/Poshmark/eBay. If isCustom, factor in labor, uniqueness, and one-of-one appeal
- suggestedResaleHigh = optimistic realistic resale price (typically 30–50% above low). If isCustom, custom items typically sell for 2–4x materials cost — unique/viral-aesthetic pieces can go higher
- ideas[].t = short, actionable tip (no price amounts)
- If multiple items are visible, identify only the most prominent one
- If the photo appears to be AI-generated, a screenshot, or not a real physical item, set name to "Not a real item" and confidence to "low"
- For Sanrio characters (Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, etc.) or other collectible character brands, the bundle idea should suggest pairing with related items from the same universe — e.g. "Bundle with other Sanrio items for a themed lot — character bundles sell 30-50% higher on Depop"
- upcycle[]: exactly 3 short, specific ideas for customizing or transforming this item to increase its resale value. Each should name a concrete technique (e.g. bleach spiral, crop + raw hem, puff paint lettering, overdye, crochet trim, patch placement) and the resulting aesthetic (e.g. Y2K, cottagecore, vintage streetwear). Do not mention platforms or where to sell. Keep each under 15 words. Do not say "not applicable" — every item can be transformed`;

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

async function callGemini(base64: string, mimeType: string, promptSuffix = '', signal?: AbortSignal, promptOverride?: string): Promise<Record<string, unknown>> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: promptOverride ?? (PROMPT + promptSuffix) },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
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

async function callOpenAI(base64: string, mimeType: string, promptSuffix = '', signal?: AbortSignal, promptOverride?: string): Promise<Record<string, unknown>> {
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
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' } },
        ],
      }],
      temperature: 0.1,
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

async function runScanPipeline(photoUri: string, promptSuffix = '', signal?: AbortSignal): Promise<ScanScenario> {
  if (!GEMINI_KEY && !OPENAI_KEY) throw new Error('API key not configured');

  const { uri: readUri, mimeType } = await resolveReadableUri(photoUri);

  const base64 = await FileSystem.readAsStringAsync(readUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let parsed: Record<string, unknown> | null = null;

  // Try Gemini first (free), fall back to OpenAI on overload
  if (GEMINI_KEY) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        parsed = await callGemini(base64, mimeType, promptSuffix, signal);
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
    parsed = await callOpenAI(base64, mimeType, promptSuffix, signal);
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
  };
}

export async function scanWithGemini(photoUri: string, signal?: AbortSignal): Promise<ScanScenario> {
  return runScanPipeline(photoUri, '', signal);
}

const UPCYCLE_PROMPT = `You are an expert thrift reseller and DIY upcycler. Look at this thrift store item and suggest 3 creative ways to customize or transform it to increase its resale value.

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "upcycle": [
    "First transformation idea (technique + aesthetic)",
    "Second transformation idea using a different technique",
    "Third transformation idea using a different technique"
  ]
}

Guidelines:
- Each idea should name a concrete technique (e.g. bleach spiral, crop + raw hem, puff paint lettering, overdye, crochet trim, patch placement, distressing, embroidery) and the resulting aesthetic (e.g. Y2K, cottagecore, vintage streetwear, dark academia)
- Do not mention platforms or where to sell
- Keep each idea under 15 words
- Make all 3 ideas genuinely distinct from each other — different techniques, different aesthetics`;

export async function refreshUpcycleIdeas(photoUri: string, signal?: AbortSignal): Promise<string[]> {
  if (!GEMINI_KEY && !OPENAI_KEY) throw new Error('API key not configured');
  const { uri: readUri, mimeType } = await resolveReadableUri(photoUri);
  const base64 = await FileSystem.readAsStringAsync(readUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  let parsed: Record<string, unknown> | null = null;
  if (GEMINI_KEY) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        parsed = await callGemini(base64, mimeType, '', signal, UPCYCLE_PROMPT);
        break;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        if (!isOverloadError(err)) throw err;
        if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  if (!parsed && OPENAI_KEY) {
    parsed = await callOpenAI(base64, mimeType, '', signal, UPCYCLE_PROMPT);
  }
  if (!parsed) throw new Error('All providers failed');
  return Array.isArray(parsed.upcycle)
    ? parsed.upcycle.slice(0, 3).map((u: unknown) => String(u || '')).filter(Boolean)
    : [];
}

const HANDMADE_SUFFIX = `\n\nIMPORTANT: The user has confirmed this item IS handmade/custom. Set isCustom = true. Price accordingly — factor in labor, materials, uniqueness, and one-of-one appeal. Handmade items typically sell for 2–4x materials cost.`;

export async function rescanAsHandmade(photoUri: string, signal?: AbortSignal): Promise<ScanScenario> {
  return runScanPipeline(photoUri, HANDMADE_SUFFIX, signal);
}
