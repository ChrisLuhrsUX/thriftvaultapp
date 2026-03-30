import * as FileSystem from 'expo-file-system/legacy';
import { ITEM_CATEGORIES, type ItemCategory, type ScanScenario } from '@/types/inventory';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const VALID_CATEGORIES: ItemCategory[] = ITEM_CATEGORIES;

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
  ]
}

Guidelines:
- category: use "bottoms" for pants, leggings, joggers, athletic bottoms, shorts (non-denim); "denim" for jeans; "outerwear" for jackets and coats; "tops" for shirts, sweatshirts worn as tops, hoodies when not outerwear
- Include brand in name if clearly visible; if brand is unknown, describe by type, color, and material (e.g. "Black Cropped Hoodie" not "Generic Hoodie")
- Never use the word "generic" in the name field
- Be conservative with prices
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- isCustom = true if the item appears handmade, reworked, custom-dyed, hand-painted, upcycled, bleached, distressed by hand, patchwork, embroidered with custom designs, or otherwise modified from its original form. false otherwise
- suggestedPaid = if isCustom is true, estimate total materials cost ($15–$60); otherwise, realistic thrift store price ($3–$30)
- suggestedResaleLow = conservative realistic resale price on Depop/Poshmark/eBay. If isCustom, factor in labor and uniqueness
- suggestedResaleHigh = optimistic realistic resale price (typically 30–50% above low). If isCustom, custom items typically sell for 2–4x materials cost
- ideas[].t = short, actionable tip (no price amounts)
- If multiple items are visible, identify only the most prominent one
- If the photo appears to be AI-generated, a screenshot, or not a real physical item, set name to "Not a real item" and confidence to "low"
- For Sanrio characters (Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, etc.) or other collectible character brands, the bundle idea should suggest pairing with related items from the same universe — e.g. "Bundle with other Sanrio items for a themed lot — character bundles sell 30-50% higher on Depop"`;

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

async function callGemini(base64: string, mimeType: string): Promise<Record<string, unknown>> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
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

async function callOpenAI(base64: string, mimeType: string): Promise<Record<string, unknown>> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
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

export async function scanWithGemini(photoUri: string): Promise<ScanScenario> {
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
        parsed = await callGemini(base64, mimeType);
        break;
      } catch (err) {
        if (!isOverloadError(err)) throw err;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }
  }

  // Fallback to OpenAI if Gemini failed or unavailable
  if (!parsed && OPENAI_KEY) {
    parsed = await callOpenAI(base64, mimeType);
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
    isCustom: parsed.isCustom === true,
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
  };
}
