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

// Jewelry detection + hallmark gates, keyword-routed, mirrors skirts/shorts/swimwear pattern.
const JEWELRY_RX = /\b(rings?|necklaces?|pendants?|chains?|earrings?|bracelets?|bangles?|cuffs?|brooches?|brooch|charms?|lockets?|chokers?|anklets?|watches?|watch|jewelry|jewellery)\b/i;
// Hard hallmark stamps that justify a metal-specific tier. "GP" / "GF" / "PLAT" need word
// boundaries to avoid bleeding into surrounding words. "Pin" intentionally NOT in JEWELRY_RX
// (too noisy, matches "safety pin" decorations on clothing).
const HALLMARK_RX = /\b(925|ster(ling)?|800|1\/20\s?gf|gf|gp|rgp|vermeil|10k|14k|18k|22k|24k|375|585|750|916|999|platinum|plat|950)\b/i;
const DESIGNER_JEWELRY_RX = /\b(tiffany|cartier|van\s+cleef|vca|bulgari|bvlgari|harry\s+winston|mikimoto|buccellati|boucheron|chopard|david\s+yurman|john\s+hardy|james\s+avery|kendra\s+scott|pandora|mejuri|catbird|maria\s+tash|aurate|brilliant\s+earth)\b/i;
// Signed vintage costume jewelry brands, separate tier ($20–$120 per prompt) from
// fine-jewelry designers above. Without this list, correctly-named "Trifari brooch"
// falls through to the no-hallmark $30 cap.
const SIGNED_COSTUME_RX = /\b(trifari|coro|weiss|haskell|eisenberg|hob[eé]|whiting\s*&?\s*davis|sarah\s+coventry|monet|napier|boucher|hattie\s+carnegie|kenneth\s+jay\s+lane|jelly\s+belly)\b/i;
// Stamp/signature evidence that the designer brand is actually present on the piece.
const DESIGNER_STAMP_RX = /\b(t&co|©\s?tiffany|tiffany\s*&\s*co|cartier\s+signature|ale\s+925|\bale\b|\bdy\b|\bjh\b|vca\s+\w+|bvlgari\s+stamp|hallmark|maker'?s?\s+mark|stamp(ed)?|signed|signature|engraved|serial)\b/i;
const WATCH_LUXURY_RX = /\b(rolex|omega|patek|audemars|piguet|\bap\b|cartier|vacheron|jaeger|jlc|breitling|iwc|panerai|hublot|richard\s+mille|tudor)\b/i;
// Full watch-brand allowlist used by the WATCH NAME CLAMP. Matches the KNOWN
// WATCH BRAND ALLOWLIST in the prompt. If `name` starts with a word that is
// neither on this list nor a generic descriptor, strip it as a probable
// watermark / box-text / band-engraving hallucination (ZUNAIRA, etc).
const WATCH_BRAND_RX = /^(rolex|omega|cartier|patek|philippe|audemars|piguet|iwc|breitling|vacheron|constantin|jaeger|lecoultre|jaeger-lecoultre|hublot|tudor|panerai|zenith|blancpain|grand\s+seiko|montblanc|chopard|piaget|breguet|nomos|bell\s+&\s+ross|bvlgari|girard-perregaux|ulysse\s+nardin|tag\s+heuer|tissot|hamilton|longines|oris|frederique\s+constant|raymond\s+weil|rado|citizen|seiko|bulova|movado|baume\s+&\s+mercier|junghans|maurice\s+lacroix|fossil|michael\s+kors|skagen|anne\s+klein|guess|dkny|diesel|armani|emporio\s+armani|daniel\s+wellington|mvmt|marc\s+jacobs|coach|kate\s+spade|tory\s+burch|olivia\s+burton|invicta|casio|g-shock|g\s+shock|gshock|timex|swatch|nixon|bertucci|apple\s+watch|garmin|fitbit|samsung|whoop|polar|suunto|withings|amazfit|huawei|mobvoi|ticwatch|disney|hello\s+kitty|sanrio|lego|marvel|dc|star\s+wars)\b/i;
// Generic watch descriptors that may legitimately lead the name.
const WATCH_DESCRIPTOR_RX = /^(gold|silver|rose|two|black|white|brown|blue|red|green|navy|stainless|titanium|ceramic|steel|leather|rubber|nylon|nato|metal|plastic|tan|cream|ivory|gunmetal|copper|bronze|pink|purple|yellow|vintage|modern|antique|classic|new|nwt|men|mens|women|womens|unisex|kids|boys|girls|small|large|oversized|mini|quartz|mechanical|automatic|digital|analog|smart|chronograph|chrono|diver|dive|field|pilot|aviator|dress|sport|sports|skeleton|tourbillon|moonphase|moon|day|date|gmt|tank|carrera|round|square|octagonal|cushion|tonneau)\b/i;
// Watch keyword detector: triggers the WATCH NAME CLAMP when a watch is filed
// under "accessories" (watches no longer have their own ItemCategory).
const WATCH_NAME_KEYWORD_RX = /\b(watch|wristwatch|chronograph|chrono|smartwatch|timepiece)\b/i;

// MCM designer brands. Authentic Saarinen Tulip / Knoll / Eames pieces use laminate as
// original construction, bypass particleboard clamp when these names appear.
const MCM_BRAND_RX = /\b(eames|knoll|herman\s+miller|wegner|saarinen|cassina|vitra|nakashima|jacobsen|breuer|le\s+corbusier|mies\s+van\s+der\s+rohe|nelson|florence\s+knoll|b&b\s+italia|poltrona\s+frau|minotti)\b/i;

// "MCM-style" indicators in name/sub. The MCM ATTRIBUTION HARD RULE directs the model
// to use this language when no maker label is visible, distinct from MCM_BRAND_RX which
// detects authenticated maker names backed by a visible label/sticker/stamp. Matching
// this regex (without also matching MCM_BRAND_RX) triggers the unattributed-MCM cap
// clamp in runScanPipeline ($300 unrestored / $450 with refurb).
const MCM_STYLE_RX = /\b(mcm[\s-]?style|mid[\s-]?century\s+(style|modern|inspired|replica)|eames[\s-]?style|in\s+the\s+(manner|style)\s+of|danish\s+modern|knoll[\s-]?style|saarinen[\s-]?style|wegner[\s-]?style|herman\s+miller[\s-]?style|nelson[\s-]?style|tulip[\s-]?style|shell[\s-]?style|womb[\s-]?style|barcelona[\s-]?style|jacobsen[\s-]?style)\b/i;

// Bag and sneaker authentication gates, same shape as the jewelry hallmark gate.
const LUXURY_BAG_BRAND_RX = /\b(louis\s+vuitton|\blv\b|chanel|herm[eè]s|gucci|prada|dior|fendi|goyard|balenciaga|saint\s+laurent|ysl|celine|bottega|loewe|valentino|givenchy|burberry)\b/i;
const BAG_AUTH_STAMP_RX = /\b(date\s+code|heat[\s-]?stamp|blind\s+stamp|serial(\s+(number|sticker))?|creed(\s+patch)?|authentication\s+card|stitch\s+count|interior\s+stamp|made\s+in\s+(italy|france|spain)|hallmark|maker'?s?\s+mark|stamp(ed)?|signed|signature|engraved|plaque|leather\s+tab)\b/i;
const SNEAKER_COLLAB_RX = /\b(travis\s+scott|off[\s-]?white|fragment|sacai|union\s+la|cact[uú]s\s+jack|salehe\s+bembury|comme\s+des\s+gar[cç]ons|cdg|virgil|jordan\s+x|dunk\s+x)\b/i;
const SNEAKER_AUTH_RX = /\b(sku|tongue\s+tag|box\s+label|inner\s+label|insole\s+(tag|branding)|stockx|goat|deadstock|legit\s+check|serial|cactus\s+jack\s+laces|reverse\s+swoosh\s+stitched)\b/i;

// Homewares detection for ceramics, art glass, antique metals, and clocks.
// Used by the isHandmadePottery / isCustomArtGlass clamps below the existing handmade
// clamps. Etsy is the primary marketplace anchor for these categories (unlike apparel
// where eBay dominates), so caps reflect Etsy sold-comp realities, not auction prices.
const POTTERY_RX = /\b(pottery|cerami(c|cs)|stoneware|porcelain|earthenware|redware|yellowware|salt[-\s]?glaze|terracotta|raku|wood[-\s]?fired|reduction[-\s]?fired|wheel[-\s]?thrown|hand[-\s]?thrown|hand[-\s]?built|coil(ed)?|teabowl|teapot|tea\s+bowl)\b/i;
const ART_GLASS_RX = /\b(murano|millefiori|art\s+glass|studio\s+glass|venetian\s+glass|lampwork|hand[-\s]?blown|blown\s+glass|paperweight|cane[\s-]?work)\b/i;
const SIGNED_GLASS_RX = /\b(murano|venini|seguso|barovier|moretti|salviati|lalique|loetz|daum|gall[eé]|tiffany|steuben|orrefors|kosta\s+boda|baccarat|waterford|iittala|chihuly)\b/i;
// Mid-grail + top-grail named ceramicists. Unlock $1500 cap when present;
// otherwise unsigned/unknown studio pottery caps at $200 per HOMEWARES PRICING.
const GRAIL_POTTER_RX = /\b(lucie\s+rie|hans\s+coper|peter\s+voulkos|beatrice\s+wood|toshiko\s+takaezu|bernard\s+leach|shoji\s+hamada|george\s+ohr|magdalene\s+odundo|edmund\s+de\s+waal|karen\s+karnes|warren\s+mackenzie|marguerite\s+wildenhain|maija\s+grotell|don\s+reitz|akio\s+takamori|betty\s+woodman|ron\s+nagle)\b/i;
// Condition language that should scale prices down regardless of tier.
// Mirrors tier 088 CONDITION PENALTIES (prompt-only) with a belt-and-suspenders
// 0.65× scale on the AI output when these tokens appear.
const POTTERY_CONDITION_PENALTY_RX = /\b(crazing|crazed|hairline(\s+crack)?|repaired(\s+break)?|chip(ped)?|cracked|glaze\s+loss|utensil\s+marks?|dishwasher\s+abrasion)\b/i;

// Handmade two-piece / coord set detection. A coord set is a single sold unit of two
// matching handmade garments (e.g. dress upcycled into top + skirt). Bare "set" is too
// broad (false-positive on "set of buttons", "sunset", "asset"); require either an
// explicit set keyword (two-piece, coord, matching set) OR a top+bottom garment-pair
// phrase ("top and skirt", "crop with shorts", etc.).
const COORD_SET_RX = /\b(two[\s-]?piece|2[\s-]?pc|co[\s-]?ord(inate(d)?)?(\s+set)?|matching\s+set)\b|\b(top|crop|tank|bandeau|tube|halter|bralette)\s+(and|\+|&|with|n')\s+(skirt|shorts|pants|mini|midi|trousers|joggers)\b|\b(skirt|shorts|pants|mini|midi|trousers|joggers)\s+(and|\+|&|with|n')\s+(top|crop|tank|bandeau|tube|halter|bralette)\b/i;

// Altered-dress fabric tier detection. Used by isAlteredDress to choose between the
// moderate ceiling ($80, basic-woven base) and the complex ceiling ($140, premium fabric
// or boned/lined construction). Plaid flannel sweetheart minis routinely landed at $85+
// when the cap was $140 across the board, even though Depop sold comps top out ~$75
// for basic-woven bases.
const BASIC_DRESS_FABRIC_RX = /\b(flannel|cotton|twill|chambray|jersey|linen|poplin|gingham|seersucker)\b/i;
const PREMIUM_DRESS_FABRIC_RX = /\b(silk|satin|velvet|lace|leather|wool|cashmere|sequin(ed|s)?|beaded|embroider(ed|y)|brocade|jacquard|tulle|organza|chiffon)\b/i;
const COMPLEX_DRESS_CONSTRUCTION_RX = /\b(boned|fully[\s-]?lined|multi[\s-]?fabric|french\s+seams|architectural|corset(ed)?|bustier|structured\s+bodice)\b/i;

// Red flag prefixes that signal a real-physical-item counterfeit (mass-produced replica,
// not an AI-generated listing photo). Any flag starting with one of these routes the UI
// to the "Possible knockoff" red banner with an "Authentic to you?"-style Yes/No prompt.
const RED_FLAG_KNOCKOFF_PREFIXES = [
  // Furniture
  'Verify maker stamp or label', // MCM KNOCKOFF
  // Jewelry
  'No karat stamp visible', // GOLD MASQUERADE
  'No 925 or sterling stamp visible', // STERLING MASQUERADE
  'Without a grading cert', // DIAMOND MASQUERADE
  'Iconic designer shape but', // DESIGNER KNOCKOFF
  // Bags / Sneakers
  'Iconic luxury bag shape but', // LUXURY BAG KNOCKOFF
  'Designer-bag shape but', // DESIGNER BAG KNOCKOFF
  'Monogram pattern breaks at seams', // SUPERFAKE SEAM TELL
  'Collab-specific styling but', // HYPED SNEAKER COLLAB KNOCKOFF
  // Garment AI / dropship: the printed graphic itself is dropship / AI-printed, but the
  // garment is a real physical mass-produced item, so this is knockoff-class, not
  // AI-listing-class. AI-listing is reserved for the stock-photo sentinel only (the
  // entire photo is AI-generated, item may not exist).
  'All-over sublimation print', // ALL-OVER DIGITAL PRINT
  'Artwork on this garment shows signs of AI generation', // AI-GENERATED ARTWORK
];

export type RedFlagKind = 'verification' | 'knockoff' | 'ai-listing';

// Three-way classifier:
//   verification → teal "Worth verifying" banner, single "Got it" dismiss. Default for
//                  condition cautions, refurb notes, hallmark-verify prompts, and any
//                  unrecognized string the model coins outside the named knockoff set.
//   knockoff     → red "Possible knockoff" banner, "Possible knockoff?" Yes/No prompt.
//                  Real physical mass-produced replica (MCM, luxury bag, sneaker collab,
//                  dropship sublimation print, AI-printed graphic on a real garment).
//   ai-listing   → red "Possible AI-generated photo" banner, "AI-generated photo?" Yes/No
//                  prompt. Triggered by the stock-photo sentinel only — the entire listing
//                  photo is AI-generated, the item may not exist as photographed. More
//                  severe risk than knockoff, so mixed (stock-photo + knockoff prefix)
//                  defaults to ai-listing.
export function classifyRedFlags(flags: string[] | undefined): RedFlagKind {
  if (!flags || flags.length === 0) return 'verification';
  if (flags.includes('stock-photo')) return 'ai-listing';
  if (flags.some((f) => RED_FLAG_KNOCKOFF_PREFIXES.some((p) => f.startsWith(p)))) {
    return 'knockoff';
  }
  return 'verification';
}

export type RedFlagPresentation = {
  kind: RedFlagKind;
  header: string;
  subtext: string;
  promptText: string; // empty for verification
  yesAccessibilityLabel: string; // empty for verification
  noAccessibilityLabel: string; // empty for verification
};

// Centralizes banner copy so detail.tsx and scan.tsx render the same strings. Add new
// flag-driven copy variants here; consumers branch on `kind` for the structural split
// (one-button "Got it" vs prompt + Yes/No).
export function getRedFlagPresentation(flags: string[] | undefined): RedFlagPresentation {
  const kind = classifyRedFlags(flags);
  switch (kind) {
    case 'knockoff':
      return {
        kind,
        header: 'Possible knockoff',
        subtext: 'Replicas of this design are mass-produced. Verify the maker stamp or label before paying authenticated prices.',
        promptText: 'Possible knockoff?',
        yesAccessibilityLabel: 'Yes, this looks like a knockoff',
        noAccessibilityLabel: 'No, looks authentic',
      };
    case 'ai-listing':
      return {
        kind,
        header: 'Possible AI-generated photo',
        subtext: 'This image shows signs of AI generation. The item may not exist as photographed.',
        promptText: 'AI-generated photo?',
        yesAccessibilityLabel: 'Yes, this photo looks AI-generated',
        noAccessibilityLabel: 'No, photo looks real',
      };
    case 'verification':
    default:
      return {
        kind: 'verification',
        header: 'Worth verifying',
        subtext: 'Inspect in person before paying high prices.',
        promptText: '',
        yesAccessibilityLabel: '',
        noAccessibilityLabel: '',
      };
  }
}

function detectCustomFromText(...fields: unknown[]): boolean {
  return fields.some((f) => typeof f === 'string' && CUSTOM_KEYWORDS.test(f));
}

// Wide price ranges = sparse comps. Downgrade only, never upgrade.
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

Return ONLY a valid JSON object with this exact structure, no markdown fences, no explanation:
{
  "name": "Descriptive item name; prepend brand ONLY if a label/logo/tag is visibly readable in the photo",
  "sub": "Brief description: estimated size if visible (e.g. \"Women's 8\", \"Men's L\", \"US 10\"), color, material, condition in plain language (e.g. \"new with tags\", \"like new\", \"good condition\", \"some wear\"; NEVER use reseller abbreviations like \"NWT\", \"NWOT\", \"VGUC\", \"EUC\", or \"BNIB\" in user-facing output, even though the internal pricing tiers reference these terms). Omit any field that can't be determined from the photo, never echo the field name as a placeholder.",
  "category": "denim|bottoms|tops|dresses|outerwear|shoes|bags|accessories|furniture|homewares|other",
  "isCustom": <boolean>,
  "suggestedPaid": <number>,
  "suggestedResaleLow": <number>,
  "suggestedResaleHigh": <number>,
  "confidence": "high|medium|low",
  "ideas": [
    {"t": "Listing/pricing suggestion", "ideaIcon": "pricetag"},
    {"t": "Photography or styling tip", "ideaIcon": "camera"},
    {"t": "Bundle or upsell idea (if item is already a bundle, suggest how to split or market it instead, never say 'not applicable')", "ideaIcon": "flame"}
  ],
  "upcycle": [
    "First distinct upcycle idea (technique + aesthetic)",
    "Second distinct upcycle idea using a different technique",
    "Third distinct upcycle idea using a different technique"
  ],
  "authFlags": ["Specific physical check to verify authenticity (only for items prone to counterfeiting)"],
  "redFlags": ["Prominent warning about AI-generated prints or other red flags, see RED FLAG DETECTION rule"],
  "beforeAfterDetected": <boolean, only relevant on multi-photo scans; see PHOTO INTERPRETATION rule. Default false on single-photo scans.>
}

CRITICAL, isCustom detection (evaluate FIRST before anything else):
Carefully examine the item for ANY sign it was handmade, modified, reworked, or upcycled. This is one of the most important fields, getting it wrong means the user misprices the item. When in doubt, set isCustom = true. Missing a handmade item is far worse than over-flagging.
CAPTION / OVERLAY EXEMPTION (evaluate first, do NOT infer isCustom from text alone): caption text, on-screen overlays, watermarks, hashtags, social-media chrome, or TikTok/Reels narrative text describing modification ("I made this", "DIY", "upcycle", "I altered this", "THEN I DID", "BEFORE / AFTER", "FIRST I... THEN I", "watch me transform", "look what I did", "from old to new", "from this to this", "POV: I made") do NOT trigger isCustom on their own. The GARMENT ITSELF must show physical evidence of hand-applied or restructured elements (raw cut edges, mismatched panels, hand-stitching, paint, dye work, etc.). Screenshots shared from TikTok, Reels, Pinterest, and resale apps frequently carry narrative captions with no visual correlate, the user is scanning the screenshot to price the dress they SAW, not to validate the narrator's claim. If you only see a clean factory garment with a caption claiming modification, isCustom = false.
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
  • Key visual tells for clothing upcycles: seams that don't match (different thread color/weight), hems at unexpected lengths, hardware that doesn't match the garment era/brand, fabric grain running in different directions on the same panel, waistbands added or removed WITH visible evidence of recent modification (raw or unfinished cut edges at the waistband join, mismatched thread color/weight at the seam, hand-finished topstitching, puckered or uneven attachment), collars reshaped, sleeves that don't match the body. EXCLUSION, factory subculture detailing: contrast or decorative waistbands (checkerboard, grosgrain, jacquard, studded, eyelet-laced), oversized D-rings, chain trim, ribbon-laced side panels, parachute/cargo straps, contrast piping on Y2K alt-fashion pants/skirts (Tripp NYC, Lip Service, Hot Topic Morbid line, and modern dropship/boutique revivals of those styles) are FACTORY-MANUFACTURED details with clean factory stitching at the join, NOT isCustom signals. These pants come with the contrast waistband from the factory. Do NOT set isCustom = true on the basis of the contrast waistband alone
Set isCustom = false ONLY when you are confident the item is entirely factory-made: factory distressing (uniform across units), mass-produced tie-dye (consistent patterns), standard brand embroidery, machine-knit with uniform tension and factory tags, mass-produced jewelry with brand stamps

WORK-IN-PROGRESS DETECTION, HARD RULE (evaluate AFTER isCustom; applies only when isCustom = true and the item is clothing or textile, NOT furniture or homewares which have their own refurb/refinish flows): A handmade item photographed on a dress form, mannequin, or sewing surface may be a finished sellable garment OR an UNFINISHED work-in-progress (WIP) that the maker is mid-construction on. WIP items are NOT yet sellable and must be flagged so the buyer doesn't mistake the photo for a listing of a complete piece.

WIP TELLS (require any TWO to confirm WIP; a single tell is ambiguous):
  • Dress form / tailor's mannequin context: exposed black/grey/cream fabric-covered torso showing through unfinished neckline or armhole, visible pin cushion attached to the form's collar, tape measure draped over the form, knob or stand visible at the base, no head/arms/legs (just torso). Dress forms are workshop equipment; finished resale listings use real models, hangers, or flat-lays.
  • Straight sewing pins inserted IN the fabric (small metal pins with colored or pearl heads piercing through cloth), particularly multiple pins clustered along seams, neckline, hem, waistband, or bodice. Decorative pin trim (uniformly arranged as pattern, sewn-on rhinestone or stud trim) is NOT this tell; the WIP tell is functional pins holding fabric in place during fitting or basting.
  • Safety pin used as a functional closure where a real closure (zipper, button, hook-and-eye, snap) belongs (front placket, side seam, back closure, neckline gap). Decorative safety-pin punk-aesthetic placement (clustered on a sleeve, lapel, pocket as a brooch, evenly arranged trim) is NOT this tell.
  • Raw thread tails hanging visibly from neckline, hem, sleeve cuff, or seam — distinguish from the clean cut edge of a "raw-hem cut-and-finish" intentional design (which has a single clean edge with zigzag or serged finish, no loose hanging tails).
  • Basting stitches visible: long, evenly-spaced contrast-thread temporary stitches (usually bright yellow, white, or contrasting color against the fabric), typically removed before the garment is finished.
  • Workshop / sewing-room background: sewing machine visible, ironing board, fabric scraps on the floor, multiple half-finished garments hanging in the frame, pattern paper, marking chalk on fabric, scissors or rotary cutter on a cutting mat.

When WIP is confirmed:
  • The "sub" field MUST describe the item as "work-in-progress, not yet finished" (or equivalent: "unfinished construction", "still being constructed"). Do NOT say "like new", "excellent", "good condition", or any term implying the item is sellable as-is.
  • Pricing returns the FINISHED value (what the garment will sell for when complete) per the relevant handmade tier; the buyer-user is the reseller planning resale, so the finished-value anchor is what they need.
  • Add to redFlags: "Finish construction before listing, visible pins, basting stitches, or safety-pin closures indicate unfinished work, not sellable as-is."

Guidelines:
- category: use "bottoms" for pants, leggings, joggers, athletic bottoms, shorts (non-denim); "denim" for jeans; "outerwear" for jackets and coats; "tops" for shirts, sweatshirts worn as tops, hoodies when not outerwear
- category "furniture": use for actual furniture, chairs, sofas/sectionals/loveseats, dining/coffee/side/console tables, desks, dressers/cabinets/bookshelves/nightstands/sideboards/credenzas/armoires, bed frames/headboards, outdoor patio furniture, and modern multi-function record-player cabinets. In the "name" field include the specific subtype (e.g. "Vintage Walnut Credenza", "MCM-Style Dining Chair").
- category "homewares": use for lighting (lamps, sconces, chandeliers), mirrors, rugs, ceramics and pottery (vases, sculpture, dinnerware, tableware, figurines, mugs, bowls, plates, studio pottery), glass and glassware (art glass, Murano, Tiffany, Loetz, Daum, drinkware, vessels), small antique metals (silver flatware, sterling, coin silver, pewter, brass, copper, bronze candleholders), clocks (mantel, wall, longcase, cuckoo, carriage), and other small decorative objects. In the "name" field include the specific subtype (e.g. "Vintage Brass Floor Lamp", "Persian Wool Rug", "Signed Studio Pottery Vessel", "Sterling Silver Flatware Set", "Antique Mantel Clock").
- category "accessories": use for jewelry, belts, hats, sunglasses, scarves, gloves, AND watches (wristwatch / pocket watch / smart-watch). For watches specifically, in the "name" field include silhouette / case material / complication subtype (e.g. "Gold-Tone Chronograph with Moon Phase", "Stainless Steel Diver", "Vintage Day-Date", "Two-Tone Quartz with Date Cyclops").
- BRAND IN NAME, HARD RULE: Only include a brand word in "name" if you can see an actual LOGO, WORDMARK, PRINTED TAG, EMBROIDERED LABEL, WOVEN LABEL, or STAMPED HARDWARE bearing that brand's text or recognized logomark, and it is legible enough to read. You must be able to point to the specific region of the photo where the brand marking appears. DO NOT infer brand from silhouette, cut, aesthetic, era, embellishment pattern, stitching style, fabric weight, hardware style, or resemblance to brands known for a similar look. Inference from aesthetic is a guess, not identification.
- JEWELRY HALLMARK, HARD RULE: Yellow-tone metal is NOT gold. Silver-tone metal is NOT sterling. Clear sparkly stones are NOT diamonds. To price a jewelry piece at a metal-specific tier (sterling, gold-filled, vermeil, solid gold, platinum), you MUST be able to see a readable hallmark stamp in the photo:
  • Silver: 925 / STER / STERLING / 800
  • Gold-filled or plated: 1/20 GF / GF / GP / RGP / vermeil / 925 with gold tone (vermeil = sterling base + gold layer)
  • Solid gold by karat: 10k / 14k / 18k / 22k / 24k / 375 / 585 / 750 / 916 / 999
  • Platinum: PLAT / 950 / 900
  Hallmarks live INSIDE ring bands, on necklace clasps and chain end-links, on earring posts and butterfly backs, on brooch and pin backs, and inside watch case-backs. When the photo doesn't show these surfaces, you cannot confirm metal, default to "yellow-tone metal" or "silver-tone metal" in the "name" field and price at the costume tier ($5–$20). Patina pattern is a SUPPORTING signal, not identification: brass turns greenish at touch points, gold-plated/vermeil wears through to silver/copper underneath at high-touch areas, sterling darkens and oxidizes (warm grey/black tarnish), stainless stays bright. Stamp absence = costume tier even when the piece looks high-quality. The same logic applies to designer maker stamps (T&Co, Cartier signature, ALE, DY, VCA): silhouette is NOT identification, see COMMON HALLUCINATION TRAPS for the specific patterns to watch for.
- WATCH BRAND, HARD RULE: To assert a watch brand in "name" (and to route to anything above the Fashion-watch tier of $20-$80), brand evidence MUST come from one of these surfaces in the photo:
  • A logo or wordmark on the DIAL (the watch face) legible enough to read.
  • A maker's stamp engraved on the CASE BACK or inside the case-back when visible.
  • A signed crown bearing the brand monogram (Rolex crown, Omega Ω, Audemars Piguet AP, Cartier C, Patek Calatrava cross).
  None of the following count as brand evidence: text printed or stamped on the watch BOX or packaging (boxes are sold separately and frequently rebranded by jewelers / resellers); watermarks or photo overlays (Instagram handles, watermarks, eBay seller stamps, Depop @username, social-media re-share text); decorative engravings on the BAND or BRACELET (often a jeweler's logo, owner's monogram, or store mark, not the watchmaker); the case material or color (gold-tone is not Rolex, two-tone is not Datejust); the bezel or dial silhouette (octagonal bezel, fluted bezel, cyclops date window, Roman-numeral dial, moon-phase subdial are styling choices, not brand identification); the strap material (rubber, leather, NATO are not brand). Without dial-or-case brand evidence, do NOT include any brand word in "name". Describe by silhouette + case material + complication ("Gold-Tone Octagonal Chronograph with Moon Phase", "Stainless Diver with Rotating Bezel", "Two-Tone Quartz with Date") and price at the Fashion-watch tier, NOT Mid or Luxury.

  KNOWN WATCH BRAND ALLOWLIST: ONLY the following brand names may appear in "name" when the item is a watch, and ONLY when dial-or-case evidence is present per the rules above. Any word in "name" that is not on this list and is not a generic descriptor (Gold-Tone, Silver-Tone, Two-Tone, Stainless, Vintage, Modern, Quartz, Mechanical, Automatic, Digital, Analog, Chronograph, Diver, Field, Pilot, Dress, Sport, Smart, Men's, Women's, Unisex, etc.) is a hallucination from in-frame watermark / box text / band engraving / social-media overlay and MUST be omitted:
  Luxury: Rolex, Omega, Cartier, Patek Philippe, Audemars Piguet, IWC, Breitling, Vacheron Constantin, Jaeger-LeCoultre, Hublot, Tudor, Panerai, Zenith, Blancpain, A. Lange & Söhne, Grand Seiko, Montblanc, Chopard, Piaget, Breguet, Nomos, Bell & Ross, Bvlgari, Girard-Perregaux, Ulysse Nardin.
  Mid-tier: Tag Heuer, Tissot, Hamilton, Longines, Oris, Frederique Constant, Raymond Weil, Mido, Rado, Citizen (Eco-Drive premium / Promaster), Seiko (Presage / Prospex / 5 Sports), Bulova, Movado, Baume & Mercier, Junghans, Maurice Lacroix.
  Fashion: Fossil, Michael Kors, Skagen, Anne Klein, Guess, DKNY, Diesel, Armani Exchange, Emporio Armani, Daniel Wellington, MVMT, Marc Jacobs, Coach, Kate Spade, Tory Burch, Olivia Burton, Invicta, Casio, G-Shock, Timex, Swatch, Nixon, Bertucci.
  Smart / tech: Apple Watch, Garmin, Fitbit, Samsung Galaxy Watch, Whoop, Polar, Suunto, Withings, Amazfit, Huawei Watch, Mobvoi TicWatch.
  Character / licensed: Disney, Hello Kitty, Sanrio, Lego, Marvel, DC, Star Wars (only when the licensed character is a printed dial graphic, not the watch maker's brand).
  Five-to-eight-letter ALL-CAPS words that don't match this list (e.g. ZUNAIRA, ZUNAIR, RAYMOND, JOSEPH, MARIA, etc.) are typically watermarks, jeweler shop names, or owner monograms and are NEVER watch brand names.
- BAG AUTHENTICATION, HARD RULE: To assert a luxury or designer bag brand in "name" or to price at the luxury tier ($500+), the photo MUST show specific authentication evidence:
  • Louis Vuitton: a date code stamped inside (FL/SD/CT/MI/SP + 4 digits in pre-2021 bags) OR the heat-stamped logo plate inside; on genuine pieces the monogram pattern flows continuously and never has cut letters at panel joins (cheap fakes show cut Ls/Vs at seams).
  • Chanel: serial sticker (8-digit, post-1984) inside flap pocket OR authentication card; quilting forms perfect interlocking diamonds with single-piece leather panels.
  • Hermès: blind stamp on inside near strap base (year letter inside box/circle/square + craftsman code); Birkin/Kelly require white saddle stitching with even, hand-pulled stitch count.
  • Goyard: hand-painted chevron pattern with subtle natural variation (dropship fakes are uniformly printed); "MAISON GOYARD" stamp on interior leather tab.
  • Coach: creed patch inside with a clean serial number engraved (vintage) or "COACH" + creed serial (modern); leather hangtag with "COACH" embossed.
  • Gucci: GG monogram alignment continuous at seams; "Made in Italy" interior stamp + serial dust-card; double-G logo plates have crisp engraving.
  • Prada: triangle-shaped metal logo plate with "PRADA Milano DAL 1913"; nylon "Vela" bags have engraved-zipper signature.
  • Dior: "Christian Dior PARIS Made in Italy" interior leather plaque, heat-stamped.
  Without this evidence, do NOT use the brand word in "name". Describe by silhouette/material instead ("Brown Monogram Canvas Tote", "Black Quilted Leather Flap Bag", "Tan Painted Chevron Tote"). Price at the unbranded designer-style tier ($60–$200), NOT the luxury tier. Box, dust-bag, or authenticity card alone is NOT proof, those are sold separately on resale.
- SNEAKER AUTHENTICATION, HARD RULE: For BASE hyped silhouettes (Jordan 1 / 4 / 11, Nike Dunk Low/High, Yeezy 350 / 700, NB 990 / 2002R / 550) the side-photo silhouette is sufficient to use the brand word in "name", these are widely recognizable and the existing tier ranges absorb legitimate spread. For COLLAB claims (Travis Scott, Off-White, Fragment, Sacai, Union LA, Cactus Jack, Salehe Bembury, Comme des Garçons) you MUST see specific evidence:
  • SKU code on inner tongue tag (e.g. "555088-XXX" for Jordan 1, "DD1391-XXX" for Dunk Panda)
  • Box label with matching SKU + colorway name
  • Insole branding ("AIR JORDAN", "Nike Air", "Yeezy", or co-brand signature)
  • StockX / GOAT verification tag if pre-authenticated
  Specific collab tells: Travis Scott Jordan 1 has reverse mini-swoosh with Cactus Jack-branded shoelace bag; Off-White has signature zip-tie + quotation marks ("AIR", "FOR NIKE"); Fragment has lightning-bolt insole; Sacai has dual-tongue, dual-swoosh stacking.
  Without collab-specific evidence, do NOT use the collab name in "name", describe as the base silhouette only ("Black/White Jordan 1 High", "Panda Dunk Low") and price at the base hyped tier, NOT the collab tier. Reverse-swoosh styling alone is the most replicated detail in sneaker fakes.
- COMMON HALLUCINATION TRAPS, do NOT assume these brands without a visible label:
  • Y2K low-rise flare jeans with rhinestone swirls, butterflies, crosses, or decorative back-pocket embellishments → NOT Vigoss, Miss Me, Rock Revival, Affliction, True Religion, Buckle, Silver Jeans, Grace in LA, or any "fashion denim" brand
  • Chunky white or beige sneakers → NOT Nike, Adidas, New Balance, Asics, Hoka, On Cloud
  • Brown/tan workwear jackets or double-knee pants → NOT Carhartt, Dickies, Wrangler, Duluth
  • Plain ringer tees, baby tees, or graphic tees → NOT Urban Outfitters, Brandy Melville, Abercrombie, Aeropostale
  • Tan trench coats → NOT Burberry
  • Flannel shirts → NOT Pendleton, LL Bean, Eddie Bauer
  • Gorpcore fleece or shell jackets → NOT Patagonia, Arc'teryx, North Face, Columbia
  • Square-toe knee-high boots → NOT Frye, Steve Madden, Jeffrey Campbell
  • JEWELRY look-alikes, these are heavily counterfeited and frequently misidentified by silhouette alone:
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
  • BAG look-alikes, luxury and designer bags are the most-counterfeited category on resale:
    – Brown LV-monogram canvas pattern → NOT Louis Vuitton without date code OR heat-stamp interior plate visible
    – Quilted leather chain bag (CC interlocking quilt diamond) → NOT Chanel without serial sticker visible
    – Trapezoid top-handle with padlock (Birkin) or rectangular with sangles (Kelly) → NOT Hermès without blind stamp visible
    – Brown C-monogram canvas → NOT Coach without creed patch + serial visible
    – Hand-painted chevron Y/V pattern → NOT Goyard without "MAISON GOYARD" stamp visible
    – Black nylon with triangle metal plate → NOT Prada without "PRADA Milano DAL 1913" + interior serial card
    – GG / FF / DD repeating logo canvas → NOT Gucci / Fendi / Dior respectively without authenticated stamp + serial
    – Cabas-style double-handle tote with red-painted edges → NOT Saint Laurent / Celine luggage without heat-stamp visible
  • SNEAKER COLLAB look-alikes, collab tier prices 2-3x over base hyped, hallucination is expensive:
    – Reverse mini-swoosh on Jordan 1 → NOT Travis Scott without Cactus Jack-branded laces / SKU label
    – Zip-tie or quotation-mark detailing → NOT Off-White without "for Nike" insole branding
    – Lightning-bolt accent → NOT Fragment without Hiroshi Fujiwara double-bolt insole
    – Dual-tongue / stacked-swoosh sneaker → NOT Sacai without Sacai/Nike co-brand insole
    – Reggae or rasta colorway 990 → NOT Salehe Bembury without "Salehe Bembury" tongue tag
  • VINTAGE GRAPHIC TEE look-alikes, modern repros mimic vintage tells. Require at least 3 of 4 together: single-stitch hem, blank or USA-made tag, no side seams (tubular), soft cracked print:
    – Modern band tee (Metallica, Nirvana, AC/DC, Pink Floyd) with side seams + double-stitched hems → NOT vintage tier; this is a modern repro at $15–$35
    – Modern Disney character tee (side seams, current Hanes/Gildan tag) → NOT vintage Disney tier; this is a current-production tee $8–$20
    – "Vintage-style" distressed graphic tee from Brandy Melville / Urban Outfitters / Forever 21 → NOT actual vintage; tag will read modern brand
  • FURNITURE PAIRED SETS, do NOT name companion items that aren't visibly photographed:
    – Eames Lounge Chair (670) silhouette WITHOUT ottoman (671) in any photo → name "Eames Style Lounge Chair" only, NOT "Eames Style Lounge Chair and Ottoman". The 670/671 pairing is the most common companion hallucination because the chair-and-ottoman set is iconic, but the pieces are routinely sold separately on resale. Adding "and Ottoman" / "with matching ottoman" / "and footstool" to a chair-only scan doubles the implied bundle price.
    – Chaise / sectional / dining set WITHOUT companion pieces in photos → name the photographed piece only ("Chaise Lounge", not "Chaise Lounge with Ottoman"; "Dining Table" not "Dining Table and Six Chairs")
    – Sofa + matching loveseat / armchair set: name only the piece(s) actually photographed, never both
    – Bedroom set: dresser, mirror, nightstand → photograph dictates the name; do not add "with matching dresser" / "and nightstand set" unless all pieces appear
  • SUNGLASSES look-alikes, designer eyewear is heavily counterfeited:
    – Black acetate Wayfarer-style frames → NOT Ray-Ban without "RB" lens etching + "Ray-Ban" temple text
    – Aviator metal frames → NOT Ray-Ban without "RB" lens etching + Ray-Ban hinge stamp
    – Sport wraparound frames → NOT Oakley without laser-etched "O" logo on lens + stamped Oakley on hinge
    – Round metal frames with logo → NOT Cartier / Versace / Gucci without temple etching + serial inside earpiece
    – Box, cleaning cloth, or branded case alone is NOT authentication, these are sold separately on resale
  • WATCH look-alikes, luxury watches drive 5-50x premium over fashion watches and hallucination is expensive. Brand must be readable on the DIAL or stamped on the CASE BACK:
    – Octagonal bezel with applied indices + baguette or brilliant-cut stones on the bezel → NOT Audemars Piguet Royal Oak without "AUDEMARS PIGUET" on the dial
    – Round case with date cyclops at 3 o'clock → NOT Rolex without crown logo + "ROLEX" wordmark on the dial
    – Two-tone yellow/silver bracelet with fluted bezel → NOT Rolex Datejust without dial wordmark + crown
    – Roman-numeral dial with blued steel hands → NOT Cartier Tank without "Cartier" wordmark on the dial
    – Moon-phase complication with multiple subdials → NOT Patek Philippe / Vacheron Constantin / Jaeger-LeCoultre without dial wordmark
    – Stainless diver with rotating bezel + cyclops → NOT Omega Seamaster / Submariner without dial wordmark
    – Chronograph with three subdials and tachymeter bezel → NOT Omega Speedmaster / Tag Heuer Carrera without dial wordmark
    – Text engraved on the band, bracelet, or visible on the watch BOX is NOT the watch brand; it is typically a jeweler, owner monogram, or reseller mark
    – Watermarks, social-media handles, and photo overlays are NEVER brand evidence regardless of how prominent
- When no brand marking is visible, name the item by its distinctive features, silhouette, wash or color, material, era, embellishment, or notable construction. Examples: "Y2K Rhinestone Flare Jeans", "Dark Wash Low Rise Swirl-Embellished Flares", "Chunky Cream Dad Sneakers", "Tan Canvas Double-Knee Work Pants". Never use the word "generic" in the name.
- For upcycled or handmade items: the base garment's brand does NOT transfer to the upcycled piece unless the base brand's label is still visibly intact on the garment. Describe the upcycle itself, not a guessed source brand.
- confidence = "low" if brand is obscure/niche or resale comps are sparse
- PRICING, mentally benchmark against comparable recently-sold listings on Depop, Poshmark, eBay, and Etsy before setting any price. Do not default to the low end of a range, price for what the item actually sells for in current market.
  PRICING DECISION, check isCustom first, then follow exactly ONE path. Do not mix paths. Your price output is final, there is no second pass to correct it, so commit fully to whichever path applies.

  ► IF isCustom = true → HANDMADE PRICING (use this path; ignore all factory brand tiers below). Price by FINISHED LOOK that an unknown maker actually sells for on Depop/Etsy/Poshmark. Do NOT use a labor-hour formula, unknown makers cannot command labor-rate pricing in a saturated handmade market, and labor math consistently overshoots actual sold comps by 30–80%. Default assumption is unknown maker; named established Etsy/Depop creators with documented sale history may exceed unknown-maker ceilings only when the creator name is explicitly visible/known.
    FIRST-PASS ANCHORING, within any tier band you select, DEFAULT to the lower-middle of the band (band low + 30% of band width), NOT the upper edge. Unknown-maker handmade sold comps cluster at lower-middle of every band on Depop/Etsy. Reserve the upper third of a band only for items showing EXPLICIT upper-tier signals: named established creator visibly identified, NWT or original tags visible, documented vintage Big E/501XX base, exceptional construction keywords matched, or unmistakable mint condition. For ambiguous items, lower-middle IS the sold-comp median. Example: HANDMADE DRESS moderate band $50–$120, default position $50–$85 (band low + 30% width), NOT $90–$120. The tier-band ceilings exist to cap inflated estimates, not to be the default landing point. The note on line 194 ("do not default to low end") applies to FACTORY items; for handmade, lower-middle IS the comp-aligned answer, not lowballing.
    CONDITION DEFAULT (handmade), assume "used-good" when condition is not explicitly visible. Visual cleanness from camera distance is NOT "excellent", most resale items photograph clean but have close-up pilling, fading, or thread wear. Reserve "excellent" or "NWT" pricing for visible original tags, factory creases, or unmistakable mint condition signals. When unsure, used-good is the safe assumption, overshooting condition is a top driver of first-pass overpricing.
    suggestedPaid: materials cost estimate ($10–$60).
    DEFAULT TIER LADDER (apply when no specific category exception below matches):
      Simple (small piece, basic execution, beginner-tier work, friendship-bracelet level): $15–$45
      Moderate (mid-size, refined execution, clear skill, on-trend aesthetic): $30–$80
      Complex (large, intricate technique, multi-stage construction): $60–$160
    Hard ceiling $160 for unknown makers via the default ladder. Named established creators may reach $300.
    DENIM EXCEPTION, if category = "denim": Upcycled jeans is saturated on Depop/Etsy and prices by finished look. Simple SUBTRACTIVE mods (DIY rips/holes/shredding/sanding/distressing, even when extensive or all-over, even when paired with a crop or bleach wash) $20–$40, these are the lowest-tier mods regardless of how much surface area is shredded. Subtractive labor is hours-without-skill and Depop DIY-ripped-jeans comps clear $25–$40 used-good. Do NOT promote dense distressing into a higher tier just because more of the leg is shredded; density of rips is not a craftsmanship signal. Simple ADDITIVE mods (basic iron-on patches, plain dye/bleach work, simple painted graphic) $25–$55; moderate rework (sewn-on patchwork panel, contrasting fabric inset, decorative topstitching, studded/grommet hardware) $45–$85; elaborate custom (intricate beading/embroidery, franken-construction, verifiable vintage Big E/501XX base, known creator) $70–$140. Hard ceiling: do not exceed $140 for upcycled denim unless the base is documented vintage Levi's Big E/501XX or the maker is a named established creator, in which case cap at $220. EXCEPTIONAL CONSTRUCTION OVERRIDE, rare case only: when denim is rebuilt into a new garment shape via woven/lattice patchwork, sculpted halter/corset/bustier, deconstructed couture-style assembly, or denim quilted into a wholly new silhouette, price $150–$300. To unlock this band you MUST include at least one of these exact words in the "sub" field so the band can be recognized: "lattice", "woven denim", "sculpted", "corset", "bustier", "halter", "deconstructed", "couture", or "quilted denim". Without exceptional construction stay under $140.
    ALTERED FACTORY BASE EXCEPTION, SURFACE DECORATION ONLY (paint, patches, studs, hand embroidery, hand-painted design, rhinestones, dye/bleach work) on a factory-made base (sneaker, top, jacket, bag, cap) where the original silhouette is preserved. STRUCTURAL ALTERATIONS (cropping, sleeve restructure, silhouette change, conversion to a different garment shape, e.g. button-up shirt → bolero/shrug/cardigan, tee → halter/dolman/tube/corset) do NOT belong here, route tops to HANDMADE SEWN-FABRIC TOP EXCEPTION below. Price = base brand tier as starting point + 30–60% customization premium for detail and craftsmanship. Hard caps: painted or customized sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans, Converse) / $260 for hyped silhouettes (Jordan 1/4, Dunk, Yeezy), exceed only if the artist is a named established creator with documented resale history. Altered tops (hoodies, tees, halter tops, tank tops, crop tops, blouses, camis) and jackets, DECORATION ONLY: light decoration (few patches, simple painted graphic, scattered studs) $25–$45 unbranded / $35–$60 branded; dense decoration (skilled hand-painted, dense applique/embroidery, allover rhinestones, multi-step custom work) $40–$70 unbranded / $55–$90 branded; premium streetwear or designer base may add $20–$40 over the branded number. Hard ceiling $130 even for premium-base items unless the artist is a named established creator. NOTE: "$X unbranded / $Y branded" are POINT ESTIMATES anchored to maker/base tier, they are NOT a range to span. Pick the tier that matches the item, then apply FIRST-PASS ANCHORING within that single tier's small spread. Altered pants/trousers/joggers (NON-DENIM, for denim see DENIM EXCEPTION above): pants are a secondary canvas vs jackets and the resale ceiling is lower. Light paint/few patches $40–$70; skilled hand-painted or dense applique/embroidery $80–$140 unbranded / $100–$160 branded base; hard ceiling $180 unless the maker is a named established creator with documented resale history. Do NOT price altered pants in jacket tiers ($200+). Custom bags/caps: $40 unbranded / $80 branded. Altered dresses (NON-DENIM, factory shirt/dress restructured into a new dress silhouette, for denim see DENIM EXCEPTION above): simple (single-seam restructure, basic neckline, plain shape, minimal added construction) $30–$50; moderate (sweetheart/V-neck/square/halter neckline, fitted bodice, structured seams, button-up flannel→dress with darts or sweetheart shaping, shirt-to-dress with one or two construction details) $50–$80; complex (multi-fabric pairing, intricate seaming, boned bodice, fully-lined construction, statement architectural details) $80–$140. Hard ceiling $140 unknown maker; named established maker may exceed. WORKED EXAMPLE: button-up plaid flannel shirt restructured into sweetheart-neckline fitted mini dress = MODERATE tier; default to lower-middle anchor ~$55–$60 per FIRST-PASS ANCHORING (band low + 30% width = $50 + $9 = $59), NOT upper-moderate $75+. Plaid flannel is a basic-tier base fabric on Depop, not a premium fabric like silk/satin/velvet; sweetheart neckline + fitted bodice on a flannel base is the moderate prototype, not an upper-moderate signal. Altered skirts (NON-DENIM, mini, midi, maxi): $30 to $140 ceiling. Altered shorts (NON-DENIM): $25 to $120 ceiling. Custom swimwear (swimsuit, bikini, one-piece, swimwear, trunks): $25 to $120 ceiling. Altered non-sneaker shoes (boots, heels, sandals, loafers): $40 to $200 ceiling. To unlock these bands you MUST include the relevant term ("skirt", "shorts", "bikini", "swim", "boots", "heels", "sandals", "loafers") in the "name" or "sub" field. This exception does NOT apply to genuinely from-scratch handmade items (crochet, knit, sewn from raw fabric, fiber art), those use the from-scratch category exceptions below.
    HANDMADE OUTERWEAR EXCEPTION, category = "outerwear" AND from-scratch handmade or fully-constructed upcycle (not surface-decoration-only on a factory base). Two sub-tracks, pick the one that matches construction type:

      (i) FIBER-ART OUTERWEAR, handmade cardigans, dusters, knit/crochet jackets, hand-loomed coats: simple (basic granny-square cardigan, plain knit duster) $35–$80; moderate (intricate stitch pattern, mid-size, mosaic crochet, fitted construction) $55–$120; complex (multi-color tapestry crochet, hand-spun yarn, structured tailoring, large-format) $90–$180.

      (ii) REPURPOSED-TEXTILE / SEWN-FABRIC OUTERWEAR, structured jackets, coats, blazers, shackets, or chore coats sewn from raw or repurposed fabric: blanket-to-jacket, quilt-to-coat, tablecloth-to-blazer, curtain-to-duster, bedsheet-to-jacket, towel-to-jacket, patchwork-panel jacket, frankenjacket from multiple sources. The labor floor is HIGHER than fiber-art simple tier because constructing a wearable lined jacket from raw fabric requires deconstructing the source textile, drafting a pattern, sewing through bulky/unusual weaves, and installing collar/sleeves/closure/lining. Minimum tier is MODERATE, do NOT use the simple band for this sub-track. Moderate (unlined or partially-finished, single source textile, basic collar/closure, cropped or simple silhouette) $55–$120; complex (lined or fully-finished interior, sherpa/quilted/satin lining, full seam finishing, structured collar, functional buttons/snaps/zip, multi-panel patchwork, cropped jacket from blanket fabric with sherpa lining, fully-constructed shacket) $90–$180. Hard ceiling $180.

      Within sub-track (ii), the FIRST-PASS ANCHORING rule above is RELAXED, anchor band mid-to-upper, not lower-middle. Depop sold comps for blanket-jackets, quilt-coats, and tablecloth-blazers cluster $90–$160, not the typical $50 handmade floor. A lower-middle anchor on this sub-track systematically underprices the category. Worked example: sherpa-lined cropped jacket constructed from plaid blanket fabric, with collar and button front = COMPLEX in sub-track (ii); anchor $130–$160, not $55–$85.

      Hard ceiling $180 either sub-track unless named established maker.
    HANDMADE COORD SET EXCEPTION, evaluate BEFORE the single-garment dress/skirt/top/pants exceptions below. A coord set is two coordinated handmade garments sold as a single unit (top + skirt, crop top + shorts, bandeau + mini, halter + pants, tube top + skirt, two pieces in the same fabric or matching print). The labor floor is HIGHER than any single-garment tier because TWO finished garments were constructed (deconstruct source if upcycle, draft two patterns, sew/finish both pieces, add lining or structured waistband on each). Detection: the "name" or "sub" must contain either an explicit set keyword ("set", "two-piece", "2pc", "coord", "coordinate", "coordinated", "matching set") OR pair a top-keyword with a bottom-keyword ("top and skirt", "crop with shorts", "bandeau + mini", "tube top and mini skirt"). Tiers (calibrated to actual unknown-maker Depop sold comps for handmade coord sets, typically chiffon/cotton/satin upcycles): simple (basic deconstruct + minimal finishing, plain shapes, no added lining) $40–$70; moderate (added solid stretch lining or base layer on one or both pieces, structured low-rise waistband, fitted/cropped silhouette, flounce or ruffle overlay, on-trend coquette/fairy/Y2K aesthetic) $55–$95; complex (multi-step finishing on both pieces, multiple coordinated details, multi-fabric pairing, statement construction) $80–$140. Hard ceiling $140 unknown maker; named established maker may reach $220. WORKED EXAMPLE: chiffon midi dress upcycled into strapless crop top + low-rise mini skirt with solid stretch lining base on both pieces = MODERATE coord set, anchor $60–$80 per FIRST-PASS ANCHORING (band low + 30% of width), reserve $85+ for explicit upper-tier signals.
    HANDMADE DRESS EXCEPTION, non-denim, non-altered handmade dresses (category = "dresses" AND from-scratch, not altered factory base): simple (plain crochet/knit slip, basic sewn shift) $30–$70; moderate (cottagecore midi, fitted construction, lace trim, bias-cut sewn) $50–$120; complex (full-skirt crochet maxi, multi-panel sewn gown, smocked or boned construction) $90–$200. Hard ceiling $200 unless named established maker.
    HANDMADE SKIRT EXCEPTION, non-denim, non-altered handmade skirts: simple $20–$50; moderate (granny-square midi, fitted maxi) $35–$85; complex (full-skirt crochet, multi-panel sewn) $65–$140. Hard ceiling $140 unless named established maker.
    HANDMADE PANTS EXCEPTION, non-denim, non-altered, from-scratch handmade pants (category = "bottoms"). SAFETY-NET CARVE-OUT, evaluate first: if the pants are Y2K alt-fashion factory items with contrast/decorative waistbands (checkerboard, grosgrain, jacquard, studded), ribbon-laced sides, oversized D-rings, chain trim, parachute/cargo straps, or contrast piping, these are FACTORY items even when isCustom was set in error, bail out of HANDMADE pricing and route to FACTORY ITEM PRICING → Y2K alt-fashion non-denim pants tier. Contrast subculture detailing is mass-produced manufacturing, not from-scratch handmade craft. Material tier matters, crochet/hand-knit pants are TikTok-spiking Q2 2026 and command meaningfully more than sewn-fabric handmade pants. Sewn-fabric (cotton/linen/silk wide-leg, palazzo, harem, drawstring trousers, NOT crochet/knit): simple (basic elastic-waist, plain) $30–$60; moderate (silk/custom print, fitted, drawstring detail) $50–$95; complex (multi-panel, structured waistband, statement construction) $80–$160. Hard ceiling $160 unknown maker. Crochet / hand-knit / macrame (granny-square flares, floral-medallion full-length, fishnet-style, doily-pattern wide-leg): simple (single-stitch joggers, basic shorts-length) $50–$90; moderate (granny-square flare or wide-leg, mid-complexity medallion pattern) $80–$150; complex (full-length intricate floral-medallion, multi-panel custom, oversized labor-intensive crochet) $130–$220. Hard ceiling $220 unknown maker. WORKED EXAMPLE: full-length white floral-medallion crochet flare pants = COMPLEX crochet tier; default to lower-middle anchor ~$140–$160 per FIRST-PASS ANCHORING (band low + 30% width), reserve $200+ for explicit upper-tier signals (named maker, NWT, exceptional density).
    HANDMADE BAG EXCEPTION, from-scratch handmade bags (crochet, macrame, woven, hand-loomed, hand-stitched leather): simple (crochet pouch, macrame mini bag, basic clutch) $20–$50; moderate (mid-size crochet tote, market bag, woven shoulder bag) $35–$85; complex (large hand-loomed leather, structured macrame, hand-stitched designer-grade) $60–$140. Hard ceiling $140 unless named established maker.
    HANDMADE ACCESSORY EXCEPTION (non-jewelry), handmade scarves, hats, beanies, gloves, mittens, leg warmers, belts, hair accessories, headbands: simple (basic crochet beanie, plain scarf) $15–$40; moderate (intricate stitch, on-trend silhouette, fitted) $25–$70; complex (oversized hand-loomed, multi-color tapestry, named technique) $50–$120. Hard ceiling $120 unless named established maker.
    HANDMADE FIBER-ART STANDALONE EXCEPTION, tapestry, wall hanging, weaving, blanket, throw, quilt, wall art, embroidery hoop art, punch-needle art (not garment): small (under 18", embroidery hoop, small wall art) $25–$80; medium (24–36", lap blanket, mid-size tapestry) $60–$160; large (large tapestry, full quilt, oversized weaving, statement piece) $120–$300. Hard ceiling $300 unless named established fiber artist.
    HANDMADE TOP CEILING, for ANY isCustom = true item where category = "tops" (whether altered factory base OR from-scratch crochet/knit/sewn halter, tank, crop top, blouse, cami): hard ceiling $180 unless the maker is a named established creator with documented resale history. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). Exemption: denim-based handmade tops that meet the DENIM EXCEPTION exceptional-construction override (woven/lattice denim, sculpted halter/corset/bustier, deconstructed couture, quilted denim) follow that override's $300 ceiling, not this $180 cap. Routine denim halters/tops without exceptional construction stay under $180.
    HANDMADE SEWN-FABRIC TOP EXCEPTION, if the item is a from-scratch handmade or restructured top sewn or constructed from fabric (satin, silk, cotton, jersey, knit fabric, stretchy knit, ribbed knit, ponte, woven, polyester, rayon, viscose, chiffon, linen, NOT crochet, hand-knit, or knitwear): Sewn handmade tops on Depop/Etsy price by finished look. Tiers (calibrated to actual unknown-maker Depop sold comps): simple (basic tank, tee, cami, plain shape, basic crop, off-shoulder cut, tee just cropped, tee with one applied detail) $20–$45; moderate (fitted with detail, V-neck, ruching, lace trim, gathered waist, darts, dolman/wrap silhouettes, halter conversion from a tee, button-up shirt cropped into bolero/shrug/cardigan with restructured or gathered/puff sleeves, raw-hem cut-and-finish, tie/knot closure conversion) $30–$60; complex (tailored blouse, structured top, intricate seaming, French seams, boning, multi-panel construction, multi-step restructure with several distinct construction techniques combined, e.g. corset boning + lace inset + custom pattern drafting) $50–$95. Hard ceiling $95 unless the maker is a named established creator with documented sales history. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). A tee restructured into a dolman/halter/ruched/draped silhouette belongs in the moderate band ($30–$60). A factory shirt cropped into a bolero/shrug with restructured puff sleeves and a tie/knot detail also belongs in moderate ($30–$60), NOT complex, cropping + sleeve gathering + one closure detail is the moderate prototype, not a complex multi-technique build.
    NO TRENDING BOOST, do NOT apply any "+20–30% trending handmade", "uniqueness premium", or "+30% craftsmanship" markup. The tiers above are already calibrated for unknown-maker Depop sold comps. "Looks impressive", "took a long time to make", or "trending aesthetic" are NOT reasons to exceed the listed unknown-maker ceiling, buyers price on finished look + maker reputation, not perceived effort.

  ► IF isCustom = false → FACTORY ITEM PRICING (use this path; ignore handmade section above):
    suggestedPaid: typical thrift store shelf price ($3–$30). For jewelry: thrift stores often underprice precious metals/stones, if gold, gemstones, or designer marks are visible, suggestedPaid can be $5–$100+.
    suggestedResaleLow: realistic sold-price floor. Use these brand-tier benchmarks:
      Fast fashion, Shein/H&M/Forever 21: $5–$25 (basic Shein tees commodity-priced $3–$8 used-good); Zara skews higher, especially dresses: $10–$50, NWT midi/maxi/satin slip $30–$85. Do NOT lump Zara dresses in with Shein.
      Mall brands, Gap/Old Navy: $8–$18; J.Crew/Banana Republic/Abercrombie: $14–$30; Madewell (premium within tier, wide-leg/flare jeans $30–$60 used-good, NWT to $80; skinny softening $6–$14)
      Athletic/streetwear (Nike, Adidas, Carhartt, Champion, Stussy, New Balance): standard tees/hoodies/joggers $8–$55; Nike Phoenix Fleece oversized hoodie premium sub-tier $60–$90; Adidas Samba XLG $31–$65. CARHARTT WOMEN'S WJ130/WJ141 JACKET CALLOUT, when the jacket is in a rare color (pink, purple, teal, cream, coral, NOT brown/black/khaki/tan) it commands $100–$350, far above the standard $25–$80 range. Identify by the chest pocket and quilted lining. Standard brown/black/khaki Carhartt stays in the regular range.
      Lululemon (premium activewear, prices well above generic athletic, visible Lululemon logo, Reflective Triangle, or interior care tag required): Align leggings $30–$75 used-good, NWT $70–$100; Wunder Train / Fast & Free / Speed Up leggings $25–$60; Define jacket $50–$140 used, NWT $100–$185 (Lunar New Year and limited-edition colorways skew top of range); Scuba hoodie / Define hoodie $40–$95; Everywhere Belt Bag $25–$60 standard, $80–$150 limited/discontinued colors. Athleta and Alo Yoga track 30–40% below Lululemon comparables. Do NOT lump Lululemon in with generic athletic.
      Sneakers (factory, not custom-painted), Generic athletic (standard Nike, Adidas, Vans, Converse): $20–$60; Premium athletic (Nike Air Max, Adidas Samba/Gazelle, NB 990/2002R/9060): $30–$80; Hyped silhouettes (Jordan 1 Low women's $40–$97, Jordan 1 High $120–$250, Dunk Low Panda $35–$70, Yeezy 350/700 $80–$200); Designer/collab (Travis Scott Jordan 1 Low $250–$400, NB 2002R Salehe Bembury $108–$253, Margiela/Balenciaga sneakers $250+). For custom-painted/altered sneakers see ALTERED FACTORY BASE EXCEPTION.
      Contemporary, Aritzia/Wilfred Free: $8–$40; Free People: $14–$85 used-good, NWT to $110 (boho/embroidered/linen/floral actively spiking spring 2026); Anthropologie: $20–$115; Patagonia (outerwear-focused, Nano Puff $87–$138, Down Sweater $100–$155, Synchilla fleece $45–$75; vintage Gore-Tex $70–$300); Reformation (commands retail premium): $80–$195. Arc'teryx and North Face price 2–4x over comparable contemporary outerwear: Arc'teryx fleece/soft-shell used-good $89–$200, NWT $300–$450; North Face shell/puffer $35–$150 standard. Mountain Hardwear and Marmot serve as the budget gorpcore floor: $25–$65 for fleece/jackets.
      Knit sets / matching lounge sets: mall-tier (Shein, Amazon-adjacent) $8–$25; contemporary-tier (Aritzia, Free People, etc.) $25–$85. For Juicy Couture velour sets, see the Y2K viral brands tier, they price separately and higher.
      Knit bodycon / off-shoulder mini dresses (trendy unbranded silhouette: ribbed knit, off-shoulder, square-neck, scoop, cowl, halter, or fitted bodycon construction, in trending colors like olive, sage, chocolate, cream, terracotta, black). Sold-comp anchors based on Depop / Poshmark / eBay sold listings (last 90 days): unbranded modern / dropship (most common case, no brand label visible) clears $18–$35 Depop, $15–$28 Poshmark, $12–$22 eBay used-good, default anchor $20–$32 lower-middle. Branded mid-tier (Princess Polly, Pretty Little Thing, Lulus, Boohoo, ASOS dress range, Forever 21 dress range) clears $22–$45 Depop, $18–$32 Poshmark, $15–$32 eBay used-good, default anchor $25–$40. Do NOT lump this silhouette into the Unknown / Unbranded $10–$30 commodity floor, the trending bodycon mini cluster commands meaningfully more. Aritzia, Free People, Anthropologie, Reformation override to their contemporary tier above. Q2 2026 spring-knits spike is ALREADY factored into this band, do NOT compound an additional +30–50% trend boost.
      Designer (Coach, Kate Spade, Marc Jacobs, Tory Burch, Vince, Polo Ralph Lauren): Coach pre-owned bags $17–$200, Coach NWT current-season Willow/Maggie $105–$385; Kate Spade $25–$120; Tory Burch $30–$150; vintage Coach signature pre-owned $25–$160; Polo Ralph Lauren tops/sweaters $15–$65
      Luxury (Burberry, Gucci, Louis Vuitton, Chanel, Prada, Saint Laurent, Balenciaga), model-dependent, wide spread: LV monogram pre-owned $100–$1700+; LV Neverfull MM $300–$850; LV Speedy 25 bandoulière $500–$1200; LV crossbody/small (Pochette, Saumur) $100–$350; Gucci GG canvas bag $100–$400. Chanel/Hermès authenticated bags start $1000+. NWT/like-new commands top of range; verified-authentic listings (with cards/dust-bags) command 20–40% over otherwise-equivalent.
      Designer small leather goods (wallets, cardholders, belts, scarves), separate from the bag tier above; SLGs price differently. Authentication HARD RULE applies, date code / heat stamp / serial required for the brand word in "name"; without it, default to "monogram canvas wallet" / "calfskin reversible belt" descriptor at $40–$150 unbranded-style tier. Brand-confirmed: LV wallets (Zippy, Sarah, Brazza, Multiple) $80–$400 used; Chanel wallets (caviar, lambskin) $200–$700; Goyard St. Sulpice / St. Marc cardholder $200–$500; Coach wallet/wristlet $25–$120; Hermès H belt (calfskin reversible, "H" buckle) $300–$700 used, NWT $700–$1100, discontinued colors appreciate above retail; Gucci Marmont belt $150–$400 (declining trend Q2 2026, no longer auto-spike); LV monogram belt $200–$500; Gucci Web belt $80–$250; Hermès silk twill scarf 90cm $120–$600 (huge resale category, discontinued patterns command upper band); Burberry nova-check scarf $80–$300. Box, dust-bag, or authenticity card alone is NOT proof.
      Mass-market denim (Levi's 501/550/514/Wedgie, Wrangler, Lee, Old Navy, Gap denim): $15–$35
      Premium denim (7 For All Mankind, Citizens of Humanity, AG, Paige, Frame, Joe's, Mother), CUT MATTERS A LOT: skinny is FALLING ($3–$25 used-good, $14 median, soft); wide-leg / flare / bootcut / Dojo are SPIKING ($30–$70 used-good, NWT to $100). Mother and Citizens skew +20–30% above 7FAM within tier. NWT premium denim wide-leg can reach $100. When you see flare/wide-leg cut, price at the upper band.
      Authenticated Y2K premium denim (True Religion big-stitch, Diesel, Rock Revival, Miss Me, Buckle, Affliction, check stitching and hardware): standard styles $9–$50; OG LOW-RISE FLARE WITH RHINESTONE / EMBELLISHMENT IS ACTIVELY SPIKING (Q2 2026): True Religion OG flare $35–$95; Diesel flare/wide-leg vintage $45–$120 (+45–58% in 30 days); Rock Revival / Miss Me embellished $20–$65 (+27%). When the item shows visible rhinestones, embellished back pockets, low-rise flare, or factory whiskering, price at the spike band, not the standard band.
      Y2K viral brands (Juicy Couture, Von Dutch, Ed Hardy, Baby Phat, Apple Bottoms, visible logos required, do NOT infer from silhouette): Juicy Couture velour tracksuit set NWT $55–$130, vintage Y2K USA-made set $100–$200 (+22% spike), Juicy terry tracksuit OG 2000s cotton $100–$165; Von Dutch trucker hat $20–$65; Ed Hardy graphic tee $25–$95; Baby Phat jacket/top $30–$120. These have real resale value now, Q2 2026 active spike reinforced by Euphoria S3 demand. Do NOT confuse with the COMMON HALLUCINATION TRAPS list, that warns against inferring these brands from look-alike silhouettes; this tier applies only when you can read an actual logo.
      Y2K alt-fashion non-denim pants (Tripp NYC, Lip Service, Hot Topic vintage Morbid line, modern Y2K-revival twill/polyester flares with subculture detailing: checkerboard waistbands, ribbon-laced sides, oversized D-rings, chain trim, parachute/cargo straps, contrast piping). These are FACTORY items even when the contrast waistband or trim looks "custom" or "handmade", treat as factory pricing only. Sold-comp anchors based on Depop / Poshmark / eBay sold listings (last 90 days): unbranded modern Y2K-revival / dropship (most common case, no brand label visible) clears $20–$45 on Depop, $15–$40 on Poshmark, $20–$50 on eBay used-good, default anchor $25–$55 lower-middle. Authenticated vintage Tripp NYC / Lip Service / Hot Topic Morbid 2000s (visible brand tag or era-correct interior label) clears $40–$90 Depop, $35–$75 Poshmark, $50–$120 eBay used-good. Do NOT route this item through the Premium denim flare SPIKING tier, the Authenticated Y2K premium denim tier, or the HANDMADE PANTS EXCEPTION when fabric is clearly non-denim (twill, polyester, satin, vinyl, mesh) and no denim brand mark is visible, route to this tier instead. Do NOT apply the Q2 2026 Y2K spike on top of this tier, the spike is already factored into the tier band.
      Modern Levi's denim jacket / trucker (current red Levi's tab, Made-in-China/Mexico/Bangladesh, modern leather patch, NOT Big E, NOT USA-made vintage): standard wash $30–$60; light wash factory-distressed $30–$65; dark wash $30–$55; sherpa-lined $35–$75; NWT current-season $45–$75 (Depop secondhand NWT sold comps clear at 50–70% of retail, NOT retail). CRITICAL: factory distressing (consistent placement, clean fray edges) is part of the modern product line and is ALREADY factored into this tier, do NOT upgrade to vintage tier based on "distressed" / "looks worn" / "feels vintage" alone. Vintage upgrade requires explicit vintage tells: visible Big E tab on chest pocket, single-stitch hem, union-made tag, USA-made label, chain-stitched yoke, blanket lining on older 70505s.
      Vintage Levi's tiered: Big E / 501XX / pre-1980s redline raw selvedge: $300–$590 (top of vintage market); LVC Big E selvedge reproduction (501/505/701): $42–$100; Premium Big E 90s–00s 501s: $25–$100; Standard post-Big-E vintage 501s/505s/550s button-fly: $19–$65; Vintage 70505 trucker jacket: $35–$120. Vintage Wrangler Blue Bell: $60–$250+.
      Vintage non-denim Americana (Pendleton, Filson, LL Bean, Eddie Bauer, Woolrich): Pendleton wool jacket/coat $35–$120, flannel shirt $20–$55; Filson jacket/shirt $45–$180 (premium of the tier); LL Bean fleece/flannel $15–$50; Eddie Bauer vintage down/puffer $25–$85; Woolrich wool coat/jacket $35–$120. These are common thrift finds with real Americana/workwear resale value.
      Vintage graphic tees / band tees, single-stitch hems, blank or USA-made tag, no side seams, soft cracked print are vintage tells (modern repros use side seams + double-stitched hems): Generic vintage 80s/90s graphic tee unbranded $20–$60; Vintage Disney / cartoon (Mickey, Looney Tunes, Garfield, theme-park souvenir) $30–$120; Vintage 80s/90s rock band tee $50–$200; Vintage 90s hip-hop / rap tee $60–$220; Vintage Disneyland / Six Flags / souvenir park tee $25–$100; Vintage NASCAR / racing crew tee 90s $40–$150. Grail-tier collector pieces (Nirvana Sub-Pop, Metallica Metal Up Your Ass) exist in the $500–$2000+ market but are rare enough to flag for manual research rather than auto-price, set confidence low and stay at the upper band of the standard tier above.
      Vintage sports jerseys & college: Mitchell & Ness Authentic NBA/NFL throwback jersey $80–$300; Vintage 90s Champion NBA jersey $60–$250; Vintage Starter NFL jersey $50–$200; Vintage Russell / Majestic MLB jersey $40–$150; Champion Reverse-Weave 80s/90s college sweatshirt (single-stitch, USA-made, blank tag) $40–$200, rare schools/colors to $300; Vintage college tee 80s/90s $25–$95. Modern Mitchell & Ness NWT current-season $120–$250.
      Boots, Combat boot (Steve Madden, Free People, generic): $20–$65; Doc Martens 1460 8-eye standard color (black, cherry) $40–$95 used, NWT $100–$140; Doc Martens Jadon platform / 1461 3-eye / Mary Jane $50–$120 used, NWT $120–$180; Vintage Made-in-England Doc Martens (smooth leather, MIE stamp on heel) $120–$300; Vintage western/cowboy boot $35–$180 (genuine vintage leather commands upper band); Knee-high heeled boot (designer-adjacent) $25–$95.
      Hats, Vintage trucker (Von Dutch era, distressed snapbacks): $20–$65; Branded dad cap (Patagonia, Arc'teryx, North Face, designer logos): $18–$55; Beanie (Carhartt, Patagonia): $10–$28.
      Sunglasses & eyewear (heavily counterfeited, verify hinges, brand etching on lens, "RB" lens etching for Ray-Ban, Oakley laser-etched logo + "O" hinge): Drugstore / mass market $5–$15; Ray-Ban Wayfarer / Aviator / Clubmaster modern $30–$90 used, vintage USA-made Bausch & Lomb-era $80–$250; Oakley sport (Holbrook, Frogskins, Radar) $25–$120, vintage premium frames (Romeo, Juliet, Mars, X-Metal) $100–$400+; Persol / Maui Jim / Costa Del Mar $40–$150; Designer (Tom Ford, Celine, Gucci, Prada, Versace, Dior, Saint Laurent, Miu Miu, Chanel) $50–$300; Vintage 80s/90s designer (Versace Medusa, vintage Cazal, vintage Dior monogram, vintage Chanel CC) $80–$500+. Branded case or cleaning cloth alone is NOT proof of authenticity, require maker etching on lens or temple.
      Luxury denim (Acne Studios, Balenciaga, Gucci, Balmain, Saint Laurent, R13): $80–$400+
      Unbranded or generic jeans: $12–$28
      Vintage (20+ years, good condition): add 30–60% over what comparable modern items sell for
      Unknown/unbranded: price by material quality, construction, and visual appeal, $10–$30
      Costume/fashion jewelry (no precious metal or stones, unbranded): $5–$20
      Sterling silver jewelry (925 stamp), sub-tiered: plain ring no stones $8–$35; earrings (plain or stones) $8–$40; maker-signed necklace $15–$85; with semi-precious stones (amethyst, turquoise, garnet, opal, citrine) $15–$60.
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
    Platform context: Depop runs higher for Y2K, vintage, trendy aesthetics, and unique pieces; Poshmark higher for workwear, contemporary brands, and NWT items; eBay for sportswear, collectibles, authenticated luxury, and fine jewelry (especially with GIA certs or brand boxes); Etsy for handmade, vintage 20yr+, cottagecore/artisan aesthetics, and estate jewelry. For furniture: Facebook Marketplace and Craigslist for local-pickup mid-tier (broadest buyer pool, no fees); Chairish and 1stDibs for vetted MCM/vintage premium (commission cuts but prices skew 30–50% higher); AptDeco for NYC/LA local-pickup contemporary; OfferUp for casual local; Etsy for vintage-only smalls (lamps, mirrors, decor under 30 lbs); eBay for shippable smalls (lighting, decor, hardware, small mirrors).
    Trend premiums (+20–40% to base): gorpcore/outdoor, quiet luxury, coquette, vintage collegiate, 90s minimalism, western/Americana, mesh/sheer, ballet/balletcore. Apply when the item clearly fits.
    BOOST STACKING, HARD RULE: Never compound 3 or more independent percentage boosts on the same factory item. The boost categories are: (a) era, vintage / Y2K / 90s / 80s / 70s / deadstock; (b) embellishment, rhinestone / crystal / beaded / sequin / studded / appliqué; (c) trend, coquette / gorpcore / balletcore / Q2 spikes / quiet luxury; (d) collab/celebrity, Travis Scott, Virgil, Fragment, named-artist collab; (e) denim spike, low-rise / flare / wide-leg / Y2K premium denim brands. Apply at most TWO boosts and pick the highest-percentage one as the primary; treat the rest as already implied by the brand tier. Compounding all of "vintage Y2K rhinestone flare trending Diesel" is double-counting, Diesel's +58% spike already factors in the Y2K low-rise flare aesthetic. Stay anchored to comparable Depop/Poshmark sold-comp prices, not formulaic stacking.
    Q2 2026 ACTIVE SPIKES (refresh this list quarterly, current as of 2026-04-30): crochet tops & matching sets, cargo pants, boho/romantic dresses, spring knits, polka dots, surf-aesthetic, peeptoe heels, wedding-guest dresses. Y2K maximalist demand is reinforced by the Euphoria Season 3 × Depop collab, keep Y2K aesthetic premium active. Apply +30–50% over base when an item clearly fits one of these spikes.
    suggestedResaleHigh: best-case sold price, typically 40–60% above low. For hyped items (trending brand + trending aesthetic), can reach 2x low.

  ► IF category = "furniture" → FURNITURE PRICING (use this path; IGNORE the clothing factory tiers and handmade labor formulas above, furniture has its own market dynamics):
    suggestedPaid: typical thrift/estate-sale shelf price ($10–$150). Antique mall and estate sales price higher than thrift; reflect that in suggestedPaid.

    BRAND/ERA TIERS (resale comp ranges based on Facebook Marketplace, Chairish, 1stDibs, Craigslist, eBay, AptDeco):
      Mass-market particleboard (IKEA, Wayfair budget, Target Threshold, dorm-tier): $15–$80. Larger dressers/wardrobes top out $80–$120 only when assembled and undamaged.
      Modern contemporary (West Elm, CB2, Crate & Barrel, Pottery Barn, Article, Joybird): chairs $80–$400, sofas $200–$800, dining tables $150–$600, storage $150–$500. NWT or like-new commands top of range; heavy use drops 50%.
      Premium contemporary (Restoration Hardware, Room & Board, Design Within Reach, Blu Dot): $200–$1500. RH leather/linen sofas $400–$2000+ used.
      MCM authenticated (Eames, Knoll, Herman Miller, Hans Wegner, Eero Saarinen, George Nakashima, Arne Jacobsen, Marcel Breuer, Le Corbusier, Mies van der Rohe, George Nelson, Florence Knoll, Cassina, Vitra, B&B Italia, Poltrona Frau): $500–$8000+. Eames Lounge Chair authenticated $2500–$8000; Saarinen Tulip Table $400–$2500; Wegner Wishbone $400–$1200; Barcelona Chair (Knoll/Cassina) $800–$3500; Eames Shell Chair $200–$700; Nelson Bench $400–$2000.
      Vintage Danish/Scandinavian Modern unbranded (teak/walnut/rosewood, sleek tapered legs, dovetail joints): credenza/sideboard $300–$1500, dining chair set of 4 $300–$1200, dining table $200–$900, lounge chair $200–$700.
      Vintage American mid-tier (Heywood-Wakefield, Drexel, Lane, Henredon, Baker, Thomasville, Ethan Allen, Stickley, Broyhill Brasilia, Kent Coffey, American of Martinsville): chairs/tables $100–$800, case goods $200–$2000. Stickley Mission and Broyhill Brasilia spike toward upper band.
      Hollywood Regency / Postmodern 70s–80s (Memphis Group, Karl Springer, Milo Baughman, Gabriella Crespi, Vladimir Kagan, Pierre Cardin): $400–$3000+ (Q2 2026 spike, Memphis revival especially). Lacquer, brass, lucite, mirrored surfaces are tells.
      Vintage industrial (factory carts, machinist tables, school chairs, warehouse stools, Toledo): $80–$600. Cast iron and patinated steel premium.
      Modern mass-market functional small furniture (dark-stained pine, veneer over MDF, thin solid-wood construction, small footprint 18–30" wide, machine-cut joinery, no manufacturer plate, sold new at Walmart/Target/Wayfair budget/Amazon for $40–$120): side tables / end tables / chairside tables / nightstands / small bookshelves / TV stands / small cabinets $15–$50 used as-is; $40–$80 after refinishing (sanded, restained or painted, hardware swapped). Tells: machine-uniform dovetails or staple/screw/glue assembly, thin veneer or photo-printed wood-grain over substrate, light weight for size, no visible vintage tells. ROUTING: route here BEFORE Generic vintage no-brand solid-wood ($40–$300) unless at least ONE positive vintage tell is visible (hand-cut dovetails with irregular spacing, mortise-and-tenon joinery, real solid wood with grain visible at unfinished interior surfaces, manufacturer plate or burn-in stamp from 1960s–70s or earlier, antique-mall finish patina, weight commensurate with size). Modern dark-stained pine without vintage tells is NOT generic vintage solid-wood; it is the mass-market modern tier.
      Generic vintage no-brand decent solid-wood quality: $40–$300 depending on size and condition.
      Antique 100yr+ solid wood (cherry, oak, walnut, mahogany, dovetail joinery, hand-cut details): $100–$1000; carved/signed/Eastlake/Victorian/Empire/Art Deco $200–$2000+. Look for hand-cut dovetails (irregular, slightly uneven) vs machine-cut (uniform).
      Outdoor: Brown Jordan / Janus et Cie / Crate & Barrel outdoor / RH outdoor $100–$800; teak outdoor (Smith & Hawken, Gloster) $80–$500; generic plastic patio $20–$100.
      Modern multi-function record-player cabinets (Crosley, Victrola, Innovative Technology, Wockoder, Songmics, LP&No.1, 1byone, ION Audio, Jensen, mass-market repro "vintage-style" units sold at Walmart/Target/Costco/Amazon, $80–$200 retail new): $30–$75 used. Modern repro tells (any ONE confirms): CD player slot, cassette deck, AUX/USB/Bluetooth ports, plastic platter under records, plastic tonearm, small cabinet footprint (14–24" wide), thin reddish/cherry veneer over MDF, integrated mesh-grille speakers as part of cabinet, "vintage radio dial" face that is decorative-only (clear plastic window over fake analog dial), modern power-adapter port. These are mass-produced 2010s–2020s products with the visual styling of 1940s radios or mid-century consoles but they are NOT vintage; do NOT route through Generic vintage no-brand solid-wood ($40–$300), Vintage American mid-tier ($100–$2000), or any antique tier even when the cabinet aesthetic references mid-century or 1940s radio styling. Authentic vintage console stereos (1960s–70s Magnavox, Zenith, RCA Victor, Curtis Mathes, Magnavox Astro-Sonic, Marantz, McIntosh consoles) are a separate higher tier at $150–$800+; tells include 4–6ft wide cabinet, real solid wood casework, heavy die-cast metal turntable platter, no CD/cassette/USB, big cloth-grille speaker enclosures with separate compartments, visible manufacturer plate or tube-amp electronics, weight 100+ lbs.

    MATERIAL SIGNALS (price modifier ±30–50%):
      Solid wood (especially walnut, teak, cherry, mahogany, oak, rosewood): +30–50% over comparable veneer-built piece.
      Veneer over plywood (legitimate construction technique used by mid-century brands): baseline.
      Particleboard / MDF / laminate / melamine / pressed wood / engineered wood: HARD FLOOR, rarely above $80 used regardless of original retail price or brand mention. Tells: visible particle texture at edges, wood-grain printed paper veneer (not real wood), swelling around water exposure, weight far less than expected for size.
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
      Refinished/reupholstered to high standard: +20–50% over base tier (counts as isCustom, treat as labor premium).

    CONDITION REPORTING, HARD RULE: The description (sub field) MUST name every visible defect when wear is present in the cover photo. Visible defects include but are not limited to: chipped edges, finish loss / worn finish, scratches, dents, gouges, water rings or stains, sun fade, paint loss, missing veneer, drawer sag, loose joints, cracked surface, missing hardware, rust on metal hardware. "Good condition" may ONLY be used when zero defects are visible in the cover photo. When any wear is visible, default to "used" and name the specific defect with location (top right edge, drawer front, leg base, etc.). Pricing must reflect the visible condition; do not anchor to the tier mid-range and then verbally describe defects, drop to the lower portion of the tier or the next tier down when defects are visible.

    SIZE PENALTY: large items (sofas, sectionals, dining tables seating 6+, beds, full-size dressers, armoires) -30% vs comparable smaller piece because the buyer pool is local-pickup-only on Facebook Marketplace/Craigslist/OfferUp. Small shippable items (lamps, mirrors under 36", side tables, decor under 30 lbs) command full price because they list nationally on eBay/Etsy.

    FURNITURE COMPARTMENT NAMING, HARD RULE: When the piece has compartments, name each by type AND position. Compartment types: drawer = closed pull-out with hardware (knob, handle, pull); shelf = open horizontal surface with no door or front panel; cubby = open recessed compartment, three walls + floor, no front panel; magazine rack / open slot = open angled or vertical slot designed for magazines, newspapers, or storage of slim objects, often with a slanted side; door cabinet = compartment enclosed by a hinged door. Position: top, middle, bottom, or left/right for side-by-side. Do not lump multiple compartments under a single label. Example correct: "End Table with Magazine Rack Slot, Open Middle Shelf, and Bottom Drawer". Example incorrect: "End Table with Drawer and Shelf" (omits the magazine rack slot and the position of each compartment).

    VISIBLE-ONLY NAMING, HARD RULE: include only the furniture pieces visibly photographed in "name". Do NOT infer companion items (ottoman, footstool, matching cushions, side table, dining chairs paired with a table, sectional with ottoman) just because the piece commonly comes as a set or because the chair is "famously paired" with an ottoman in the original design. Each photographed piece is named individually; unphotographed companions are NOT added to the name or to the price band. If a chair appears alone, name it "Lounge Chair" not "Lounge Chair and Ottoman" even when the design is iconic for its pairing.

    MCM ATTRIBUTION, HARD RULE: Eames / Knoll / Wegner / Saarinen / Herman Miller / Vitra / Cassina / Nakashima / Jacobsen / Breuer / Le Corbusier / Mies van der Rohe / Nelson attribution requires a visible maker label, sticker, stamp, paper tag, or burn-in mark. Without it, do NOT include the designer name in "name". Describe as "MCM-style", "mid-century", "Danish modern", or "in the manner of [era]" and price as unattributed MCM tier ($80–$300). Silhouette resemblance is NOT identification, knockoffs of Eames Shell Chair, Wegner Wishbone, and Saarinen Tulip Table are mass-produced and common in thrift. Same trap pattern as the COMMON HALLUCINATION TRAPS list for clothing. Refurb labor (reupholster, refinish, chrome polish, recane) on unattributed MCM stays WITHIN the band's hard ceiling: top of the unattributed MCM band is $300 unrestored / $450 with full refurb premium. Do NOT stack refurb premium above $450 for unattributed MCM regardless of labor density (full reupholstery in new leather + refinished shell + polished chrome together still cap at $450). Authenticated MCM (visible Herman Miller / Vitra / Knoll label) prices at the authentic tier per its own ceiling.

    Q2 2026 FURNITURE SPIKES (refresh quarterly): boucle and sherpa reupholstery; limewash and whitewash refinish; cane and rattan accent pieces (chairs, headboards, peacock chairs); postmodern Memphis revival; Italian designer (Cassina, B&B Italia, Poltrona Frau, Minotti) on resale; Japandi minimalism; vintage Persian/Moroccan/Turkish/Oushak rugs; antique wooden ladders; architectural salvage (corbels, mantles, doors); brass and lucite accents. Apply +20–40% over base tier when item clearly fits a spike.

    FURNITURE isCustom: refinished, restained, repainted, limewashed, whitewashed, reupholstered, recaned, or repurposed (dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard) qualifies as isCustom. Pricing: brand/era tier as base, refurb labor adds up to a 30–50% premium WITHIN the tier's hard ceiling (not stacked on top). The per-tier price ceiling is a hard upper bound; refurb cannot push the price above it. Worked example: unattributed MCM band is $80–$300 unrestored; full refurb (reupholster + refinish + chrome polish stacked) expands the band to $80–$450 hard ceiling, NOT $300 × 1.5 → unbounded growth. Do NOT exceed the subcategory ceiling for the base piece: refinished IKEA stays under $120 regardless of effort; refinished unattributed MCM caps at $450 regardless of labor density. Refinishing only meaningfully boosts pieces with quality bones (solid wood, MCM lines, antique structure). Refinish on particleboard adds $0, call out as red flag if the user invested labor in particleboard.

  ► IF category = "homewares" → HOMEWARES PRICING (use this path; IGNORE the clothing factory tiers and handmade labor formulas above. Homewares cover pottery, ceramics, art glass, dinnerware, decor smalls, lighting, mirrors, rugs, antique metals, and clocks. Etsy is the primary marketplace anchor for this category, not eBay/Depop/Poshmark; price for the Etsy/Chairish/1stDibs buyer pool who pays for curation, NOT the eBay deal-hunter):
    Detection: category = "homewares". Subtype routes by name/sub keywords (mug, vase, bowl, plate, pottery, ceramic, glass, lamp, mirror, rug, sterling, brass, copper, clock, etc.).
    suggestedPaid: thrift stores commonly under-price ceramics, glass, and antique metals because they don't recognize maker marks. When a maker's mark, signature, hallmark, or factory label is visible, suggestedPaid can be $5–$80+; for unmarked/unsigned pieces $3–$15.

    Lamps: generic floor/table lamp $25–$120; vintage brass/Stiffel/mid-century ceramic $40–$200; designer modern (Artemide, Flos, Louis Poulsen) $150–$800; Tiffany authenticated $500–$5000+; Tiffany-style reproduction $40–$150.
    Mirrors: generic $20–$100; vintage gilt/MCM/sunburst/convex $80–$400; antique/Art Deco/large floor mirror $150–$800.
    Rugs: machine-made polypropylene/synthetic $20–$80; wool no-brand $50–$300; vintage Persian/Turkish/Moroccan/Oushak (hand-knotted, natural dye) $150–$2000+; antique Heriz/Kashan/Tabriz $300–$5000+. Look for hand-knotted vs machine-made (back of rug shows individual knots vs uniform machine pattern).
    Decor smalls (non-ceramic): brass objects (candleholders, bookends, trays), wall art, generic vases without maker mark, sculpture without signature, decorative figurines without backstamp. Unbranded $10–$80; vintage signed sculptors $100–$1000+. Ceramic and pottery pieces with any visible maker mark, signature, or backstamp route to STUDIO POTTERY or VINTAGE TABLEWARE below, NOT to this generic decor-smalls floor.

    STUDIO POTTERY (signed wheel-thrown, hand-built, raku, reduction-fired vessels with potter signature, chop mark, impressed cipher, or painted hallmark on base or foot):
      Regional / lesser-known signed studio (any visible signature or chop mark, maker not in the named-grail allowlists below): $40–$300.
      Mid-grail named maker (Karen Karnes, Warren MacKenzie, Marguerite Wildenhain, Maija Grotell, Don Reitz, Akio Takamori, Betty Woodman, Ron Nagle, named Japanese mingei studio with verified chop mark): $200–$1500. Etsy and 1stDibs are primary anchors; eBay sold-comps trail by 20–40%.
      Top-grail (Lucie Rie, Hans Coper, Peter Voulkos, Beatrice Wood, Toshiko Takaezu, Bernard Leach, Shoji Hamada, George Ohr, Magdalene Odundo, Edmund de Waal): $1500–$8000+. 1stDibs and Chairish are primary anchors; eBay sold-comps are sparse and unreliable for top-grail because the buyer pool lives on specialty dealer sites. Set confidence: low automatically above $2000 because comps are sparse on every platform.

    ART GLASS (blown, lampworked, cane-work, paperweights, vintage decorative glass; signature on base or foil-paper factory label affixed):
      Unsigned modern decorative glass (no signature, no label, generic "Murano-style" or "Tiffany-style" silhouette): $15–$80. Most "vintage Murano" thrift finds are unsigned Czech, Chinese, or modern reissue reproductions.
      Signed studio glass (artist signature engraved or painted on base, pontil mark visible, individual maker not in named-grail lists below): $80–$400.
      Murano authenticated (Venini, Seguso, Barovier & Toso, Carlo Moretti, Salviati, with engraved master signature, intact factory paper label, signed cane technique, or Vetri di Murano consortium label): $100–$800.
      Vintage signed Loetz / Daum / Gallé / Lalique (engraved or molded artist signature on base): $200–$2000+.
      Tiffany glass authenticated (LCT signature engraved on base + Tiffany Studios maker mark): $500–$5000+.
      Steuben signed grail / Lalique grail (rare colors, large format, museum-grade): $300–$3000+. Set confidence: low above $1500 because comps are sparse.

    VINTAGE TABLEWARE / DINNERWARE / COLLECTOR PLATES: modern mass-market unbranded (Corelle, Pfaltzgraff, generic stoneware) $5–$30/piece $20–$60/set; modern branded current production (Lenox current, Mikasa, Royal Albert Old Country Roses, Spode Blue Italian current, modern Wedgwood) $10–$50/plate $80–$300/set; vintage Pyrex (Corning 1947–1980s opal/milk glass): common patterns (Snowflake, Verde, Spring Blossom Crazy Daisy, Friendship rooster) $20–$80, sought (Butterprint, Gooseberry pink, Pink Daisy, Spring Blossom Green) $60–$200, grail (Lucky in Love, Eyes, Hot Air Balloons, Starburst chip-n-dip) $200–$1500+; original-era Fiestaware (Homer Laughlin 1936–1972, NOT post-1986 reissue): standard colors $20–$80/plate, medium green (1959–1969) $80–$400, original uranium-glaze red $40–$150, rare 1950s "fifties colors" (forest, chartreuse, gray) $40–$200, rare-color pitchers/teapots/Disc Water Jugs $150–$800+; Wedgwood Jasperware vintage 1950s–70s $30–$150 pale blue, rare colors (black, sage, lilac, terracotta) $100–$400+; Spode Christmas Tree (1938–present) $20–$80/piece $200–$600/set, discontinued Spode (Tower, Florence, Trapnell) $30–$200; Noritake Art Deco era (1920s–30s "M-Mark" Morimura Bros) and pre-1921 Nippon $30–$300+; American art pottery: McCoy planters $20–$80, Roseville (Pine Cone, Magnolia, Fuchsia) $40–$300, rare Roseville (Della Robbia, Rozane, Egypto) $200–$1500+, Hall Refrigerator pitchers $30–$150; Royal Doulton HN-numbered figurines $40–$300, limited/discontinued $100–$600+; Scandinavian MCM dinnerware: common $25–$120/plate, designer-signed (Stig Lindberg Bersa for Gustavsberg, Arabia Paratiisi by Birger Kaipiainen, Dansk Generation by Gunnar Cyrén, Iittala) $40–$300+, rare (Lindberg Pungo, original Arabia Kosmos) $150–$800+; Depression/Carnival/Milk glass common $10–$60, sought (Cherry Blossom pink, Adam pink, Princess pink) $30–$200, rare colors/forms $100–$500+; Folk hand-painted: Polish Boleslawiec $20–$120, Mexican Talavera $15–$80, vintage Italian majolica (Deruta, Cantagalli) $40–$300.

    PRE-1900 UNMARKED CERAMICS (antique 100yr+ stoneware, redware, earthenware, pearlware, creamware; unsigned but identifiable by clay body, glaze chemistry, and form):
      Salt-glaze stoneware crocks / jugs / churns (cobalt-blue slip decoration, brown Albany-slip interior): $40–$300; signed pottery makers (Cowden & Wilcox, Cortland NY, named regional potteries impressed in clay): $200–$1500+.
      Yellowware mixing bowls, mocha-decorated yellowware, banded yellowware: $30–$200.
      American redware (slip-decorated, Pennsylvania German sgraffito, signed Bell family redware): $50–$400; rare slip-decorated $200–$1500+.
      English pearlware / creamware / mocha-ware / spongeware (1780s–1860s): $40–$300.

    ANTIQUE METAL SMALLS:
      Silver flatware: stainless / silver-plated (no .925 stamp, EPNS / EP / A1 / triple-plate marks instead) $10–$50; sterling silver (.925 / STER / STERLING / 9.25 stamp on stem or back) $80–$400 weight-dependent (melt-value floor for damaged pieces); coin silver (.900 / COIN stamp pre-1860) $100–$600; English hallmarked sterling (lion passant guarantee mark + city assay mark + date letter cycle) $80–$1000+.
      Pewter: vintage marked (visible touchmark / maker's mark punched into base) $20–$120; antique 100yr+ hallmarked pewter (named English / American / European maker) $60–$300.
      Brass / copper / bronze: mass-market modern $10–$50; vintage signed (Bradley & Hubbard, Stiffel base, Chase brass, Virginia Metalcrafters) $40–$300; antique copper kettles / pans / molds / saucepans (hand-hammered, dovetailed seams) $30–$200; signed Asian / Middle Eastern antique brass and bronze (named foundry mark, character signature) $80–$600.

    CLOCKS:
      Modern wall / battery clock (mass-market, no movement window, plastic case or thin veneer): $15–$80.
      Mid-century battery (Howard Miller current, Seth Thomas reissue, modern brand-name wall): $40–$200; vintage George Nelson sunburst clock for Howard Miller (with maker label): $300–$1500+.
      Antique mechanical mantle / wall (key-wind, visible pendulum, visible escapement, brass-and-steel movement, century-old): $100–$800.
      Grandfather / longcase clock (vintage / antique mechanical, full pendulum, weights, ornate case): $300–$3000+.
      Cuckoo clock: vintage Black Forest (hand-carved walnut case, mechanical bellows, brass plates marked Schatz / Schmeckenbecher / Hubert Herr / August Schwer) $80–$400; mass-market modern cuckoo (no maker plate, plastic bird, electronic chime) $20–$80.
      Antique carriage clock (small brass-and-glass case, visible escapement, repeater function): $150–$800+.

    POTTERY HALLMARK & MAKER, HARD RULE: To price studio pottery at the mid-grail or top-grail tier, you MUST see a visible signature, impressed mark, painted hallmark, chop mark, or maker's stamp on the base or foot of the piece. Without it, do NOT use the maker name in "name". Describe by silhouette / glaze / form (e.g. "Wheel-thrown stoneware vessel with celadon glaze", "Reduction-fired teabowl with shino glaze", "Hand-built earthenware sculpture"). Price at the unsigned studio pottery tier $40–$300, NOT the grail tier. Mid-grail makers requiring visible signature: Karen Karnes, Warren MacKenzie, Marguerite Wildenhain, Maija Grotell, Don Reitz, Akio Takamori, Betty Woodman, Ron Nagle. Top-grail makers requiring visible signature: Lucie Rie, Hans Coper, Peter Voulkos, Beatrice Wood, Toshiko Takaezu, Bernard Leach, Shoji Hamada, George Ohr, Magdalene Odundo, Edmund de Waal. Silhouette resemblance, glaze style alone, or "looks like Voulkos" without a signature is NOT identification, knockoffs and unsigned student work imitating named potters are common in estate sales. Flag "Verify maker's mark on base before paying grail prices, unsigned silhouette resemblance is the most common misidentification."

    GLASS SIGNATURE & ORIGIN, HARD RULE: For studio and art glass, the signature on the base or the intact foil-paper factory label affixed to the base is the primary value driver. Murano requires ONE of: signed cane technique visible internally, factory paper label intact ("Murano Made in Italy", Vetri di Murano consortium logo), engraved master signature on base, or named factory mark (Venini, Seguso, Barovier & Toso, Carlo Moretti, Salviati). Without any of these, "Murano-style" silhouette is mass-produced Czech, Chinese, or modern reissue and routes to the unsigned modern decorative tier $15–$80. Tiffany glass requires LCT signature engraved on base (often paired with a Tiffany Studios maker mark); without it, "Tiffany-style" stained glass or favrile-style iridescent finish is the reproduction tier $40–$150. Lalique requires molded or engraved "Lalique France" signature; "Lalique-style" frosted glass without signature is reproduction $20–$80. Loetz / Daum / Gallé all require engraved or applied artist signature on base. Without signature, do NOT use the maker name in "name".

    METAL HALLMARK, HARD RULE: Sterling silver requires .925 / STER / STERLING / 9.25 stamp visible (typically on clasp, stem, base, or back). Coin silver requires .900 or "COIN" stamp. English hallmarked sterling requires the lion passant (sterling guarantee mark) plus city assay mark plus date letter cycle. Without these stamps, yellow-tone metal is brass or brass-plated, silver-tone is silver-plated (EPNS / EP / A1 / triple-plate) or stainless or pewter. Pewter requires a visible touchmark (maker's stamp punched into the base) for the vintage / antique tier; unmarked pewter routes to the modern tier. Antique copper requires hand-hammered surface or dovetailed seams; modern repro copper is machine-spun and seamless. Without any hallmark or maker mark, route to mass-market modern tier and flag "Verify hallmark stamp on clasp or base before paying sterling / coin-silver prices."

    CLOCK MOVEMENT & ERA, HARD RULE: To price at the antique mechanical tier or grandfather / longcase tier, the photo must show OR the description must reference at least one of: visible key-wind mechanism, visible pendulum, visible escapement, visible balance wheel, visible brass-and-steel movement at back. A vintage-styled wood case with no movement visible and a modern quartz battery compartment routes to the mid-century battery tier ($15–$80), NOT the antique mechanical tier. Black Forest cuckoo requires brass plate marked Schatz / Schmeckenbecher / Hubert Herr / August Schwer for the vintage tier; unmarked cuckoo with plastic bird and electronic chime is the modern mass-market tier ($20–$80). Flag "Verify movement type, quartz movements in vintage-styled cases route to the modern tier."

    TABLEWARE BACKSTAMP & ERA, HARD RULE: For vintage tableware, dinnerware, and collector plates, the backstamp on the underside is the primary value driver. To price a piece at the vintage premium tier, you MUST see one of these era markers in the photo:
      • Pyrex: "PYREX" wordmark + Corning logo + "MADE IN USA"; vintage opal/milk-glass body (white/cream opaque), not modern Instant Brands clear borosilicate. Pattern names embossed or printed on the piece are vintage tells; unmarked clear glass is modern.
      • Fiestaware: original-era pieces marked "HLC" or "Homer Laughlin" with visible mold marks. Post-1986 reissue is marked "FIESTA" in script. TRAP COLORS that did NOT exist in original-era 1936–1972 production confirm post-86 reissue and route to the modern branded tier, not the vintage tier: periwinkle, sapphire, plum, raspberry, lemongrass, sunflower, persimmon, scarlet, tangerine, peacock, cinnabar, paprika, marigold, twilight, sage, meadow, daffodil, lapis, lilac, claret.
      • Wedgwood Jasperware: impressed "WEDGWOOD" + "MADE IN ENGLAND" + impressed year date code (3-letter system pre-1930, year-letter system post-1930). Current-production Wedgwood Jasperware routes to the modern branded tier even with a backstamp visible.
      • Roseville: impressed "Roseville USA" + pattern number (post-1939); pre-1939 is unmarked but has characteristic matte glaze and clay body color. Reproductions are unmarked OR have crisp modern lettering rather than worn impressed marks.
      • Spode: discontinued patterns have backstamp date markers + pattern names. Current production (Blue Italian, Christmas Tree) routes to the modern branded tier even with backstamp visible.
      • Noritake: pre-1921 "Nippon" + "Morimura Bros" or "M-Mark"; 1921–1941 "Made in Japan" + Noritake mark; Art Deco era (1920s–30s) is the premium tier.
      • Scandinavian MCM dinnerware: factory mark required (Arabia "ARABIA MADE IN FINLAND", Iittala "i" logo, Dansk "DANSK Denmark/IHQ", Gustavsberg "Gustavsberg Sweden") PLUS designer signature impressed or painted (Lindberg, Kaipiainen, Cyrén) for the premium tier.
      No backstamp visible OR unable to confirm era → flag "Maker's mark not visible; verify backstamp on underside before paying vintage premium. Vintage tableware value is mark-driven, modern reissues are commonly mistaken for vintage." and price at the modern branded tier or generic stoneware floor.

    CONDITION PENALTIES (apply after tier selection on ALL homewares ceramics and glass): hairline crack / repaired break / chip on rim or foot reduces value 40–60% off tier mid-range; crazing (fine glaze crackling) on Pyrex / Fiestaware / Wedgwood reduces value 20–35% (crazing is acceptable patina on art pottery but value-tanking on dinnerware); glaze loss / utensil marks / dishwasher abrasion reduces value 25–40%; missing matching pieces in a dinnerware set → price per-piece only, no set premium; chipped or broken cuckoo bird / clock hand / pendulum bob reduces clock value 30–50%; tarnish on sterling is patina, NOT a defect (sterling tarnish polishes off, modern collectors often prefer aged patina); dents in antique copper / brass are acceptable patina unless deep enough to compromise function.

    HOMEWARES isCustom: hand-built studio pottery, hand-thrown vessels, hand-blown art glass, hand-forged metal pieces, hand-painted ceramics, hand-tooled silver, lampworked beads, fused-glass dishes, and slip-cast-then-hand-decorated pieces qualify as isCustom. Pricing: route to STUDIO POTTERY tier for ceramics (unsigned $15–$200; signed mid-grail $200–$1500; signed top-grail $1500–$8000+); to ART GLASS tier for glass; to ANTIQUE METAL SMALLS or signed-maker subtier for metal. The handmade labor formulas from the clothing branches DO NOT apply, a hobbyist mug priced like a custom commission is the most common over-pricing error in this category. Pricing for hand-built work without a recognizable maker signature stays at the unsigned studio pottery tier ($15–$200 range), NOT the named-grail tier.

  ► IF category = "accessories" AND the item is jewelry or a watch → JEWELRY PRICING (use this path; IGNORE the jewelry lines in FACTORY ITEM PRICING above, the tiers below are refreshed Q2 2026 and supersede them. Jewelry and watches have their own market dynamics: metal + stamp + maker, not era × embellishment × trend stacking):
    Detection: category = "accessories" AND name/sub contains ring, necklace, pendant, chain, earrings, bracelet, bangle, cuff, brooch, pin, charm, locket, choker, anklet, watch, wristwatch, chronograph, jewelry, or jewellery.
    suggestedPaid: thrift stores often underprice precious metals and stones, when gold karat stamp, designer maker mark, or visible gemstones are present, suggestedPaid can be $5–$100+; otherwise $3–$15.

    METAL / MATERIAL TIERS, apply only with a readable hallmark stamp visible (see JEWELRY HALLMARK, HARD RULE above). Without a stamp, default to the costume tier even when the piece looks high-quality:
      Costume / fashion (no hallmark, unbranded): $5–$20
      Signed vintage costume (Trifari, Coro, Eisenberg, Weiss, Haskell, Hobé, Whiting & Davis, Sarah Coventry, Monet, Napier, Trifari Jelly Belly, Boucher, Hattie Carnegie, Kenneth Jay Lane): $20–$120, only when the maker mark is visibly readable on the back/clasp. Statement brooches, Bakelite, and rhinestone parures skew the upper band. Strong Etsy/eBay resale category often misclassified as generic costume.
      Sterling silver (925 / STER / STERLING / 800 stamp), sub-tiered: plain ring no stones $8–$35; earrings (plain or stones) $8–$40; maker-signed necklace $15–$95; with semi-precious stones (amethyst, turquoise, garnet, opal, citrine, moonstone) $15–$70.
      Gold-filled / gold-plated / vermeil (1/20 GF / GF / GP / RGP / vermeil / 925 stamp with gold tone): $20–$75 (gold spot ~$3000/oz Q2 2026 has lifted the floor on plated and filled categories).
      Solid gold by karat (priced by visible karat stamp + chain weight + pendant size; heavier = higher): 10k $40–$160; 14k $80–$300; 18k $150–$500+; 22k–24k $200–$700+.
      Diamond fine jewelry (solitaire, halo, pavé, tennis, eternity, evaluate visible size, cut, setting quality): $80–$600+. Visible grading cert (GIA / AGS / EGL) adds 30%; missing cert = drop confidence to "low" even if setting looks correct.
      Colored gemstone fine jewelry (ruby, sapphire, emerald, tanzanite, alexandrite, evaluate color saturation, size, setting): $60–$450+.
      Pearl: costume faux $5–$20; cultured freshwater $20–$80; Akoya $80–$300; Tahitian / South Sea / baroque / keshi $150–$800+. Photo alone cannot confirm pearl type, default cultured-freshwater tier with low confidence unless brand cert/box visible (Mikimoto).
      Platinum (PLAT / 950 / 900 stamp): +30–50% over equivalent gold piece.

    DESIGNER HOUSE TIERS, apply only with a visible maker stamp on the piece itself (T&Co, ©Tiffany & Co., "Please Return to Tiffany & Co.", Cartier signature + serial, ALE 925, DY, VCA + serial, BVLGARI, etc.). Box/dust-bag alone is NOT proof, boxes are sold separately. Without the stamp, route to the costume tier or the silhouette-knockoff red flag:
      Designer house (Tiffany, Cartier, Van Cleef & Arpels, Bulgari, Harry Winston, Mikimoto, Buccellati, Boucheron, Chopard, David Yurman): $100–$2500+. Tiffany sterling sub-tier (Return-to-Tiffany, Elsa Peretti bone cuff, T1, Atlas): $80–$350, runs much higher than non-Tiffany sterling because of brand premium.
      Accessible designer (Pandora, Kendra Scott, Lagos, John Hardy, James Avery, Mejuri, Catbird, Maria Tash, Aurate, Awe Inspired, Brilliant Earth Heirlooms): $25–$200 depending on metal (sterling base lower band, 14k base upper band).

    WATCHES (sub-tier, apply only with visible brand mark on dial AND matching case-back signal):
      Fashion watches (Fossil, Michael Kors, Skagen, Anne Klein, Guess, DKNY): $20–$80
      Mid-tier (Tag Heuer, Tissot, Hamilton, Seiko Presage / Prospex, vintage Bulova, vintage Omega quartz, Citizen Eco-Drive premium, Movado): $80–$400
      Luxury (Rolex, Omega Seamaster / Speedmaster, Cartier Tank, Patek Philippe, Audemars Piguet, IWC, Breitling, Vacheron Constantin, Jaeger-LeCoultre): $400–$15,000+. REQUIRES visible maker mark on dial AND serial number / model reference visible. Without both, drop to mid-tier ceiling. Authenticated luxury watch with matching papers/box adds 20–40% over equivalent unboxed.

    ESTATE / ANTIQUE: Art Deco, Victorian, Edwardian, Georgian, Retro, Mid-Century signed pieces, add 40–80% over base material value. Hand-engraving, mine-cut diamonds, foiled-back stones, and rose-cut stones are era authentication signals.

    Q2 2026 JEWELRY SPIKES (refresh quarterly): chunky gold chains, charm necklaces and locket revival, signet rings, stacked rings, bow charms, Y2K choker, vintage cameo, mismatched pearl, mourning jewelry, dainty layered chains. Apply +20–40% over base when item clearly fits.

    Trend premiums and embellishment boosts from the clothing factory branch DO NOT apply to jewelry, jewelry pricing is metal-and-maker driven, not aesthetic-trend driven. The BOOST STACKING rule still applies to prevent compounding era × trend × embellishment on the same piece.

  CONDITION ADJUSTMENT (applies to both handmade and factory): Reduce both suggestedResaleLow and suggestedResaleHigh by 30–50% for visible damage, prominent stains, non-decorative holes, heavy pilling, faded/washed-out color, stretched or warped necklines, broken zippers, missing buttons, loose stitching, scuffed/cracked/peeling leather, yellowed whites, broken or cloudy hardware, tarnish on jewelry. Reduce by 15–25% for moderate wear, minor pilling, slight fading, small spots, faint creases, light patina. NWT or like-new condition (crisp fabric, intact hardware, no visible wear, original tags) commands the top of the range. When condition is unclear from the photo, assume "used-good" and make no adjustment. Never apply condition bonuses above the tier ceiling.

  FINAL SANITY CHECK, DO THIS BEFORE RETURNING (applies to ALL pricing paths):
  After computing suggestedResaleLow and suggestedResaleHigh, pause and ask yourself: "Would this specific item actually sell on Depop / Poshmark / eBay TODAY at these prices?" Mentally picture 3 recently-sold listings of the closest comparable item (same brand tier, same silhouette, same condition, same trend bucket).
    • If your suggestedResaleHigh exceeds the most likely sold-comp by more than 30%, pull BOTH ends down toward the comp median. Tier ladders and brand-tier benchmarks are starting estimates, not the final answer, actual sold comps are the ground truth.
    • If your range straddles two clearly different tiers (e.g., $40–$200), narrow it. A range that wide signals you have NOT picked a tier, pick one and commit, then set confidence: "low" via the confidence rule.
    • For handmade items: the tier ladder above is calibrated for UNKNOWN MAKERS on Depop/Etsy. Do NOT inflate above the listed hard ceilings unless the maker name is explicitly an established Etsy/Depop creator with documented sale history. "Looks impressive", "took a long time to make", or "trending aesthetic" are NOT reasons to exceed the unknown-maker ceiling, buyers price on finished look + maker reputation, not perceived effort. ALSO check band-position: if your output sits in the upper third of a tier band without explicit upper-tier signals (named maker, NWT, exceptional construction keyword, mint condition), pull both ends down toward the lower-middle of the band. First-pass overshoot = anchoring at band ceiling instead of lower-middle median.
    • For factory items with multiple boosts (era + embellishment + trend): re-check the BOOST STACKING rule. If you applied 3+ boosts, you're double-counting, strip back to one or two.
  This check exists because first-pass pricing consistently anchors high; rescans land closer to true comps because they self-correct against a prior verdict. Do that self-correction here, on the first pass.
- ideas[].t = short, actionable tip (no price amounts)
- If multiple items are visible, identify only the most prominent one
- If the photo appears to be AI-generated, a screenshot, or not a real physical item, set name to "Not a real item" and confidence to "low"
- For Sanrio characters (Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, etc.) or other collectible character brands, the bundle idea should suggest pairing with related items from the same universe, e.g. "Bundle with other Sanrio items for a themed lot, character bundles sell 30-50% higher on Depop"
- authFlags: 0–3 short authenticity checks ONLY for items where counterfeits commonly exist:
  luxury brands (Louis Vuitton, Gucci, Chanel, Prada, Burberry, Hermès, Dior, Fendi, Balenciaga, Saint Laurent),
  designer goods (Coach, Kate Spade, Tory Burch, Michael Kors, Marc Jacobs),
  brand-name sneakers (Nike Dunk, Jordan, Yeezy, New Balance 550/2002R),
  designer sunglasses, premium denim (True Religion, Diesel), branded watches, precious stones/fine jewelry,
  MCM/designer furniture (Eames, Knoll, Herman Miller, Wegner, Saarinen, Cassina, Vitra, Nakashima, Jacobsen, Breuer, Nelson), designer modern repros (Saarinen Tulip Table, Barcelona Chair, Wegner Wishbone, Eames Shell Chair, Eames Lounge), Tiffany lamps, antique signed pieces.
  Each flag = a specific, actionable physical check the buyer can do in-store, e.g.:
  "Check stitching evenness, authentic LV uses single continuous thread, no loose ends"
  "Verify heat stamp depth and font, counterfeits have shallow or inconsistent stamping"
  "Look for a date code inside the interior pocket or under the flap"
  "Inspect zipper pulls, should be branded hardware with smooth action, no rough edges"
  "Feel the leather, genuine should be supple with natural grain, not plasticky or uniform"
  "Check for hallmarks inside the band or clasp, 10k/14k/18k/750/925/PLAT stamps indicate real precious metal"
  "Examine stones closely, real gemstones have natural inclusions; glass and CZ appear flawless and overly brilliant"
  "Test metal weight, genuine gold and platinum feel noticeably heavier than plated or costume metals"
  "Check the underside of seat or inside the drawer for a Herman Miller / Knoll / Cassina / Vitra / maker label, sticker, or burn-in stamp, knockoffs of MCM designer pieces are mass-produced"
  "Verify Tiffany lamp signature on bronze base and feel the glass weight, leaded glass is significantly heavier than reproduction"
  "Look for a maker's mark, paper label, or stamp on the back or underside, authenticates antique era and origin"
  "Look for 'T&Co' or '©Tiffany & Co.' stamp on clasp or back, heart pendants, beaded chains, and Return-to-Tiffany shapes are heavily counterfeited"
  "Cartier Love and Juste un Clou pieces have a serial number engraved beside the Cartier signature, knockoffs lack the serial or use shallow / uneven engraving"
  "Pandora charms and bracelets have 'ALE 925' stamped on the inner ring or charm core, counterfeits omit ALE or use blurry / off-center stamping"
  "Look for the LV date code (FL/SD/CT/MI/SP + 4 digits) inside an interior pocket or under the flap, pre-2021 bags require this; counterfeits omit or print the wrong format"
  "Coach creed patch should have a clean serial number engraved; superfakes use blurry shallow stamps and inconsistent font kerning"
  "Hermès Birkin/Kelly: blind stamp on inside near strap base (year letter in box/circle/square + craftsman code), counterfeits skip the blind stamp or use generic placement"
  "Chanel: 8-digit serial sticker inside flap pocket should match authenticity card font; counterfeits use uneven adhesive and wrong font weight"
  "Jordan / Dunk: cross-check the SKU on the inner tongue tag against the original colorway on Nike SNKRS or StockX, fakes often have valid-looking SKUs that don't match the photographed colorway"
  "Travis Scott Jordan 1: verify Cactus Jack-branded shoelace bag is included AND that the reverse mini-swoosh is stitched (not glued/printed), replica swooshes peel"
  Empty array [] for: unbranded items, fast fashion, mall brands, handmade items, basic athletic wear, generic IKEA-tier furniture, or anything where counterfeits are uncommon.
  Frame as verification tips, not accusations, the goal is to help the buyer verify before purchasing.
- RED FLAG DETECTION, HARD RULE, populate redFlags (1–2 items) when ANY of the following are true. This is NOT optional, if ANY condition matches, you MUST include at least one redFlag. Empty array [] ONLY when zero conditions match.

  UPCYCLE EXEMPTION, evaluate before any other red flag rule: If isCustom = true (per the isCustom criteria above), treat unusual visual qualities of the GARMENT as expected features of handmade work, NOT as red flags. Frankensteined/patchwork/reconstructed garments legitimately combine mismatched fabric panels, clashing prints, jarring color blocks, asymmetric construction, and logos spliced with unrelated textiles, that IS the craft, not a red flag. Do not return "All-over sublimation print" or the "stock-photo" sentinel for upcycled garments whose "weirdness" comes from the upcycle itself. This exemption does NOT waive the text-garbling, anatomical-impossibility, or diffusion-smearing tells, those remain red flags regardless of isCustom.

  ALL-OVER DIGITAL PRINT: The garment has an all-over sublimation or digital print covering most of its surface WITH PICTORIAL CONTENT, tattoo flash art, paintings, illustrations, photorealistic imagery, anime stills, meme/bootleg-style graphic collage, or AI-looking artwork printed on cheap polyester. These are almost always mass-produced dropship items.
    Do NOT flag classic textile repeats, ditzy florals, watercolor / painterly / abstract / tropical / Hawaiian florals, cherry/fruit prints, gingham, houndstooth, polka dots, stripes, checks, paisleys, toile, geometric tile repeats, bandana patterns, animal prints, tie-dye, marbled / ink-wash / watercolor abstracts, simple all-over logo monograms. These are traditional woven or printed fabrics that have existed for decades, not dropship sublimation.
    Do NOT flag garments visibly constructed from MULTIPLE DIFFERENT FABRIC PANELS, patchwork, pieced/spliced panels, mismatched front/back/side fabrics, fringe or beadwork trim added on top, lace-up or grommet inserts in contrasting fabric, visible reconstruction seams. Mass-produced dropship sublimation is printed on ONE continuous polyester panel; handmade upcycles combine different source fabrics. Multi-panel construction overrides this bullet regardless of whether each panel's print looks "pictorial."
    Do NOT flag MULTI-ZONE PRINTED TEXTILES, garments whose all-over print is a mosaic of multiple traditional textile patterns (animal print + tribal/ethnic geometric + abstract painterly waves + snakeskin/reptile + paisley + ikat + batik + bandana) arranged as adjacent printed "patchwork-style" zones on a single continuous fabric. This is a decades-old print tradition for boho / festival / Y2K-era mesh maxi dresses, kaftans, sarongs, beach coverups, gypsy-style flowy dresses (Sky to Moon, Charlotte Russe, Forever 21, mall-tier 2005-2015), and tropical resort wear. The "patchwork look" is part of the printed design, not construction, one continuous polyester/mesh/jersey panel with no seams between zones. Tells: zones filled with textile repeats (no recognizable pictorial subjects), flowy V-neck or deep-V maxi silhouette, stretch mesh or jersey body, beaded or studded bib/neckline trim, halter or wide-strap construction. This exemption does NOT cover prints whose zones contain genuinely pictorial content (recognizable characters, scenes, slogans, photorealistic imagery, anime stills), those still fall through to the standard rule.
    Do NOT flag LOLITA FASHION / KAWAII J-FASHION garments (sweet, classic, gothic, country, sailor, jirai-kei, ryousangata, fairy-kei, otome-kei, ouji), whether One-Piece (OP), JumperSkirt (JSK), skirt, or blouse, including Angelic Pretty, Baby the Stars Shine Bright (BtSSB), Alice and the Pirates, Innocent World, Metamorphose temps de fille, Victorian Maiden, Mary Magdalene, Putumayo, h.NAOTO, Emily Temple Cute, Jane Marple, and replica or inspired-by counterparts (TaoBao indie brands, lolita-inspired dropship). The lolita silhouette is the firewall, require two or more of these tells genuinely visible in the photo: short puff sleeves, mutton/lantern sleeves, or long bishop/poet sleeves; tiered ruffled skirt with visible petticoat support or strong A-line bell shape; multi-row lace trim along hem, neckline, or sleeves; satin/grosgrain ribbon bows at bodice/sleeves/waist/back; pintucks, smocking, or shirring on bodice; high-cinched waist with full skirt; shirred or lace-up back panel; matching headdress/bonnet/headbow/KC. When the silhouette tells are present, lolita brands print elaborate pictorial sublimation panels (carousels, merry-go-rounds, sweets/macarons/desserts/cake/ice cream, fairytale castles, Alice in Wonderland imagery, stained glass, crowns/jewelry/regalia, music notes and instruments, libraries/books/letters, celestial/star/zodiac scenes, heraldic roses and florals, nostalgic toys/bears/bunnies/dolls, and similar narrative/storybook/sweet/baroque pictorial motifs) as the DEFINING genre aesthetic, not a counterfeit signal. Do not flag the pictorial print as dropship sublimation regardless of how elaborate, "cartoon," or "AI-looking" the imagery looks. Construction tells must be GENUINELY present in the photo (real ruffles, real lace hardware, real ribbon trim), not vaguely "puffy graphic-tee" styling, otherwise the standard rule applies.
    → Flag: "All-over sublimation print, commonly mass-produced. Check label for brand, artist credit, and material quality before buying."
  AI-GENERATED ARTWORK: The printed/painted/applied graphic DESIGN on the garment shows visual signs of AI generation.

    PRECONDITION, evaluate FIRST: This branch fires ONLY when the garment carries a printed, painted, sublimated, screen-printed, embroidered-pictorial, or otherwise APPLIED GRAPHIC DESIGN (a tattoo-style print, illustration, photographic image, character art, slogan graphic, painted mural, embroidered scene, etc.). If no such design is present, DO NOT FLAG under this branch regardless of any other signal. Before any tell below fires, name the design out loud: "a [character / scene / slogan / illustration / painting / embroidered motif] is printed / painted / embroidered on the [garment area]." If you cannot name a representational subject for the design, if the only candidate is a geometric repeat, color block, or textile pattern, the precondition is NOT satisfied and this branch does not apply. Explicitly NOT artwork:
      • Plain solid-color garments (any color)
      • Distressing, rips, holes, shredding, sanding, bleaching, fading, dye work, subtractive or surface-treatment labor is not "artwork"
      • Classic textile repeats, florals, stripes, checks (including neon, high-contrast, two-color, Vans-style, racing, and Y2K checkerboard variants), plaids, gingham, paisley, polka dots, houndstooth, toile, bandana, animal prints, tie-dye, marbled/watercolor abstracts, simple all-over logo monograms
      • Construction details, seams, topstitching, pockets, rivets, hardware, hems, yokes, contrast stitching
      • Brand labels, woven tags, hangtags, embroidered logos (a logo is not "artwork")

    Only AFTER confirming an actual applied graphic design is present, flag when one or more of these concrete tells are clearly visible IN THE DESIGN:
    • Text in the design that is garbled, misspelled, fused, or nonsensical (on the printed/painted/embroidered design itself, NOT on labels/tags, UI overlays, captions, watermarks, social-media re-share text, reblog/repost indicators, hashtags, usernames, foreign-script overlays, or screenshot chrome, all of which are exempt regardless of how garbled they appear)
    • Human or animal figures in the design with anatomical errors, extra/missing fingers, melted faces, impossible limbs
    • Elements in the design that dissolve or blend into each other without logical boundaries
    • Wobbly outline lines with inconsistent line weight, where individual lines in a "drawn" or "embroidered" design have varying thickness or pressure within the same continuous stroke. Factory-printed line art is mechanically uniform; AI line art carries its drawing-process imprecision.
    • Incomplete or floating features in figures, eyes drawn as bare dots with no pupil/iris detail, mouths represented as a single ambiguous line, cheek blush dashes that don't anatomically connect to a blush region, ambiguous extra appendages (a thumb or hand-shape behind a head, a stray limb that doesn't clearly belong), lines that fade out before closing into a recognizable shape

    "Cute / sketch / cartoon / hand-drawn / minimalist character" style is NOT automatic evidence of intentional artistic style. AI image generators in 2026 commonly produce "cute" and "sketch" character designs that LOOK like deliberate stylization but carry the AI's drawing imperfection. Real factory-printed and factory-embroidered cute designs are vector-clean: consistent line weight, closed forms, anatomically resolved features. Real handmade-craft cute designs are rough WITH consistent technique (consistent stitch tension, consistent line weight, consistent ink registration). AI is rough WITHOUT consistency, line weights drift unpredictably within a single design, "stitches" don't replicate over-and-under thread physics, features are incomplete in ways no real maker would produce. When the design reads as "cute / sketch / cartoon" AND any tell above is visible, flag rather than defaulting to "intentional style."

    If a real applied graphic design is present AND at least one concrete tell above is visible → Flag: "Artwork on this garment shows signs of AI generation, verify source and artist attribution before reselling."
  AI-GENERATED PHOTO: The photo itself, not the garment's printed design, was generated by an AI model rather than taken with a real camera.

    SCREENSHOT/UI EXEMPTION, evaluate before any artifact below: Many real photos are screenshots or shares from social media, resale apps, and phone cameras. App UI chrome, watermarks, captions, and overlay text are NOT AI artifacts and MUST NOT trip any bullet below. Do NOT flag for any of the following, regardless of how "off" the text or layout looks:
      • TikTok, Reels, YouTube Shorts, Instagram, Snapchat, BeReal, Pinterest, Tumblr (including reblog / repost / reposted indicators and dashboard chrome), Twitter/X, Threads UI, like/comment/share icons, follow buttons, music attribution, sound-off labels, view/like/comment counts, progress bars, "live" badges, sticker overlays, emoji reactions, drawing/marker overlays, GIF stickers, location pins, polls, time stamps
      • Resale-platform watermarks and overlays, Depop @username, Poshmark, eBay, Mercari, Vinted, Etsy, Grailed, StockX
      • Captions, hashtag stacks (#fyp #foryou …), auto-translate banners, closed-caption text, on-screen subtitles, song lyrics overlays
      • Usernames containing emoji, special characters, decorative Unicode, or zero-width joiners
      • Foreign-language text in any script (Korean, Chinese, Japanese, Arabic, Hebrew, Cyrillic, Thai, Devanagari, etc.), looking unreadable to an English speaker is NOT a sign of AI generation
      • Phone status bar, battery indicator, signal bars, notification banners, system time, control center, keyboard, app switchers, screenshot edges
      • Stylized or decorative fonts (gothic, script, distressed, sticker-style), kerning artifacts from compression or scaling, low-resolution text from re-shares
      • Professional product photography ONLY when accompanied by REAL brand-origin signals (visible brand watermark, runway/showroom geometry, magazine page grain, polaroid edges with stamp/date, brand-catalog logo, retailer site chrome). "Looks like a flat-lay / lookbook / catalog shot" by aesthetic alone is NOT exempt, AI image generators in 2026 produce exactly this aesthetic, so a clean styled appearance is no longer a real-origin signal. Apply the AI tell list below to all flat-lays, mirror-selfies, lookbook-style outfit photos, and styled product shots that lack independent brand-origin verification.
      • Furniture refurb / thrift-flip content from TikTok / Reels / YouTube Shorts / Instagram, workshop in-progress shots, before/after pairs, painted/refinished pieces under controlled lighting, glossy painted surfaces, painted antique chests being repurposed. Refurb tutorials are real workshop documentation. Glossy paint, smooth refinished surfaces, perfectly-staged styling shots, and "too clean" looks on furniture are evidence of skilled refurb work, NOT AI generation. Do NOT flag refurb cover photos for AI artifacts on the basis of finish quality alone.

    PHOTO CAPTURE ARTIFACTS EXEMPTION, evaluate before any tell below: Real phone cameras and re-shared photos produce optical, motion, and compression artifacts that look "off" but are NOT AI generation tells. Do NOT count any of the following as a smear / diffusion / edge-bleed / CG-fabric / wobbly-print artifact:
      • Motion blur on hands, arms, hair, jewelry, or other extremities when the subject is moving (dancing, twirling, posing actively, waving the mirror-selfie hand, hair flip). Real photos catch motion; AI photos are unnaturally still. Motion blur is evidence of a real moment captured mid-movement, not a diffusion artifact.
      • Bloom, halation, lens flare, or glow around bright areas (windows, lamps, ring lights, screens, mirrors) and around figures lit from behind or beside a bright source. Overexposed window light haloing around a figure's hair, garment edges, or skin is optical bloom, NOT AI edge-bleed.
      • JPEG / video / TikTok-screenshot / Reels compression artifacts: banding, posterization, blocky color regions, smeared low-frequency areas, chroma subsampling halos around saturated edges. Heavily re-shared or screen-recorded photos accumulate these. Compression artifacts are uniform across the whole frame; AI artifacts are localized to specific elements (a hand, a printed graphic, a label, a piece of hardware).
      • Low-light sensor noise, grain, chroma noise, hot-pixel speckle on phone photos taken indoors or at night.
      • Out-of-focus, soft-focus, or partly-blurry photos (subject not sharp, depth-of-field cutting through the garment). Real reseller photos are often handheld, in mirrors, or while moving, and frequently miss focus.
      • Beauty-filter softness from TikTok / Instagram / Snapchat filters (skin smoothing, slight face slimming, eye enlargement, lip enhancement, color cast, vignette). These filters are applied to REAL photos. Filter-softened skin alone is NOT the "airbrushed skin" tell; only flag the face/skin/hair compound when BOTH airbrushed skin AND hair-edge fade are present AND at least one unrelated AI tell from the list below is also present.
      • Y2K / dreamy / grunge / film / disposable / lo-fi filter aesthetics: light leaks, color shifts, vignettes, halation, grain, frame scratches, scan lines, "VHS" overlays, dust particles, soft hazy focus. These are intentional photo-styling filters applied to real photos.
      • Alt-fashion / J-fashion / kawaii subculture styling: decora, scene, fairy kei, jirai kei, lolita, gothic lolita, harajuku, kidcore, sweet lolita styling with rainbow / pastel / sectioned-color hair, kandi bracelets, plush accessories, layered colorful clothing, fishnets, leg warmers, multi-pattern clashing outfits, character-print tees (GIR / Hello Kitty / My Melody / Kuromi / Domo), platform shoes / kandi cuffs. Bedrooms cluttered with plushies, anime figures, kandi displays, photo-card walls, or fairy lights are REAL subculture bedrooms; the maximalist clash is intentional fashion, not an AI artifact. This styling and these backgrounds are common on Depop / Etsy / TikTok resale. Treat the cluttered subculture bedroom as a NEGATIVE signal against the SIGNATURE A and SIGNATURE B "perfectly clean room background" patterns below.

    REAL TEXTILE / TRIM EXEMPTION, evaluate before any tell below: Many intricate factory textiles and trims look "hand-drawn" or "wobbly" at first glance but are produced with mechanical precision. Do NOT count any of the following as a wobbly factory print, CG-fabric, or AI-print tell:
      • Lace (Chantilly, Alençon, eyelash, broderie anglaise, guipure, illusion bridal mesh, Victorian / baroque floral, scalloped trim, crochet lace). Real lace has visible warp/weft thread structure and consistent repeats; the floral curls and intricate motifs are the textile, not a generated graphic.
      • Machine-embroidered overlay on lingerie, bridal, prom, occasion-wear, and corsetry. Look for satin-stitch direction, thread sheen, and repeat consistency, NOT "shaky line work".
      • Beaded, sequined, pearl, or rhinestone appliqué on dresses, tops, jackets, accessories. The individual beads are sewn or glued to the base in factory-repeatable patterns.
      • Jacquard, brocade, damask, tapestry, and other woven-pattern textiles where the design is part of the weave, not a print.
      • Fishnets, mesh, tulle, organza, and other sheer or open-weave fabrics. The open-weave pattern is the textile structure.
      • Tie-dye, ombre, dip-dye, batik, and other hand-dyed garments with intentional irregular saturation. These are evaluated for handmade/upcycle classification, not AI-photo flagging.

    AI CONTEXT RECOGNITION, evaluate after the exemption above and BEFORE the tell list below: recognize whether the image matches one of these three AI-typical signatures. The signatures are not themselves tells, but inside any signature the pairing threshold is LOWERED, ANY single soft tell becomes sufficient, because the context signature itself counts as the pair.

    SIGNATURE A, AI MIRROR-SELFIE COMPOSITE: 2+ panels of a person in a mirror with handheld phone visible, magazine-quality even lighting, styled composition, perfectly clean room background, abstract or generic phone case texture with no identifiable brand markings. Real mirror-selfie resale listings are rarely this polished, real ones use cluttered bathrooms, bedrooms with visible mess, dressing-room hooks, or cars, and show branded phone cases / popsockets / charms / visible wear.

    SIGNATURE B, AI FLAT-LAY LISTING: a garment laid on a perfectly clean uniform surface (cream, beige, white, gradient, pastel solid) with even diffuse lighting and no visible photographer shadow, no surface dust or lint, no fold creases pressed into the surface texture, and possibly adjacent garments partially visible at frame edges with similar AI quality. Real flat-lays use bathroom floors, bedroom carpets, bed surfaces, hangers in cluttered closets, or hardwood with visible grain, and always show at least one of: surface dust/lint, fold creases pressed into the surface, photographer/phone shadow at one edge, lighting falloff toward corners.

    SIGNATURE C, AI SKETCH-GRAPHIC GARMENT: a garment with hand-drawn-looking embroidery, stitched line-art character, hand-printed-looking design, or "intentionally imperfect" print whose imperfection lacks the consistency of real handmade craft. Real factory cute/sketch designs are vector-precise. Real handmade/indie craft is rough WITH consistent technique (consistent stitch tension, consistent line weight, consistent ink registration). AI is rough WITHOUT consistency, line weights drift unpredictably within one design, "stitches" don't replicate over-and-under thread physics, "block-prints" don't replicate offset registration of multi-color hand-printing.

    When any signature above matches, lower the pairing bar to ONE soft tell, the signature itself counts as the pair. When no signature matches, the standard pairing rules from the tell list apply.

    Only AFTER confirming the image is not exempt above, flag when one or more of these specific AI generation artifacts are clearly visible:
    • Diffusion/smearing artifacts: areas of the image that look melted, smeared, or dissolved rather than sharply rendered
    • Impossible or physically inconsistent shadows, shadows that point in multiple directions, float, or have no logical light source
    • Background geometry that is physically impossible or "painterly" in a way no camera could produce
    • Garment edges that bleed, feather, or dissolve into the background without a clean transition
    • Fabric texture that looks CG-rendered, but ONLY when paired with another artifact in this list (smear, impossible shadow, edge bleed, garbled physical-surface text). Smooth synthetic fabrics (satin, taffeta, polyester, vinyl), uniformly-dyed garments, and saturated solid colors naturally look "perfect" in good lighting, that alone is NOT a CG tell. Real ruffles, pleats, smocking, concentric/radial garment construction, and tutu-style layered structure produce highly repetitive patterns that ARE NOT neural-network artifacts.
    • Garbled, fused, or melted text on a PHYSICAL SURFACE inside the photo, a storefront sign, hangtag, product label, book/paper in the scene, mirror reflection, brand label sewn into the garment. The text must clearly belong to a 3D object in the photographed scene, not to any UI overlay, caption, watermark, sticker, hashtag, username, foreign-script overlay, or screenshot chrome (all exempt above). Pair with at least one other artifact in this list before flagging, text alone is not enough.
    • Anatomical impossibilities if a person is shown, wrong number of fingers, melted facial features, impossible limbs
    • Multi-panel composite drift: a single image arranged as 2+ panels showing the SAME outfit from different angles, where applied details visibly differ between panels, the printed graphic on a t-shirt has different layout/density/figure count across panels; the necklace dangles differently or shows different chain counts in close-up vs full-body; the hat logo or sneaker branding shifts position; the same hardware (buttons, zippers, snaps) appears in different positions or counts; the same applied print, embroidery, or patch appears in slightly different positions. Real photos taken in one outfit minutes apart have IDENTICAL applied details across angles; AI image models generate each panel independently and produce subtle drift in nominally identical items. Pair with at least one other artifact in this list before flagging.
    • Mirror-selfie generic phone case: a mirror-selfie context (handheld phone visible, person looking into a mirror) where the phone's back case shows a generic abstract pattern (marbled, gradient, liquid, iridescent, watercolor swirl, holographic) with NO identifiable brand markings, sticker, charm, popsocket, lanyard, ring holder, or visible scuff/wear. Real phones almost always carry a brand case, charm, popsocket, sticker, or visible wear; AI mirror-selfie outputs commonly produce generic abstract back-case textures because the model has no specific brand to reference. Pair with at least one other artifact in this list before flagging.
    • Face / skin / hair render-quality compound: BOTH (a) airbrushed skin with no visible pores, fine hair, or natural texture variation across the entire visible face AND (b) hair edges that fade softly into the background without strand-by-strand definition where individual flyaway hairs should be visible. Real beauty-filter photos can show one of these in isolation (airbrushed skin from a filter alone, or soft hair from shallow depth-of-field alone), but BOTH together on the same subject is a CG portrait tell, real cameras with real subjects produce micro-pores OR strand definition somewhere. Pair with at least one other artifact in this list before flagging.
    • Wobbly factory print or embroidery: a printed textile pattern (stripes, dots, speckles, florals, geometric repeats, plaids, paisleys) or embroidered/stitched design on the garment shows hand-drawn imprecision that no factory printing, weaving, knitting, or machine stitching could mass-produce, stripes that wobble or drift in width/spacing/parallelism along their length, dots or speckles that vary unevenly in size or density across the surface, embroidered or stitched line-art with inconsistent stitch weight or shaky line quality where individual stitches should be uniform, character/sketch line-art with floating segments where lines fade out before closing into a shape, repeated motifs that aren't actually repeating (each instance looks slightly different). Factory printing, weaving, knitting, and embroidery are mechanically precise; AI-generated "prints" and "stitching" on a garment carry the imprecision of the AI's underlying drawing process. Pair with at least one other artifact in this list before flagging.
    • Hardware / closure / trim inconsistency on a single garment: the SAME type of closure or trim element (buttons, snaps, rivets, eyelets, drawstring caps, zipper pulls, decorative studs, hook-and-eye sets, grommets, applique badges, embroidered patches) appears in DIFFERENT shapes, sizes, colors, alignments, or counts across the garment where it should be uniform; one button is round and the next is square or larger, two snaps on the same placket are different colors, the left cuff has a button and the right cuff doesn't, an embroidered logo appears at slightly different positions on otherwise-identical pieces. Real factory garments produce identical hardware across every instance; AI generates each piece independently and produces drift between supposedly-matching elements. Pair with at least one other artifact in this list before flagging.
    • Flat-lay AI cleanliness: the photo is a flat-lay listing context (garment laid on a surface, no person modeling) where the background surface is perfectly uniform with NO visible dust, hair, fuzz, lint, scratches, fold marks impressed on the surface, surface-grain variation, photographer shadow, phone-camera shadow, or lighting falloff across the frame. Real flat-lay listing photos always show at least one of: surface dust or lint, garment fold creases pressed into the surface texture, a soft photographer or phone-camera shadow at one edge, or slight lighting variation toward the corners. AI flat-lay outputs commonly produce perfectly clean uniform backgrounds because the model has no real surface to reference. Pair with at least one other artifact in this list before flagging.
    • Adjacent-item AI consistency: in a flat-lay or styled photo where MULTIPLE garments, accessories, or items are visible (even partially at the frame edges), every visible item shares the same AI generation qualities, the same wobbly print quality, the same dissolved-edge look, the same factory-impossible details. Real flat-lay listing photos with multiple items show each item with its own real-world characteristics (different fabrics with different drape, different print precision, different wear patterns); AI generates the whole scene with consistent AI fingerprints across every item. Pair with at least one other artifact in this list before flagging.
    • Lookbook / influencer-styling context as pair-amplifier: the photo shows magazine-quality even lighting, professional composition, perfectly clean background with no clutter, and styled "outfit post" framing more typical of Pinterest/Instagram fashion editorials than of thrift/resale listing photos. Real reseller photos are commonly taken in cluttered bedrooms, bathrooms, on the floor, on hangers, on dressing-room hooks, or in cars. Lookbook context alone is NOT a tell, but when paired with any other artifact in this list, it raises confidence that the photo is an AI lookbook generation rather than a real listing. Never flag on lookbook context alone, this is a pair-amplifier only.
    Do NOT flag based on how the GARMENT itself looks, mismatched fabrics, patchwork panels, Frankensteined construction, clashing prints, unusual silhouette, logos spliced with unrelated fabrics, radial/concentric symmetry, ruffles, pleating, smocking, accordion folds, fan/petal/flower-shaped silhouettes, voluminous tulle/taffeta layering, parasol or umbrella shapes, and other geometrically perfect garment construction are all real fashion design, not AI photo artifacts. High symmetry and uniform color are properties of well-made garments, not generated images.
    AI-generated outfit photos, flat-lay listing photos, mirror-selfie composites, and lookbook-style product shots are COMMON in 2026 on Pinterest, Instagram, TikTok, and resale platforms. Modern image generators (Midjourney, Stable Diffusion XL, FLUX, Sora, Reve) produce "clean-looking" outputs that LACK obvious melting or smearing but carry SUBTLE tells: wobbly factory-impossible prints, hardware drift across supposedly-matching elements, generic abstract phone cases on mirror selfies, perfectly clean flat-lay surfaces with no dust or shadow, multi-panel composites with detail drift, "intentional-looking" sketch graphics with wobbly outlines. When EITHER one hard tell (smearing, impossible shadow, painterly geometry, edge bleed, anatomical impossibility) OR any TWO soft tells (every tell marked "Pair with at least one other artifact") are present, FLAG. When an AI CONTEXT SIGNATURE (A, B, or C) matches, ANY single soft tell is sufficient because the signature itself counts as the pair. Do NOT abstain on a charitable "intentional artistic style," "professional product photo," or "real photo with quirky design" interpretation when concrete AI imprecision is visible. Modern AI fashion images are SPECIFICALLY DESIGNED to look like intentional artistic style or professional product photography; do not let that styling defeat the tell list. The cost of a missed flag (the user buys a nonexistent AI-generated item) is real.
    If genuine AI generation artifacts are present → add the string "stock-photo" to redFlags (no other text, this is an internal trigger only).
  When in doubt about whether a PRINT ON THE GARMENT is AI-generated (AI-GENERATED ARTWORK branch only), ERR ON THE SIDE OF FLAGGING, but ONLY after the PRECONDITION above is satisfied (an actual applied graphic design exists on the garment) AND at least one concrete tell is visible. Plain garments, distressed/ripped/bleached fabric, classic textile repeats, construction details, and brand labels are NEVER flagged under this branch regardless of any "feeling" about the image. The err-toward-flagging is a tiebreaker between two real readings of a real design, not a license to invent artwork that isn't there. This erring applies ONLY to the artwork branch, it does NOT apply to ALL-OVER DIGITAL PRINT (require pictorial content) or AI-GENERATED PHOTO (require specific camera artifacts).

  FURNITURE RED FLAGS, apply ONLY when category = "furniture". Evaluate every flag below against the COVER PHOTO (the finished item being sold), NOT against any "before" or in-progress photos in a multi-photo refurb pair. A weathered/raw before-state photo is evidence of LABOR (the user invested work to refinish), NOT evidence of hidden defects in the finished cover piece. Do NOT speculate about defects that "might be hiding" under paint, refinish, or new upholstery, flag ONLY when the relevant tell is visibly present on the COVER.
  FURNITURE EXCLUSIONS, evaluate before any specific flag below. The following are CONDITION NOTES that belong in the sub field, NOT red flags. Do NOT coin a new flag category for any of these, and do NOT add them as redFlags entries:
    • Normal surface wear, scratches, scuffs, scrapes, dings, dents from age or use
    • Finish loss at edges, corners, or high-touch areas, worn paint, faded stain
    • Patina, oxidation, age-darkening on metal, brass, leather, or wood
    • Light cosmetic wear that a refinish would remedy, minor refinishable marks
    • Drawer-front nicks, top-surface ring marks, side-panel rub marks
    • Slight wobble that levelers fix, minor caster wear, light scuffs on casters
    • A cover photo that simply looks "old", "vintage", or "lived-in" without one of the five specific defect tells named below
  Mention these in the condition portion of sub (e.g. "good used condition with light surface wear and finish loss at corners"). Lowering the price for visible wear belongs in CONDITION ADJUSTMENT, not in a red flag, used items showing wear is the baseline expectation for a resale app.
  EXHAUSTIVE LIST: the five furniture red flag categories below (PARTICLEBOARD MASQUERADE, MCM KNOCKOFF, HIDDEN ODOR, BEDBUG INDICATORS, STRUCTURAL DAMAGE) are the ONLY furniture-applicable red flag categories. Do NOT invent new categories or coin new flag strings outside these five. If no listed category applies, leave redFlags as [].
  PARTICLEBOARD MASQUERADE: SUBSTRATE PROOF GATE, evaluate first. If beforeAfterDetected = true AND any additional photo (not the cover) shows the same piece with raw wood grain visible, sanded surfaces with grain direction, unfinished drawer interiors, exposed end-grain, unpainted unrefinished sections, or dovetail/mortise joinery, that is definitive proof the substrate is solid wood. Do NOT fire this flag regardless of the cover photo's finish, speculative warnings on legitimate refinish work erode trust. MODERN REPRO EXEMPTION, also evaluate first: if the cover photo shows a modern multi-function record-player cabinet (CD player slot, cassette deck, AUX/USB/Bluetooth ports, plastic platter under records, integrated mesh-grille speakers as part of cabinet, decorative-only "vintage radio dial" face, ~14–24" cabinet footprint, Crosley/Victrola/Innovative Technology/Wockoder styling), do NOT fire this flag, the modern repro tier already prices for MDF/veneer construction ($30–$75 used) and the warning is redundant. Otherwise: the COVER piece shows particleboard, MDF, or pressed wood with printed wood-grain paper veneer imitating solid wood. Tells (must be visibly present in the cover photo): visible particle texture or peeling paper at edges, swelling around water exposure, weight far less than expected for size, mass-market dorm/IKEA brand context. Do NOT flag painted refurb pieces, MCM-style flips, or refinished antique wood just because "it could be hiding particleboard underneath", paint over solid wood is the most common refurb finish, and speculating about what's under the paint produces false positives. Do NOT flag dovetail-jointed antique chests, traditional drawer construction, or pieces with visible wood grain at unpainted areas (drawer interiors, undersides). → Flag: "Verify solid wood vs printed-veneer particleboard before paying solid-wood prices, particleboard rarely resells above $80 regardless of look."
  MCM KNOCKOFF: the silhouette resembles a famous MCM design (Eames Shell, Wegner Wishbone, Saarinen Tulip, Barcelona Chair, Eames Lounge) but no maker label, sticker, or stamp is visible in the photo. → Flag: "Verify maker stamp or label (typically underside of seat or inside drawer) before paying authenticated-MCM prices, knockoffs are mass-produced and common."
  HIDDEN ODOR: ONLY for visibly UPHOLSTERED furniture in the COVER photo (fabric or leather sofas, fabric chairs, padded headboards, mattresses, ottomans with fabric tops, fabric sectionals). Do NOT flag hard-surface pieces, wood dressers, painted/repainted/restained/limewashed/whitewashed wood, refinished antique chests, repurposed cabinets, wicker, rattan, cane, metal, glass, lacquer, lucite, fully refinished surfaces, or any refurb piece where the user has done refinish/repaint labor visible in the cover. A freshly painted or refinished surface is by definition NOT a smoke/pet/mildew vector, paint encapsulates and refinish strips the prior finish. Hard surfaces don't trap odor the way fabric does. → Flag: "Smell-verify in person, upholstery odor (smoke, pet, mildew) isn't photogenic but tanks resale."
  BEDBUG INDICATORS: rust-colored or dark spots along mattress seams, upholstery seams, or frame joints. Especially flag for curbside finds, apartment sources, and any mattress. → Flag: "Inspect seams and joints closely for rust-colored stains, bedbug indicators kill resale and create infestation risk."
  STRUCTURAL DAMAGE: ONLY when damage is unambiguously visible in the photo, a snapped/missing leg, a clearly cracked or split frame, a torn-through seat with springs poking out, dark water staining/swelling/bubbling on a wood surface, visible mold, a drawer hanging off-track, or a clearly broken joint. Do NOT flag for normal patina, light surface wear, intact wicker/cane that simply looks vintage, or pieces that appear sound. When in doubt, do NOT flag, false damage warnings erode trust. → Flag: "Structural damage visible, verify the piece is sittable/usable; refinishing won't compensate if the bones are compromised."

  HOMEWARES RED FLAGS, apply ONLY when category = "homewares". Evaluate against the COVER PHOTO. Frame as verification, not accusation, the goal is to help the buyer verify before purchasing. Do NOT flag a piece simply for being unsigned, most decor smalls are legitimately unsigned and route to the unsigned tier; only flag when the NAME or DESCRIPTION claims a maker, era, or material that needs evidence on the piece.
  EXHAUSTIVE LIST: the five homewares red flag categories below (UNSIGNED GRAIL CLAIM, UNSIGNED ART-GLASS CLAIM, VISIBLE CONDITION DEGRADATION, HALLMARK MISSING, QUARTZ-IN-VINTAGE-CASE CLOCK) are the ONLY homewares-applicable red flag categories. Do NOT invent new categories or coin new flag strings outside these five. Generic surface wear, light scratches, age patina, or "looks used" without a chip, crack, repair, or crazing visible is a condition note for the sub field, not a red flag. If no listed category applies, leave redFlags as [].
  UNSIGNED GRAIL CLAIM: the name or description references a mid-grail or top-grail potter (Karen Karnes, Warren MacKenzie, Lucie Rie, Hans Coper, Peter Voulkos, Beatrice Wood, Toshiko Takaezu, Bernard Leach, Shoji Hamada, George Ohr, Magdalene Odundo, Edmund de Waal, named studio) but no signature, chop mark, impressed cipher, or maker's stamp is visible on the base or foot in the photo. → Flag: "Verify maker's mark on base before paying grail prices, unsigned silhouette resemblance is the most common misidentification."
  UNSIGNED ART-GLASS CLAIM: the name or description references a named glass maker (Murano, Venini, Seguso, Barovier & Toso, Carlo Moretti, Salviati, Lalique, Loetz, Daum, Gallé, Tiffany glass, Steuben) but no engraved master signature, intact factory paper label, signed cane technique, or consortium label is visible on the base. → Flag: "Verify maker's mark on base before paying signed-art-glass prices, 'Murano-style' and 'Tiffany-style' reproductions are widespread."
  VISIBLE CONDITION DEGRADATION: hairline crack, chip on rim or foot, repaired break, visible crazing on dinnerware (Pyrex, Fiestaware, Wedgwood, modern branded), heavy glaze loss, or utensil-mark abrasion is clearly visible in the cover photo. Crazing on art pottery is NOT a defect (acceptable patina); crazing on dinnerware IS a defect. → Flag: "Inspect rim and foot for chips; crazing and hairline cracks tank ceramic resale 20–60%."
  HALLMARK MISSING: silver-tone or gold-tone metalware (flatware, candleholder, vessel, tea set) with no .925 / STER / STERLING / .900 / COIN / 10k / 14k / 18k / 750 / lion-passant / city-assay-mark stamp visible on clasp, stem, base, or back. Common when only the front face is photographed. → Flag: "Verify hallmark stamp on clasp or base before paying sterling/coin-silver prices, silver-plated EPNS is commonly mistaken for sterling."
  QUARTZ-IN-VINTAGE-CASE CLOCK: clock styling references antique mechanical (vintage wood case, mantel-clock silhouette, longcase silhouette, schoolhouse case) but tells suggest modern quartz (battery compartment visible, modern hands or dial face, no visible pendulum or escapement window, no key-wind hole). → Flag: "Verify movement type, quartz movements in vintage-styled cases route to the modern tier ($15–$80), not the antique mechanical tier ($100–$800)."

  JEWELRY RED FLAGS, apply ONLY when the item is jewelry or a watch (see JEWELRY PRICING detection):
  GOLD MASQUERADE: yellow-tone metal but no karat stamp visible (10k / 14k / 18k / 24k / 375 / 585 / 750 / 916). Common when only the front/face of a piece is photographed and the inner band or clasp is hidden. → Flag: "No karat stamp visible, verify a 10k/14k/18k/750 stamp inside the band or on the clasp before paying solid-gold prices. Brass and gold-plated are commonly mistaken for solid gold."
  STERLING MASQUERADE: silver-tone metal but no 925 / STER / STERLING stamp visible. → Flag: "No 925 or sterling stamp visible, could be silver-plated, stainless steel, or pewter. Verify stamp on clasp or inside the band before paying sterling prices."
  DIAMOND MASQUERADE: clear sparkly stones with no grading cert and no hallmarked precious-metal setting visible. → Flag: "Without a grading cert (GIA / AGS / EGL) or a stamped 14k+ gold or platinum setting, clear stones may be CZ, moissanite, or glass, verify before paying diamond prices."
  DESIGNER KNOCKOFF: silhouette resembles an iconic designer piece (Tiffany heart or "T" pendant, Cartier Love or Juste un Clou bracelet, Van Cleef Alhambra clover, Pandora charm bracelet, David Yurman cable cuff, Bulgari B.zero1 or Serpenti) but no maker stamp is visible in the photo. → Flag: "Iconic designer shape but no maker stamp visible, verify hallmark on clasp, inner band, or back before paying designer prices. Counterfeits of this exact shape are widespread."

  BAG / SNEAKER RED FLAGS, apply ONLY when the item is a bag or sneaker:
  LUXURY BAG KNOCKOFF: silhouette + canvas pattern resembles iconic luxury (LV monogram, Chanel CC quilt, Hermès Birkin/Kelly, Goyard chevron, Gucci GG, Prada triangle, Dior CD) but no date code, heat stamp, blind stamp, serial sticker, or interior brand plaque is visible. → Flag: "Iconic luxury bag shape but no date code / heat stamp / serial visible, verify on the interior pocket, leather tab, or under the flap before paying luxury prices. Counterfeit luxury bags dominate resale traffic."
  DESIGNER BAG KNOCKOFF: signature canvas (Coach C-monogram, Tory T-emblem, Michael Kors MK-monogram) without creed patch / interior brand stamp visible. → Flag: "Designer-bag shape but no interior creed patch or serial visible, verify before paying designer prices. Lookalike contemporary bag knockoffs are common."
  SUPERFAKE SEAM TELL: monogram canvas pattern (LV, Gucci, Goyard) shows visibly cut letters at the panel seams, off-color stitching, or laser-printed pattern with no fabric depth. Genuine luxury houses align canvas pattern across panels so letters never break at seams. → Flag: "Monogram pattern breaks at seams or shows printed (not woven) detail, superfake tell. Verify weave and seam alignment in person."
  HYPED SNEAKER COLLAB KNOCKOFF: collab-claim silhouette (Travis Scott reverse swoosh, Off-White zip-tie, Fragment bolt, Sacai dual-tongue) but no SKU label, box label, or co-brand insole signature visible. → Flag: "Collab-specific styling but no SKU / box / co-brand insole visible, collab fakes are the most-replicated sneaker category. Verify with StockX or GOAT before paying collab prices."
- upcycle[]: exactly 3 short, specific ideas for transforming this item to increase resale value. Before writing, identify: (1) exact material and texture, (2) specific construction details like hardware, seams, collar, lining, silhouette, (3) the era or subculture it references, (4) what niche aesthetic or current resale trend it could tap into if transformed. Use those observations to write ideas that could ONLY apply to this exact item, not any other. Each idea names a specific technique AND the niche aesthetic it creates. CLOTHING BANNED techniques (apply when category is NOT "furniture"): bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery, if you catch yourself writing one, think harder about what makes this item unique. BANNED aesthetic defaults (apply to ALL categories): do not use any of these unless the item is literally from that era/style and you can point to a specific visible detail that justifies it: cottagecore, floral, bohemian, coquette, fairy-tale, whimsical, romantic. If you catch yourself writing one of these aesthetics, delete it and think of something more specific to this item.
  FURNITURE upcycle (category = "furniture" only): the clothing BANNED list above does NOT apply. Allowed techniques: refinish (sand to natural / dark walnut stain / whitewash / limewash / cerusing / fuming); reupholster (boucle, mohair, vintage kilim, vintage textile, leather); paint frame (chalk paint, eggshell lacquer, automotive lacquer, milk paint); swap hardware (vintage brass pulls, leather pulls, ceramic knobs, custom-cast); recane or rerush (replace damaged caning or rush seat with new natural fiber); repurpose (dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard, suitcase → side table). Match technique to current spike, boucle reupholstery, limewash refinish, brass-and-cane revival are all Q2 2026 actively trending. Each idea targets a different aesthetic.
  Each of the 3 ideas must target a DIFFERENT aesthetic or subculture, never repeat the same aesthetic across the 3 ideas. Keep each under 15 words. Do not mention platforms or where to sell. Do not say "not applicable"`;

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
const RETRY_DELAYS = [3000, 8000]; // ms, Gemini 503 spikes need more breathing room

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
        // Non-overload errors: skip retries and try next provider, retrying won't help.
        if (!isOverloadError(err)) break;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }

    // Fallback to Gemini 2.5 Flash Lite, separate quota pool, so an overload on 2.5 Flash doesn't take it down.
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
  throw new Error(`All scan providers failed, ${parts}`);
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
    ? `\n\nPHOTO INTERPRETATION, you are given ${images.length} photos. Photo 1 is the COVER (the item being sold).

Most multi-photo scans are SAME-ITEM, MULTI-ANGLE shots, front, back, label, hangtag, condition close-ups. THIS IS THE EXPECTED, COMMON CASE. Most scans will NOT have a "before" photo. Only flag a transformation when the visual evidence is unambiguous.

For each ADDITIONAL photo (slots 2 through ${images.length}, in any order, a "before" photo, if one exists, can land in ANY of these slots; do not assume a fixed position), independently classify it as:

(a) Another angle of the SAME finished item, front/back, label/hangtag close-up, condition detail. (DEFAULT, choose this when uncertain, when no clear transformation is visible, or when the user has just staged angles of one finished piece.)

(b) The BEFORE state, the original thrifted base before the user customized it.

Classify a photo as (b) when AT LEAST TWO of these are true relative to photo 1:
  • Shared fabric identity, same print, color palette, fabric weight, weave, or material visible in both photos. This is the strongest single tell because fabric carries through even when the garment shape changes drastically.
  • Photo 1 shows hand-applied or restructured elements (paint, patches, embroidery, dye work, studs, beadwork, hand-distressing, hand-stitching, ruching, gathering, cinching, halter conversion, corset boning, asymmetric cut, panel splicing, raw/unfinished cut edges, restitched seams, deconstruction; for furniture: fresh stain/paint/limewash, new upholstery, new hardware, recaning, refinished surface) that this photo clearly lacks.
  • This photo shows the original factory garment intact, uniform color, original silhouette, factory hems and labels still attached, no surface decoration, no construction modification.
  • Different silhouette but same fabric, one photo shows the source garment in its original shape, the other shows that fabric/material restructured into a new garment shape.

IMPORTANT, silhouette CAN change dramatically in real upcycles. Do NOT require the two photos to share a silhouette; that requirement causes false negatives precisely on the high-labor pieces where detection matters most. Common shape-shifting transformations:
  • T-shirt → ruched top, halter, tube top, corset, asymmetric crop, bandeau, tied-back top
  • Sweater or sweatshirt → cardigan (cut open + finished edge), shrug, cropped top, vest
  • Long dress → mini dress, top + skirt set, halter
  • Jeans → skirt, shorts, tote bag, frankenpants from two pairs
  • Curtains, bedsheets, quilts, blankets, tablecloths → dress, top, jacket, pants
  • Two or more garments combined → franken-shirt, panel dress, patchwork piece
  • Furniture repurpose: dresser → bathroom vanity, ladder → blanket rack, drawer → wall shelf, door → headboard

Strong tells for (b):
  • Same fabric / print / color / material in both photos but the construction differs, the strongest single signal, especially when one photo shows that fabric in its plain factory state and the other shows it gathered, ruched, cinched, halter-converted, corset-converted, or restructured into a new shape
  • Color/pattern shift on the same shape: plain white tee → tie-dyed tee, blue denim → bleached/painted denim, plain hoodie → embroidered hoodie
  • One photo has factory tags or original branding visible; the other has them obscured, removed, or built over with custom work
  • One photo styled for resale (good lighting, full garment, modeled); the other casual (hanger, floor, flat lay, harsh lighting)
  • Furniture refurb pair on the same piece: worn-finish dresser → refinished/painted/limewashed dresser; stained-fabric chair → reupholstered (boucle, mohair, kilim); damaged caning → recaned; old hardware → new brass/leather/ceramic pulls

Tells AGAINST (b), keep as (a) angle:
  • Same surface treatment / decoration / construction as photo 1
  • Clearly a different side or detail of the finished piece (e.g., back of jacket + front of same painted jacket, both painted)
  • Consistent styling/lighting with photo 1 suggests one product shoot
  • No shared fabric, print, color, or material identity at all between the two photos, likely two unrelated items rather than a before/after pair
  • Same restructured garment shown from a different angle (front, back, side, off-shoulder, modeled in different poses). Asymmetric/draped/cinched/dolman/halter silhouettes won't be equally visible from every angle, the back of a dolman top looks "plainer" than the front because the drape and asymmetry are on the front. If the fabric, hem placement, overall garment length, and finished construction match, it's multi-angle of the AFTER, not a before/after pair.
  • Distressed, ripped, painted, embroidered, or embellished DENIM photographed from the back or side when the front is shown elsewhere. Rips, holes, shredding, paint, patches, and front-pocket decoration are anatomically concentrated on the FRONT of jeans (knees, thighs, front pockets, fly area). A back or side view of the same finished pair will legitimately show intact back panels, factory back pockets, factory rivets, intact yoke, and uniform denim, that is NOT evidence of an unmodified original, it is the back of the AFTER. If the wash, hem length, leg silhouette, and waistband all match the front photo, classify as (a) multi-angle even though this photo "looks factory intact."
  • GENERAL ANATOMICAL-CONCENTRATION PRINCIPLE: garment decoration is often one-sided by design, front-only graphic prints, knee rips on jeans, back-yoke embroidery on jackets, single-sleeve paint, asymmetric hems, one-shoulder cutouts. A clean photo of the UN-DECORATED side of a one-sided piece is multi-angle of the AFTER, not a before. Require shared decoration patterns or genuine factory-state evidence (visible original hangtag, intact factory hem where the after has a raw cut, plain shape where the after is restructured) before classifying as (b).
  • Same scene/background/setting/wardrobe/styling across all photos (same room, same mirror, same bottoms, same model in the same outfit), that's a single try-on session of one finished piece, not a transformation reveal which would require two distinct moments
  • Same finished garment across DIFFERENT scenes, lighting, or cinematic effects. If construction details persist across photos (sleeve type and cuff treatment, neckline and trim placement, hem treatment and length, fabric drape and sheen, lace/ruffle/tier placement all match), it's one finished piece filmed in multiple moments, a styled TikTok/Reel shoot, not a transformation pair. Cinematic color grading, motion blur, dramatic lighting shifts (daylight vs. moody/night), VHS scanlines, retro/film-grain filters, and video-game UI text overlays ("LOADING WORLD DATA", "DO NOT REMOVE STORAGE DEVICE", health bars, save-icon glyphs) are styling effects, NOT evidence of a different garment state. A real before photo would show the SAME fabric in an unfinished/plain construction, not the same finished construction under a moody filter.
  • Caption text, watermarks, or social media overlay describing the technique in general terms ("how I make dolman tops", "whenever I'm bored I take an old tee and...", "POV: you upcycle thrifted") OR claiming a temporal transformation sequence ("THEN I DID", "BEFORE / AFTER", "FIRST I... THEN I", "watch me transform", "look what I did", "from this to this", "from old to new") is NOT evidence of a before photo. Only VISUAL evidence of an unmodified original counts. Caption claims about transformation must still be visually verified, the narrator's text overlay does NOT substitute for showing the actual unmodified factory garment. If all photos show the same finished garment construction (matching fabric, matching seams, matching hems, matching silhouette, matching neckline treatment) and the only "before" signal is a text caption, classify ALL photos as (a) multi-angle and set beforeAfterDetected = false. The TikTok/Reel narrative pattern of "FIRST I... THEN I DID..." routinely shows only the final result with no actual before footage, the caption is voice-over text, not photographic evidence.

Outcomes:
  • All additional photos are (a) → SAME-ITEM scan. Use them together to identify the cover item. Set beforeAfterDetected = false. (Expected default.)
  • AT LEAST ONE photo is (b) → BEFORE/AFTER scan. Set beforeAfterDetected = true AND isCustom = true. Use any (a) photos to identify the cover item; treat (b) photos as evidence of labor only, do NOT price them as separate items. Pick pricing tier: if category = "furniture" → FURNITURE PRICING with FURNITURE isCustom logic (brand/era tier + 30–50% refurb premium; particleboard $80 ceiling and "refinished IKEA stays under $120" rule still apply); else if category = "homewares" → HOMEWARES PRICING with HOMEWARES isCustom logic (route to STUDIO POTTERY / ART GLASS / ANTIQUE METAL SMALLS tier as appropriate; unsigned hand-built pieces stay $15–$200, signed mid-grail $200–$1500, signed top-grail $1500–$8000+; do NOT apply the handmade labor formula); else if denim base → DENIM EXCEPTION; else if the after photo shows TWO coordinated garments from a single source (dress → top + skirt; tunic → crop + shorts; long-sleeve top → bandeau + mini; matching fabric on both pieces) → HANDMADE COORD SET EXCEPTION (route by complexity band; chiffon/cotton/satin upcycles into 2-piece sets with solid stretch lining base usually land in MODERATE $55–$95, anchor $60–$80, NOT a single-garment tier); else if category = "tops" AND the alteration is STRUCTURAL (cropping, sleeve restructure, silhouette change to bolero/shrug/cardigan/halter/tube/dolman/wrap, button-up converted to crop, raw-hem cut-and-finish, conversion to a different garment shape) → HANDMADE SEWN-FABRIC TOP EXCEPTION (route by complexity band, most factory-base restructures with one-or-two added details land in MODERATE $30–$60, not COMPLEX); else → ALTERED FACTORY BASE EXCEPTION.

When uncertain about a single photo, default to (a). But if shared fabric identity is clear AND one photo shows hand-applied or restructured work the other lacks, classify as (b) even when the silhouettes differ, that combination is the signature of a real upcycle pair.`
    : '';

  const parsed = await callWithFallback(images, promptSuffix + multiPhotoSuffix, signal);

  const paid = Number(parsed.suggestedPaid) || 10;
  let resaleLow = Number(parsed.suggestedResaleLow) || 0;
  let resaleHigh = Number(parsed.suggestedResaleHigh) || resaleLow;

  const isDenim = parsed.category === 'denim';
  // Before/after detection forces isCustom: AI saw a transformation pair (cover photo
  // shows custom work, another staged photo shows the plain base). On single-photo
  // scans the AI can't have evidence, fall back to prior verdict (which was set
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

  // DIY-distressed-only denim is the lowest tier: hours-without-skill subtractive labor
  // (rips, holes, shredding, sanding, fraying). Depop comps clear $25–$40 used-good even
  // when distressing is dense/all-over. Additive work (patches, panel swaps, embroidery,
  // hardware) escapes this clamp by matching the additive vocabulary.
  const isDistressedOnlyText = /\b(distress(ed|ing)?|ripp(ed|ing)?|shredd(ed|ing)?|sand(ed|ing)?|fray(ed|ing)?|hol(e|es|ey)|destroyed)\b/i.test(exceptionalText);
  const isAdditiveDenimText = /\b(patch(work|ed|es)?|embroider(ed|y)|bead(ed|ing)|stud(ded|s)?|grommet|panel|inset|painted|appliqu[eé]|rhinestone|hardware|sequin)\b/i.test(exceptionalText);
  const isDIYDistressedDenim = isCustomScan && isDenim && isDistressedOnlyText && !isAdditiveDenimText && !isExceptionalDenim;

  if (isDenim && isCustomScan) {
    const cap = isExceptionalDenim ? 300 : isDIYDistressedDenim ? 45 : 140;
    const floor = isDIYDistressedDenim ? 20 : 25;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(floor, Math.round(resaleLow * scale));
    }
  }
  // Handmade pants/tops split by material tier. Crochet/hand-knit/cottagecore/mending legitimately
  // commands higher tiers on Depop (visible labor + Q2 2026 TikTok-spiking, granny-square flares,
  // floral-medallion full-length pants). Sewn-fabric does not, Depop prices by finished look
  // because the market is saturated with hobbyist tutorials.
  // Bare "knit"/"knitted" excluded from the trending regex, they almost always describe
  // knit FABRIC (jersey, spandex, ponte, stretchy knit), not hand-knit yarn craft. Require
  // explicit handmade-craft signals: "hand-knit", "knitwear", "yarn", etc.
  const isCrochetKnitText = /\b(crochet(ed)?|hand[-\s]?knit(ted)?|knitwear|yarn|cottagecore|milkmaid|mending|patchwork|embroider(ed|y)|macrame|needlepoint)\b/i.test(exceptionalText);

  // Handmade coord set (two-piece) detection. Evaluated FIRST and SKIPS the single-
  // garment clamps below. A coord set is two coordinated handmade garments sold as a
  // single unit (top + skirt, crop + shorts, bandeau + mini); the labor floor doubles
  // because two garments were constructed, so the per-garment caps ($95 top, $140
  // skirt, $200 dress) underprice the set. Cap $140 unknown maker; the prompt's
  // HANDMADE COORD SET EXCEPTION teaches the model the band, this clamp is the backstop.
  const isHandmadeCoordSet = isCustomScan && !isDenim && COORD_SET_RX.test(exceptionalText);
  if (isHandmadeCoordSet) {
    const cap = 140;
    const floor = 30;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(floor, Math.round(resaleLow * scale));
    }
  }

  const isHandmadePants = parsed.category === 'bottoms' && isCustomScan && !isDenim && !isHandmadeCoordSet;
  if (isHandmadePants) {
    const cap = isCrochetKnitText ? 220 : 180;
    const floor = isCrochetKnitText ? 50 : 40;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(floor, Math.round(resaleLow * scale));
    }
  }
  const isHandmadeTop = parsed.category === 'tops' && isCustomScan && !isHandmadeCoordSet;
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

  const isAlteredDress = parsed.category === 'dresses' && isCustomScan && !isSkirtText && !isSwimText && !isHandmadeCoordSet;
  if (isAlteredDress) {
    // Basic-woven-base reworks (plaid flannel, cotton, twill, chambray, linen) cap at
    // moderate ceiling $80, NOT the complex ceiling $140. Real Depop sold comps for
    // these bases top out ~$75; the complex tier is reserved for premium fabric (silk,
    // satin, velvet) or visible boned/lined construction. The plaid flannel sweetheart
    // mini canonical case bled into $85 ceilings under the flat $140 cap; this gates
    // the upper band on either a premium-fabric mention or a complex-construction tell.
    const isBasicFabricBase = BASIC_DRESS_FABRIC_RX.test(exceptionalText)
      && !PREMIUM_DRESS_FABRIC_RX.test(exceptionalText)
      && !COMPLEX_DRESS_CONSTRUCTION_RX.test(exceptionalText);
    const cap = isExceptionalDenim ? 300 : (isBasicFabricBase ? 80 : 140);
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(35, Math.round(resaleLow * scale));
    }
  }

  // Skirts have no enum value, AI tags as dresses, bottoms, or other. Keyword-gated.
  const isAlteredSkirt = isCustomScan && isSkirtText && !isDenim && !isHandmadeCoordSet;
  if (isAlteredSkirt) {
    const cap = isExceptionalDenim ? 300 : 140;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(30, Math.round(resaleLow * scale));
    }
  }

  // Tightens isHandmadePants further, shorts have less canvas than full-length pants.
  const isAlteredShorts = isCustomScan && isShortsText && !isDenim && !isHandmadeCoordSet;
  if (isAlteredShorts && resaleHigh > 120) {
    const scale = 120 / resaleHigh;
    resaleHigh = 120;
    resaleLow = Math.max(25, Math.round(resaleLow * scale));
  }

  // Swimwear has no enum value, AI tags across categories. Keyword-gated.
  const isAlteredSwim = isCustomScan && isSwimText && !isHandmadeCoordSet;
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

  // Caps/hats/beanies, keyword-gated like skirts/shorts/swim because category enum has no
  // dedicated value. Covers altered trucker caps ($80) and handmade beanies (HANDMADE
  // ACCESSORY EXCEPTION $15–$120 ceiling, but caps top out lower than scarves/wraps).
  const isCustomCap = isCustomScan && isCapText;
  if (isCustomCap && resaleHigh > 80) {
    const scale = 80 / resaleHigh;
    resaleHigh = 80;
    resaleLow = Math.max(20, Math.round(resaleLow * scale));
  }

  // Handmade pottery clamp. The HOMEWARES PRICING prompt block routes signed studio
  // pottery to $40–$300 / $200–$1500 mid-grail / $1500–$8000+ top-grail. This clamp
  // is the belt-and-suspenders for hobbyist mugs returning custom-commission prices.
  // Unknown maker caps at $200 (matches the unsigned tier); grail-named maker unlocks
  // $1500 (mid-grail). Top-grail $8000+ relies on the prompt's pricing band; we don't
  // hard-cap above $1500 because grail-tier names rarely false-positive (named makers
  // require an explicit string match in the description).
  const isHandmadePottery = parsed.category === 'homewares' && isCustomScan && POTTERY_RX.test(exceptionalText);
  if (isHandmadePottery) {
    const hasGrailName = GRAIL_POTTER_RX.test(exceptionalText);
    const cap = hasGrailName ? 1500 : 200;
    const floor = hasGrailName ? 200 : 15;
    if (resaleHigh > cap) {
      const scale = cap / resaleHigh;
      resaleHigh = cap;
      resaleLow = Math.max(floor, Math.round(resaleLow * scale));
    }
  }

  // Art-glass clamp. Unsigned "Murano-style" / "Tiffany-style" / "art glass" without a
  // grail signature stays at the unsigned modern decorative tier ceiling ($300).
  // Signed studio glass (Venini, Seguso, Lalique, Loetz, Daum, Gallé, Tiffany,
  // Steuben, etc.) unlocks the legitimate signed bands per the GLASS SIGNATURE rule.
  const isCustomArtGlass = parsed.category === 'homewares' && isCustomScan && ART_GLASS_RX.test(exceptionalText);
  if (isCustomArtGlass && !SIGNED_GLASS_RX.test(exceptionalText) && resaleHigh > 300) {
    const scale = 300 / resaleHigh;
    resaleHigh = 300;
    resaleLow = Math.max(25, Math.round(resaleLow * scale));
  }

  // Condition-penalty scale-down for homewares. Mirrors tier 088 CONDITION PENALTIES
  // (40–60% off mid-range for hairline/chip/crack, 20–35% for crazing, 25–40% for
  // glaze loss). Picking 0.65× as a single multiplier that lands in the middle of
  // those bands and applies uniformly. Both ends of the range scale together so the
  // band stays proportional.
  if (parsed.category === 'homewares' && POTTERY_CONDITION_PENALTY_RX.test(`${parsed.name ?? ''} ${parsed.sub ?? ''}`)) {
    resaleHigh = Math.round(resaleHigh * 0.65);
    resaleLow = Math.round(resaleLow * 0.65);
  }

  // Boost-stacking guard for FACTORY items only, custom items have their own
  // clamps above. Catches the compound case: 3+ independent boost buckets
  // triggered on the same item (era × embellishment × denim_spike × trend).
  // Single/double legitimate boosts (vintage Big E, Diesel flare alone, NWT
  // designer drop) stay below threshold and pass through. Luxury keywords
  // bypass entirely, those tiers price legitimately above the ceilings.
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
  // pieces. Particleboard is the one signal worth a hard floor, printed-paper
  // veneer on MDF/laminate never resells above $80 regardless of brand.
  const isFurniture = parsed.category === 'furniture';
  if (isFurniture) {
    const furnitureText = `${parsed.name ?? ''} ${parsed.sub ?? ''}`;
    const PARTICLEBOARD_RX = /\b(particleboard|particle\s*board|mdf|laminate|melamine|press(ed)?\s*(wood|board)|engineered\s*wood)\b/i;
    if (PARTICLEBOARD_RX.test(furnitureText) && !MCM_BRAND_RX.test(furnitureText) && resaleHigh > 80) {
      resaleHigh = 80;
      resaleLow = Math.min(resaleLow > 0 ? resaleLow : 20, 40);
    }
    // MCM-style without authenticated maker. The prompt directs unlabeled Eames /
    // mid-century / Danish-modern replicas to the $80-$300 band with a 30-50% refurb
    // premium that stays WITHIN the band (top $450). In practice the model lets
    // refurb labor stack past the cap when reupholster + refinish + chrome polish
    // read as "premium restoration." Clamp enforces the ceiling: $300 unrestored /
    // $450 with refurb. Skip when an authentic MCM brand name is present
    // (MCM_BRAND_RX), trusting the model's label-confirmed attribution.
    const isMCMStyle = MCM_STYLE_RX.test(furnitureText) && !MCM_BRAND_RX.test(furnitureText);
    if (isMCMStyle) {
      const cap = isCustomScan ? 450 : 300;
      if (resaleHigh > cap) {
        const scale = cap / resaleHigh;
        resaleHigh = cap;
        resaleLow = Math.max(80, Math.round(resaleLow * scale));
      }
    }
  }

  // Jewelry-specific clamps. Mirrors the particleboard pattern. Skipped on
  // isCustomScan because handmade jewelry (wire-wrap, polymer clay, beaded)
  // legitimately has no metal hallmark, the HANDMADE JEWELRY EXCEPTION tier
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
      // Signed vintage costume tier (Trifari/Coro/Weiss/Haskell/etc.), these have
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
      // disagreed with the prior estimate, don't lock them back to it.
    }
  }

  if (resaleLow > resaleHigh) [resaleLow, resaleHigh] = [resaleHigh, resaleLow];
  // Lean-low headline: band low + 30% of width, not midpoint. Resale comps
  // cluster at the low end of any range; midpoint produced listings that didn't
  // move. AI tier band already adjusts low/high for condition (PROMPT CONDITION
  // ADJUSTMENT); this picks the right anchor within whatever band came back.
  const resale = resaleLow > 0
    ? roundDisplayPrice(resaleLow + (resaleHigh - resaleLow) * 0.3)
    : 0;

  // WATCH NAME CLAMP: when the item is a watch (under accessories) and the
  // leading word isn't a known watch brand or a generic descriptor, strip it.
  // Catches watermark text / box engravings / social-media handles that the
  // model still attaches as a "brand" prefix despite the prompt rule
  // (e.g. "ZUNAIRA Gold-Tone Octagonal Chronograph...").
  let cleanedName = String(parsed.name || 'Unknown Item');
  const isWatch = parsed.category === 'accessories' &&
    WATCH_NAME_KEYWORD_RX.test(`${cleanedName} ${parsed.sub || ''}`);
  if (isWatch) {
    let safety = 0;
    while (safety < 3) {
      if (WATCH_BRAND_RX.test(cleanedName)) break;
      if (WATCH_DESCRIPTOR_RX.test(cleanedName)) break;
      const stripped = cleanedName.replace(/^\S+\s+/, '');
      if (stripped === cleanedName) break;
      cleanedName = stripped.trim();
      safety++;
    }
  }

  // Furniture companion-item hallucination strip. Belt-and-suspenders for the
  // VISIBLE-ONLY NAMING prompt rule; catches "and Ottoman" / "with footstool"
  // trailing on chair-only scans where the model inferred the famous 670/671
  // pairing. Conservative trailing match only, won't strip legitimately bundled
  // scans where companion items appear elsewhere in the title.
  if (parsed.category === 'furniture') {
    cleanedName = cleanedName.replace(
      /\s+(?:and|with|\+|&)\s+(?:ottoman|footstool|footrest|cushion(?:s)?|side\s+table|coffee\s+table|matching\s+(?:\w+\s+)?(?:piece|set|chair|table|stool|ottoman))$/i,
      ''
    ).trim();
  }

  return {
    name: cleanedName,
    sub: String(parsed.sub || ''),
    profit: resaleLow > 0 ? `${formatMoney(resaleLow)}–${formatMoney(resaleHigh)}` : '',
    suggestedPaid: paid,
    suggestedResale: resale,
    suggestedResaleLow: resaleLow,
    suggestedResaleHigh: resaleHigh,
    isCustom: parsed.isCustom === true || detectCustomFromText(cleanedName, parsed.sub),
    category: VALID_CATEGORIES.includes(parsed.category as ItemCategory)
      ? (parsed.category as ItemCategory)
      : 'other',
    // Furniture, jewelry, and luxury bags have legitimately wide tier ranges
    // (vintage walnut credenza $80–$2000; solid gold tier $40–$700+; LV monogram
    // $100–$1700) that are not low confidence, just by-karat-by-weight,
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
1. What is this item made of, exact material, weight, and texture?
2. What details does it have, hardware, seams, collar, cuffs, lining, print, silhouette?
3. What era or subculture does it reference, workwear, Y2K, vintage prep, 90s grunge, etc.?
4. What niche aesthetic or current resale trend could this specific item tap into if transformed?

Use those answers to generate 3 ideas that could ONLY apply to this exact item, not to any other item. Each idea should feel like it was written by someone who actually studied this specific photo, not someone brainstorming crafts in general.

Return ONLY a valid JSON object, no markdown fences, no explanation:
{
  "upcycle": [
    "First transformation idea",
    "Second transformation idea",
    "Third transformation idea"
  ]
}

Rules:
- Each idea names a specific technique AND the niche aesthetic or trend it creates
- BANNED techniques, never suggest regardless of item: bleach dye, tie-dye, cropping, patches, pins, buttons, generic embroidery. If you catch yourself writing one, delete it and think harder about what makes THIS item unique
- BANNED aesthetic defaults, do not use any of these unless the item is literally from that era/style and you can point to a specific visible detail that justifies it: cottagecore, floral, bohemian, coquette, fairy-tale, whimsical, romantic. If you catch yourself writing one of these, delete it and think of something more specific to this item
- Each of the 3 ideas must target a DIFFERENT aesthetic or subculture, never repeat the same aesthetic across the 3 ideas
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
Pricing: price by FINISHED LOOK that an unknown maker actually sells for on Depop/Etsy/Poshmark. Do NOT use a labor-hour formula, unknown makers cannot command labor-rate pricing in a saturated handmade market, and labor math consistently overshoots actual sold comps by 30–80%. Default to unknown-maker tiers below; named established Etsy/Depop creators with documented sale history may exceed ceilings.
FIRST-PASS ANCHORING: within any tier band, DEFAULT to lower-middle (band low + 30% of band width), NOT the upper edge. Unknown-maker comps cluster at lower-middle. Reserve upper third for items with EXPLICIT upper-tier signals (named established creator, NWT/tags visible, documented vintage Big E/501XX base, exceptional construction keywords matched, mint condition).
CONDITION DEFAULT: assume "used-good" when condition is not explicitly visible. Visual cleanness ≠ excellent. Reserve top-of-range for visible tags or unmistakable mint condition. When unsure, used-good is safe.
suggestedPaid = materials cost estimate ($10–$60).
DEFAULT TIER LADDER (apply when no specific category exception below matches): simple (small, basic execution) $15–$45; moderate (mid-size, refined execution, on-trend aesthetic) $30–$80; complex (large, intricate technique, multi-stage construction) $60–$160. Hard ceiling $160 unknown maker; named established creators may reach $300.
CONDITION ADJUSTMENT: reduce both low and high by 30–50% for visible damage (stains, non-decorative holes, heavy pilling, fading, broken hardware, scuffed/peeling leather, tarnish). Reduce 15–25% for moderate wear. NWT/like-new commands the top of the range. Unclear condition = assume "used-good" and no adjustment.
DENIM EXCEPTION, if category = "denim": Upcycled jeans is saturated on Depop/Etsy and prices by finished look. Simple SUBTRACTIVE mods (DIY rips/holes/shredding/sanding/distressing, even dense or all-over, even paired with a crop or bleach wash) $20–$40; density of DIY rips is NOT a craftsmanship signal. Simple ADDITIVE mods (basic iron-on patches, plain dye/bleach, simple painted graphic) $25–$55; moderate rework (sewn-on patchwork panel, contrasting fabric inset, decorative topstitching, studded/grommet hardware) $45–$85; elaborate custom (intricate beading, franken-construction, verifiable vintage Big E/501XX base) $70–$140. Hard ceiling $140 unless the base is documented vintage Levi's Big E/501XX or maker is a named established creator (then cap $220). EXCEPTIONAL CONSTRUCTION OVERRIDE, rare case only: denim rebuilt into a new garment shape via woven/lattice patchwork, sculpted halter/corset/bustier, deconstructed couture-style assembly, or denim quilted into a wholly new silhouette: $150–$300. To unlock you MUST include at least one of "lattice", "woven denim", "sculpted", "corset", "bustier", "halter", "deconstructed", "couture", or "quilted denim" in the sub field. Without exceptional construction stay under $140.
FURNITURE EXCEPTION, if category = "furniture": Pricing = brand/era tier as base + 30–50% labor premium for skilled refinish/refurb work. Do NOT exceed the subcategory ceiling for the base piece, refinished IKEA stays under $120 regardless of effort. Particleboard $80 hard ceiling; refinish on particleboard adds $0, call out as red flag if user invested labor in particleboard. Refinishing only meaningfully boosts pieces with quality bones (solid wood, MCM lines, antique structure). Authenticated MCM (Eames, Knoll, Wegner, Saarinen, Cassina, Vitra, Nakashima with visible label/stamp) refurbed: brand tier + 30–50% premium per main FURNITURE PRICING.
HOMEWARES EXCEPTION, if category = "homewares": Pricing follows the main HOMEWARES PRICING tiers, NOT a generic handmade labor formula. Hand-built / wheel-thrown / hand-blown / hand-forged work without a visible maker signature stays at the unsigned tier ($15–$200 for pottery, $15–$80 for glass, $10–$50 for unmarked metal). Visible signature → mid-grail or top-grail tier per the POTTERY HALLMARK & MAKER rule. A hobbyist mug priced like a custom commission is the most common over-pricing error here; the labor-hours of a hand-thrown mug do NOT command the same premium as a labor-hours of a hand-sewn garment because the Etsy / Chairish buyer pool for ceramics anchors to maker recognition, not labor.
ALTERED FACTORY BASE EXCEPTION, SURFACE DECORATION ONLY (paint, patches, studs, hand embroidery, rhinestones, dye/bleach work) on a factory-made base where the original silhouette is preserved. STRUCTURAL ALTERATION (cropping, sleeve restructure, silhouette change, conversion to a different garment shape, e.g. button-up shirt → bolero/shrug/cardigan, tee → halter/dolman/tube/corset) is NOT this tier, route tops to HANDMADE SEWN-FABRIC TOP EXCEPTION below. Price = base brand tier + 30–60% customization premium. Caps: painted sneakers $120 unbranded / $180 branded (Nike, Adidas, Vans) / $260 hyped silhouettes (Jordan, Dunk, Yeezy), exceed only for named established artists. Altered tops (hoodies, tees, halter tops, tank tops, crop tops, blouses, camis) and jackets, DECORATION ONLY: light decoration (few patches, simple painted graphic, scattered studs) $25–$45 unbranded / $35–$60 branded; dense decoration (skilled hand-painted, dense applique/embroidery, allover rhinestones) $40–$70 unbranded / $55–$90 branded; premium streetwear/designer base may add $20–$40 over the branded number; hard ceiling $130 unless named established artist. NOTE: "$X unbranded / $Y branded" are POINT ESTIMATES anchored to base tier, they are NOT a range to span. Altered pants/trousers/joggers (NON-DENIM, for denim see DENIM EXCEPTION above): pants are a secondary canvas vs jackets and the resale ceiling is lower. Light paint/few patches $40–$70; skilled hand-painted or dense applique/embroidery $80–$140 unbranded / $100–$160 branded base; hard ceiling $180 unless the maker is a named established creator. Do NOT price altered pants in jacket tiers ($200+). Custom bags/caps: $40 unbranded / $80 branded. Altered dresses (NON-DENIM, factory shirt/dress restructured into a new dress silhouette, for denim see DENIM EXCEPTION above): simple (single-seam restructure, basic neckline, plain shape, minimal added construction) $30–$50; moderate (sweetheart/V-neck/square/halter neckline, fitted bodice, structured seams, button-up flannel→dress with darts or sweetheart shaping, shirt-to-dress with one or two construction details) $50–$80; complex (multi-fabric pairing, intricate seaming, boned bodice, fully-lined construction, statement architectural details) $80–$140. Hard ceiling $140 unknown maker; named established maker may exceed. WORKED EXAMPLE: button-up plaid flannel shirt restructured into sweetheart-neckline fitted mini dress = MODERATE tier; default to lower-middle anchor ~$55–$60 per FIRST-PASS ANCHORING (band low + 30% width = $50 + $9 = $59), NOT upper-moderate $75+. Plaid flannel is a basic-tier base fabric on Depop, not a premium fabric like silk/satin/velvet; sweetheart neckline + fitted bodice on a flannel base is the moderate prototype, not an upper-moderate signal. Altered skirts (NON-DENIM, mini, midi, maxi): $30 to $140 ceiling. Altered shorts (NON-DENIM): $25 to $120 ceiling. Custom swimwear (swimsuit, bikini, one-piece, swimwear, trunks): $25 to $120 ceiling. Altered non-sneaker shoes (boots, heels, sandals, loafers): $40 to $200 ceiling. To unlock these bands you MUST include the relevant term ("skirt", "shorts", "bikini", "swim", "boots", "heels", "sandals", "loafers") in the "name" or "sub" field. This exception does NOT apply to from-scratch handmade (crochet, knit, sewn from raw fabric, fiber art).
HANDMADE OUTERWEAR EXCEPTION, category = "outerwear" AND from-scratch handmade or fully-constructed upcycle. Two sub-tracks, pick the one that matches construction type:
  (i) FIBER-ART OUTERWEAR (handmade cardigans, dusters, knit/crochet jackets, hand-loomed coats): simple (basic granny-square cardigan, plain knit duster) $35–$80; moderate (intricate stitch, mid-size, mosaic crochet, fitted) $55–$120; complex (multi-color tapestry crochet, hand-spun yarn, structured tailoring, large-format) $90–$180.
  (ii) REPURPOSED-TEXTILE / SEWN-FABRIC OUTERWEAR (blanket-to-jacket, quilt-to-coat, tablecloth-to-blazer, curtain-to-duster, bedsheet-to-jacket, towel-to-jacket, patchwork-panel jacket, frankenjacket from multiple sources, structured shacket/chore-coat sewn from raw fabric). Minimum tier is MODERATE, do NOT use the simple band for this sub-track because the construction labor floor (deconstruct source textile, draft pattern, sew bulky weave, install collar/sleeves/closure/lining) sits well above plain knit. Moderate (unlined or partially-finished, single source textile, basic collar/closure, cropped or simple silhouette) $55–$120; complex (lined or fully-finished interior, sherpa/quilted/satin lining, full seam finishing, structured collar, functional buttons/snaps/zip, multi-panel patchwork, cropped jacket from blanket fabric with sherpa lining, fully-constructed shacket) $90–$180.
  Within sub-track (ii), FIRST-PASS ANCHORING is RELAXED, anchor band mid-to-upper, not lower-middle. Depop sold comps for blanket-jackets, quilt-coats, and tablecloth-blazers cluster $90–$160, not the typical handmade $50 floor. WORKED EXAMPLE: sherpa-lined cropped jacket from plaid blanket fabric with collar and button front = COMPLEX in sub-track (ii); anchor $130–$160, NOT $55–$85.
  Hard ceiling $180 either sub-track unless named established maker.
HANDMADE COORD SET EXCEPTION, evaluate BEFORE the single-garment dress/skirt/top/pants exceptions below. A coord set is two coordinated handmade garments sold as a single unit (top + skirt, crop top + shorts, bandeau + mini, halter + pants, tube top + skirt, two pieces in the same fabric or matching print). The labor floor is HIGHER than any single-garment tier because TWO finished garments were constructed (deconstruct source if upcycle, draft two patterns, sew/finish both pieces, add lining or structured waistband on each). Detection: the "name" or "sub" must contain either an explicit set keyword ("set", "two-piece", "2pc", "coord", "coordinate", "coordinated", "matching set") OR pair a top-keyword with a bottom-keyword ("top and skirt", "crop with shorts", "bandeau + mini", "tube top and mini skirt"). Tiers: simple (basic deconstruct + minimal finishing, plain shapes, no added lining) $40–$70; moderate (added solid stretch lining or base layer on one or both pieces, structured low-rise waistband, fitted/cropped silhouette, flounce or ruffle overlay, on-trend coquette/fairy/Y2K aesthetic) $55–$95; complex (multi-step finishing on both pieces, multiple coordinated details, multi-fabric pairing, statement construction) $80–$140. Hard ceiling $140 unknown maker; named established maker may reach $220. WORKED EXAMPLE: chiffon midi dress upcycled into strapless crop top + low-rise mini skirt with solid stretch lining base on both pieces = MODERATE coord set, anchor $60–$80, reserve $85+ for explicit upper-tier signals.
HANDMADE DRESS EXCEPTION, non-denim, non-altered handmade dresses (category = "dresses" AND from-scratch, not altered factory base): simple (plain crochet/knit slip, basic sewn shift) $30–$70; moderate (cottagecore midi, fitted construction, lace trim, bias-cut sewn) $50–$120; complex (full-skirt crochet maxi, multi-panel sewn gown, smocked or boned construction) $90–$200. Hard ceiling $200 unless named established maker.
HANDMADE SKIRT EXCEPTION, non-denim, non-altered handmade skirts: simple $20–$50; moderate (granny-square midi, fitted maxi) $35–$85; complex (full-skirt crochet, multi-panel sewn) $65–$140. Hard ceiling $140 unless named established maker.
HANDMADE PANTS EXCEPTION, non-denim, non-altered, from-scratch handmade pants (category = "bottoms"). Material tier matters, crochet/hand-knit pants are TikTok-spiking Q2 2026 and command meaningfully more than sewn-fabric handmade pants. Sewn-fabric (cotton/linen/silk wide-leg, palazzo, harem, drawstring trousers, NOT crochet/knit): simple (basic elastic-waist, plain) $30–$60; moderate (silk/custom print, fitted, drawstring detail) $50–$95; complex (multi-panel, structured waistband, statement construction) $80–$160. Hard ceiling $160 unknown maker. Crochet / hand-knit / macrame (granny-square flares, floral-medallion full-length, fishnet-style, doily-pattern wide-leg): simple (single-stitch joggers, basic shorts-length) $50–$90; moderate (granny-square flare or wide-leg, mid-complexity medallion pattern) $80–$150; complex (full-length intricate floral-medallion, multi-panel custom, oversized labor-intensive crochet) $130–$220. Hard ceiling $220 unknown maker. WORKED EXAMPLE: full-length white floral-medallion crochet flare pants = COMPLEX crochet tier; default to lower-middle anchor ~$140–$160 per FIRST-PASS ANCHORING (band low + 30% width), reserve $200+ for explicit upper-tier signals (named maker, NWT, exceptional density).
HANDMADE BAG EXCEPTION, from-scratch handmade bags (crochet, macrame, woven, hand-loomed, hand-stitched leather): simple (crochet pouch, macrame mini bag, basic clutch) $20–$50; moderate (mid-size crochet tote, market bag, woven shoulder bag) $35–$85; complex (large hand-loomed leather, structured macrame, hand-stitched designer-grade) $60–$140. Hard ceiling $140 unless named established maker.
HANDMADE ACCESSORY EXCEPTION (non-jewelry), handmade scarves, hats, beanies, gloves, mittens, leg warmers, belts, hair accessories, headbands: simple (basic crochet beanie, plain scarf) $15–$40; moderate (intricate stitch, on-trend silhouette, fitted) $25–$70; complex (oversized hand-loomed, multi-color tapestry, named technique) $50–$120. Hard ceiling $120 unless named established maker.
HANDMADE FIBER-ART STANDALONE EXCEPTION, tapestry, wall hanging, weaving, blanket, throw, quilt, wall art, embroidery hoop art, punch-needle art (not garment): small (under 18", embroidery hoop, small wall art) $25–$80; medium (24–36", lap blanket, mid-size tapestry) $60–$160; large (large tapestry, full quilt, oversized weaving, statement piece) $120–$300. Hard ceiling $300 unless named established fiber artist.
HANDMADE TOP CEILING, for from-scratch crochet/hand-knit/knitwear/cottagecore/embroidered/mending tops (category = "tops"): hard ceiling $180 unless the maker is a named established creator. NOTE: bare "knit" or "knitted" describing fabric (jersey, stretchy knit, ribbed knit, ponte) is NOT this tier, that's factory knit fabric, route through HANDMADE SEWN-FABRIC TOP EXCEPTION below. This tier requires explicit handmade-craft signal: "hand-knit", "crochet", "knitwear", "yarn", etc.
HANDMADE SEWN-FABRIC TOP EXCEPTION, if the item is a from-scratch handmade or restructured top sewn or constructed from fabric (satin, silk, cotton, jersey, knit fabric, stretchy knit, ribbed knit, ponte, woven, polyester, rayon, viscose, chiffon, linen, NOT crochet, hand-knit, or knitwear): Sewn handmade tops on Depop/Etsy price by finished look. Tiers (calibrated to actual unknown-maker Depop sold comps): simple (basic tank, tee, cami, plain shape, basic crop, off-shoulder cut, tee just cropped, tee with one applied detail) $20–$45; moderate (fitted with detail, V-neck, ruching, lace trim, gathered waist, darts, dolman/wrap silhouettes, halter conversion from a tee, button-up shirt cropped into bolero/shrug/cardigan with restructured or gathered/puff sleeves, raw-hem cut-and-finish, tie/knot closure conversion) $30–$60; complex (tailored blouse, structured top, intricate seaming, French seams, boning, multi-panel construction, multi-step restructure with several distinct construction techniques combined) $50–$95. Hard ceiling $95 unless the maker is a named established creator with documented sales history. To unlock these bands you MUST include the relevant material term ("satin", "silk", "cotton", "knit fabric", "stretchy knit", "jersey", "sewn", "stitched", "fabric") in the "name" or "sub" field. Do NOT price handmade tops in jacket-altered or pants-altered tiers ($200+). A tee restructured into a dolman/halter/ruched/draped silhouette belongs in moderate ($30–$60). A factory shirt cropped into a bolero/shrug with restructured puff sleeves and a tie/knot detail also belongs in moderate ($30–$60), NOT complex.
HANDMADE JEWELRY EXCEPTION, if the item is handmade jewelry (wire-wrap pendants, polymer clay earrings, beaded necklaces, hemp/macrame chokers, resin pieces, hand-stamped metal, spoon/fork rings, friendship bracelets): IGNORE the metal-hallmark requirement. Tiers by complexity: simple (single bead/charm, basic wire-wrap, plain hand-stamped tag, friendship bracelet) $15–$40; moderate (multi-bead/stone, intricate wire-wrap, resin with inclusions, hand-stamped detailed, polymer clay set) $30–$80; complex (gemstone wire-wrap, micro-macrame, electroformed, sterling/copper base + cabochon stones, hand-fabricated metalsmithing) $60–$180. Hard ceiling $180 unless the maker is a named established Etsy/Depop creator with documented sale history. To unlock these bands you MUST include the relevant term ("wire-wrap", "polymer clay", "beaded", "macrame", "resin", "hand-stamped", "handmade", or a jewelry-type word like "earrings", "pendant", "necklace", "bracelet", "ring") in the "name" or "sub" field.
NO TRENDING BOOST, do NOT apply any "+20–30% trending handmade" or "uniqueness premium" markup. The tiers above are already calibrated for unknown-maker Depop comps. "Looks impressive" or "took a long time to make" are NOT reasons to exceed the unknown-maker ceiling, buyers price on finished look + maker reputation, not perceived effort.`;

const RESCAN_CORRECTION_SUFFIX = (prior: ScanScenario) => `\n\nIMPORTANT: This is a RESCAN. The user tapped "this scan is wrong" on your previous output for this exact photo. Your previous output was:
- name: "${prior.name}"
- sub: "${prior.sub}"
- category: "${prior.category ?? 'other'}"
- isCustom: ${prior.isCustom === true}
- beforeAfterDetected: ${prior.beforeAfterDetected === true}
- suggestedResaleLow: $${prior.suggestedResaleLow ?? 0}
- suggestedResaleHigh: $${prior.suggestedResaleHigh ?? 0}
- confidence: ${prior.confidence ?? 'low'}

Re-examine the photo with FRESH EYES. The user believes something is wrong, but did NOT say what. Consider what you may have missed:
1. BRAND, visible logo, label, or stitching you overlooked? Misidentified brand can swing price 3–10x.
2. CONDITION, pilling, stains, holes, fading, hardware damage that should pull price DOWN?
3. ERA / MATERIAL, vintage construction (single-stitch, union-made tag, chain-stitched hem), genuine leather, silk, cashmere, wool that should pull price UP?
4. CATEGORY, did you miscategorize? (e.g. dress called a top, denim called bottoms)
5. CUSTOM/HANDMADE, is this actually reworked/handmade in a way that changes the pricing tier?

Then return your normal JSON output PLUS one extra top-level field:
"correction": "lower" | "higher"

- "lower", prior price was too HIGH; output new lower prices.
- "higher", prior price was too LOW; output new higher prices.

The user explicitly flagged this scan as wrong. Commit to a direction. Do NOT echo the prior prices unchanged, re-examine brand, condition, era, material, and category, and let your verdict shift the price.

DEFAULT BIAS, when uncertain about direction, choose "lower". User "wrong scan" flags are most often overprice protests, not underprice protests; sellers know when an item won't move at the suggested price. Reserve "higher" for cases where you can name a SPECIFIC upper-tier signal you missed on the first pass: visible vintage Big E tab, NWT/original tags hanging, named designer label legible, chain-stitched hem, union-made tag, single-stitch construction, premium material tag (cashmere/silk/leather verified), mint condition with original packaging or box. Generic descriptors like "distressed", "looks worn", "feels vintage", or "strong brand name" are NOT upper-tier signals, those are already factored into the modern factory tier. Modern Levi's, Madewell, AG, Gap, Old Navy with factory distressing belong in their modern tier, not vintage. When the prior price falls within the correct factory tier and rescrutiny does not surface an explicit upper-tier signal you missed, choose "lower" and pull both ends down 15–25%.`;

export async function rescanAsHandmade(photoUris: string | string[], signal?: AbortSignal, priorResult?: ScanScenario): Promise<ScanScenario> {
  const uris = Array.isArray(photoUris) ? photoUris : [photoUris];
  const suffix = HANDMADE_SUFFIX + (priorResult ? RESCAN_CORRECTION_SUFFIX(priorResult) : '');
  return runScanPipeline(uris, suffix, signal, priorResult);
}
