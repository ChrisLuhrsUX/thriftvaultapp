import { LEGACY_DEMO_ITEM_NAMES } from '@/constants/seedItems';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ITEM_CATEGORIES, type Item, type ItemCategory, type ItemIntent, type ItemScanSnapshot } from '@/types/inventory';

const TV_INV_KEY = 'tv_inv';

const sanitizeSnapshot = (raw: unknown): ItemScanSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<ItemScanSnapshot>;
  const createdAt = Number(source.createdAt);
  if (!Number.isFinite(createdAt)) return null;
  const id = typeof source.id === 'string' && source.id.trim().length > 0
    ? source.id
    : String(createdAt);
  const sub = typeof source.sub === 'string' ? source.sub : '';
  const profit = typeof source.profit === 'string' ? source.profit : '';
  const confidence =
    source.confidence === 'high' || source.confidence === 'medium' || source.confidence === 'low'
      ? source.confidence
      : undefined;
  const ideas = Array.isArray(source.ideas)
    ? source.ideas.filter((idea): idea is ItemScanSnapshot['ideas'][number] =>
      !!idea &&
      typeof idea === 'object' &&
      typeof idea.t === 'string' &&
      typeof idea.p === 'string' &&
      typeof idea.e === 'string' &&
      typeof idea.ideaIcon === 'string'
    )
    : [];
  const sourceImageUri = typeof source.sourceImageUri === 'string' ? source.sourceImageUri : undefined;
  return { id, createdAt, sub, profit, confidence, ideas, sourceImageUri };
};


interface InventoryContextValue {
  inventory: Item[];
  addItem: (item: Item) => void;
  addItems: (items: Item[]) => void;
  updateItem: (id: number, updates: Partial<Item>) => void;
  updateItemsByDate: (date: string, updates: Partial<Item>) => void;
  removeItem: (id: number) => void;
  setInventory: (items: Item[]) => void;
  getItemById: (id: number) => Item | undefined;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventoryState] = useState<Item[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TV_INV_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Item[];
          const stored = Array.isArray(parsed) ? parsed : [];
          const withIntent = stored.map((i) =>
            'intent' in i && (i.intent === 'flip' || i.intent === 'closet')
              ? i
              : { ...i, intent: 'flip' as ItemIntent }
          );
          const withStatus = withIntent.map((i) => {
            const status = String(i.status);
            if (status === 'in-progress' || status === 'needs-work') {
              return { ...i, status: 'unlisted' as const };
            }
            return i;
          });
          const currentYear = new Date().getFullYear();
          const withDates = withStatus.map((i) => {
            const d = new Date(i.date);
            if (Number.isNaN(d.getTime()) || d.getFullYear() <= currentYear) return i;
            const normalized = new Date(currentYear, d.getMonth(), d.getDate());
            return {
              ...i,
              date: normalized.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            };
          });
          const sanitized = withDates.map((i) => {
            const rawCat = (i as { cat?: unknown }).cat;
            const cat: ItemCategory =
              typeof rawCat === 'string' && ITEM_CATEGORIES.includes(rawCat as ItemCategory)
                ? (rawCat as ItemCategory)
                : 'other';
            return {
            ...i,
            id: Number(i.id),
            paid: i.paid != null ? Number(i.paid) : null,
            resale: Number(i.resale),
            soldPrice: i.soldPrice != null ? Number(i.soldPrice) : null,
            name: String(i.name),
            store: String(i.store),
            notes: String(i.notes),
            cat,
            scanSnapshots: Array.isArray((i as { scanSnapshots?: unknown[] }).scanSnapshots)
              ? (i as { scanSnapshots?: unknown[] }).scanSnapshots
                ?.map(sanitizeSnapshot)
                .filter((snap): snap is ItemScanSnapshot => !!snap)
                .sort((a, b) => b.createdAt - a.createdAt)
              : undefined,
            activeScanSnapshotId:
              typeof (i as { activeScanSnapshotId?: unknown }).activeScanSnapshotId === 'string'
                ? (i as { activeScanSnapshotId: string }).activeScanSnapshotId
                : undefined,
          };
          });
          const withValidActiveSnapshot = sanitized.map((i) => {
            if (!i.scanSnapshots || i.scanSnapshots.length === 0) {
              return { ...i, scanSnapshots: undefined, activeScanSnapshotId: undefined };
            }
            const hasActive = i.activeScanSnapshotId
              ? i.scanSnapshots.some((snapshot) => snapshot.id === i.activeScanSnapshotId)
              : false;
            return {
              ...i,
              activeScanSnapshotId: hasActive ? i.activeScanSnapshotId : i.scanSnapshots[0].id,
            };
          });
          const withoutLegacyDemos = withValidActiveSnapshot.filter((i) => !LEGACY_DEMO_ITEM_NAMES.has(i.name));
          setInventoryState(withoutLegacyDemos);
          persist(withoutLegacyDemos);
        } else {
          setInventoryState([]);
          persist([]);
        }
      } catch {
        setInventoryState([]);
        persist([]);
      }
      setHydrated(true);
    })();
  }, []);

  const persist = useCallback(async (items: Item[]) => {
    try {
      await AsyncStorage.setItem(TV_INV_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('[ThriftVault] Failed to save inventory:', e);
    }
  }, []);

  const addItem = useCallback(
    (item: Item) => {
      setInventoryState((prev) => {
        const next = [...prev, item];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addItems = useCallback(
    (items: Item[]) => {
      setInventoryState((prev) => {
        const next = [...prev, ...items];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateItem = useCallback(
    (id: number, updates: Partial<Item>) => {
      setInventoryState((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, ...updates } : i));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateItemsByDate = useCallback(
    (date: string, updates: Partial<Item>) => {
      setInventoryState((prev) => {
        const next = prev.map((i) => (i.date === date ? { ...i, ...updates } : i));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeItem = useCallback(
    (id: number) => {
      setInventoryState((prev) => {
        const next = prev.filter((i) => i.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setInventory = useCallback(
    (items: Item[]) => {
      setInventoryState(items);
      persist(items);
    },
    [persist]
  );

  const getItemById = useCallback(
    (id: number) => inventory.find((i) => i.id === id),
    [inventory]
  );

  const value: InventoryContextValue = {
    inventory,
    addItem,
    addItems,
    updateItem,
    updateItemsByDate,
    removeItem,
    setInventory,
    getItemById,
  };

  if (!hydrated) {
    return null;
  }

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
