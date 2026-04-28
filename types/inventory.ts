export type ItemCategory =
  | 'denim'
  | 'bottoms'
  | 'tops'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'bags'
  | 'accessories'
  | 'other';

/** All valid categories; use for pickers and storage validation. */
export const ITEM_CATEGORIES: ItemCategory[] = [
  'tops',
  'dresses',
  'bottoms',
  'denim',
  'outerwear',
  'shoes',
  'bags',
  'accessories',
  'other',
];

export type ItemStatus =
  | 'unlisted'
  | 'listed'
  | 'sold';

export type Platform = string;

export type ItemIntent = 'flip' | 'closet';

export interface ItemScanSnapshot {
  id: string;
  createdAt: number;
  sub: string;
  profit: string;
  confidence?: 'high' | 'medium' | 'low';
  isCustom?: boolean;
  ideas: ScanScenarioIdea[];
  upcycle?: string[];
  /** Authenticity checks for luxury/designer items the buyer should verify. */
  authFlags?: string[];
  /** Red flags — prominent warnings (AI prints, etc). */
  redFlags?: string[];
  sourceImageUri?: string;
  sourceImageUris?: string[];
}

export interface Item {
  id: number;
  name: string;
  cat: ItemCategory;
  paid: number | null;
  resale: number;
  status: ItemStatus;
  date: string;
  store: string;
  platform: Platform;
  notes: string;
  soldPrice: number | null;
  img: string;
  photos?: string[];
  intent: ItemIntent;
  scanSnapshots?: ItemScanSnapshot[];
  activeScanSnapshotId?: string;
  updatedAt?: number;
}

export interface ScanScenarioIdea {
  e: string;
  t: string;
  p: string;
  ideaIcon: string;
}

export interface ScanScenario {
  name: string;
  sub: string;
  profit: string;
  /** Suggested thrift/materials price when adding from scan. */
  suggestedPaid?: number;
  /** Midpoint resale price (average of low and high). */
  suggestedResale?: number;
  /** Conservative resale estimate. */
  suggestedResaleLow?: number;
  /** Optimistic resale estimate. */
  suggestedResaleHigh?: number;
  ideas: ScanScenarioIdea[];
  /** AI-generated upcycle/customization ideas to increase resale value. */
  upcycle?: string[];
  /** Authenticity checks for luxury/designer items the buyer should verify. */
  authFlags?: string[];
  /** Red flags for AI-generated prints, suspicious items. Always shown prominently. */
  redFlags?: string[];
  /** Confidence in resale pricing — low means sparse comps. */
  confidence?: 'high' | 'medium' | 'low';
  /** Detected item category. */
  category?: ItemCategory;
  /** True if item appears handmade, reworked, or custom. */
  isCustom?: boolean;
  /** Transient: AI's verdict from a "wrong scan" rescan. Not persisted in ItemScanSnapshot. */
  correction?: 'lower' | 'higher' | 'same';
  /** Transient: user answered the red-flag yes/no prompt (hides the prompt row). Not persisted in ItemScanSnapshot. */
  promptRedFlagDismissed?: boolean;
  /** Transient: user marked the red flag as a false alarm (collapses banner to thin pill). Not persisted in ItemScanSnapshot. */
  redFlagDismissed?: boolean;
}
