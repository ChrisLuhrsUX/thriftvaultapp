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
  ideas: ScanScenarioIdea[];
  sourceImageUri?: string;
}

export interface Item {
  id: number;
  name: string;
  cat: ItemCategory;
  paid: number;
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
  /** Suggested thrift price when adding from scan (realistic). */
  suggestedPaid?: number;
  /** Suggested resale price when adding from scan (realistic). */
  suggestedResale?: number;
  ideas: ScanScenarioIdea[];
  /** Confidence in resale pricing — low means sparse comps. */
  confidence?: 'high' | 'medium' | 'low';
  /** Detected item category. */
  category?: ItemCategory;
}
