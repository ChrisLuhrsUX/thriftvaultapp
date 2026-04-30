import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { Item, ItemCategory, ItemStatus } from '@/types/inventory';
import type { Theme } from '@/theme';
import { formatMoney, formatMoneyWithSign } from '@/utils/currency';

interface Haul {
  date: string;
  title?: string;
  items: Item[];
  stores: string[];
  totalSpent: number;
  profit: number;
}

const STATUS_FILTERS: { key: ItemStatus; label: string }[] = [
  { key: 'unlisted', label: 'Unlisted' },
  { key: 'listed', label: 'Listed' },
  { key: 'sold', label: 'Sold' },
];

/** Broader category groups for filter chips; item data still uses specific ItemCategory. */
const CATEGORY_GROUPS: { key: string; label: string; cats: ItemCategory[] }[] = [
  { key: 'tops-dresses', label: 'Tops & Dresses', cats: ['tops', 'dresses'] },
  { key: 'denim-outerwear', label: 'Bottoms & Outerwear', cats: ['denim', 'bottoms', 'outerwear'] },
  { key: 'shoes-bags', label: 'Shoes & Bags', cats: ['shoes', 'bags'] },
  { key: 'accessories', label: 'Accessories', cats: ['accessories'] },
  { key: 'other', label: 'Other', cats: ['other'] },
];

const FLIP_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  ...STATUS_FILTERS.map((f) => ({ key: f.key, label: f.label })),
];

const CLOSET_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  ...CATEGORY_GROUPS.map((f) => ({ key: f.key, label: f.label })),
];

type VaultView = 'flips' | 'closet' | 'hauls';

const MONTH_SHORT: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** Parse item/haul date string to start-of-day UTC timestamp. Handles "Mar 5, 2025", "3/5/2025", ISO. */
function parseDateToDayStart(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  const shortMatch = dateStr.match(/^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (shortMatch) {
    const month = MONTH_SHORT[shortMatch[1]];
    const day = parseInt(shortMatch[2], 10);
    const year = parseInt(shortMatch[3], 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 1970) {
      const t = new Date(year, month, day).getTime();
      return Number.isNaN(t) ? null : t;
    }
  }
  const numericMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10) - 1;
    const day = parseInt(numericMatch[2], 10);
    const year = parseInt(numericMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1970) {
      const t = new Date(year, month, day).getTime();
      return Number.isNaN(t) ? null : t;
    }
  }
  return null;
}

const HaulCard = React.memo(function HaulCard({
  haul,
  onPress,
  styles,
  theme,
}: {
  haul: Haul;
  onPress: (date: string) => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const storesLabel = haul.stores.length > 0 ? haul.stores.slice(0, 2).join(', ') + (haul.stores.length > 2 ? '...' : '') : null;
  const thumbItems = haul.items.slice(0, 4);
  const count = thumbItems.length;

  return (
    <Pressable style={({ pressed }) => [styles.haulCard, pressed && styles.haulCardPressed]} onPress={() => onPress(haul.date)}>
      <View style={styles.haulCardPhoto}>
        {count === 0 ? (
          <View style={styles.haulCardPlaceholder}>
            <AppIcon name="images-outline" size={32} color={theme.colors.mauve} />
          </View>
        ) : count === 1 && thumbItems[0].img ? (
          <Image source={{ uri: thumbItems[0].img }} style={styles.haulCardImg} resizeMode="cover" />
        ) : (
          <View style={styles.haulCardGridOuter}>
            <View style={styles.haulCardGrid}>
              {thumbItems.filter((item) => !!item.img).map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: item.img }}
                  style={count === 2 ? styles.haulCardGridCell2 : styles.haulCardGridCell4}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        )}
        <View style={styles.haulCardBadge}>
          <Text style={styles.haulCardBadgeText}>{haul.items.length} find{haul.items.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <View style={styles.haulCardCaption}>
        {haul.title ? (
          <>
            <Text style={styles.haulDate} numberOfLines={1}>{haul.title}</Text>
            <Text style={styles.haulCaptionLine} numberOfLines={1}>
              {haul.date}
              {storesLabel ? ` · ${storesLabel}` : ''}
              {haul.profit > 0 ? (
                <Text style={styles.haulCaptionProfit}> · {formatMoneyWithSign(haul.profit)} profit</Text>
              ) : null}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.haulDate}>{haul.date}</Text>
            {(!!storesLabel || haul.profit > 0) && (
              <Text style={styles.haulCaptionLine} numberOfLines={2}>
                {storesLabel || ''}
                {haul.profit > 0 ? (
                  <Text style={styles.haulCaptionProfit}>{storesLabel ? ' · ' : ''}{formatMoneyWithSign(haul.profit)} profit</Text>
                ) : null}
              </Text>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
});

const ItemCard = React.memo(function ItemCard({
  item,
  isCloset,
  onPress,
  redFlagDismissed,
  styles,
  theme,
}: {
  item: Item;
  isCloset: boolean;
  onPress: (id: number) => void;
  redFlagDismissed: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const activeSnapshot = item.scanSnapshots?.find(s => s.id === item.activeScanSnapshotId) ?? item.scanSnapshots?.[0];
  const hasRedFlags = (activeSnapshot?.redFlags?.length ?? 0) > 0 && !redFlagDismissed;
  const paid = Number(item.paid) || 0;
  const resale = Number(item.resale) || 0;
  const soldPrice = item.soldPrice != null ? Number(item.soldPrice) : null;
  const estProfit = resale - paid;
  const profitLabel =
    !isCloset && item.status === 'sold' && soldPrice != null
      ? `Sold ${formatMoney(soldPrice)}`
      : `${formatMoneyWithSign(estProfit)} profit`;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isCloset && styles.cardCloset,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(item.id)}
    >
      {item.img ? (
        <Image source={{ uri: item.img }} style={styles.cardImg} resizeMode="cover" />
      ) : (
        <View style={styles.cardImgPlaceholder}>
          <AppIcon name="camera-outline" size={28} color={theme.colors.mauve} />
        </View>
      )}
      {!isCloset && (
        <View style={[
          styles.cardBadge,
          item.status === 'sold' && styles.cardBadgeSold,
          item.status === 'unlisted' && styles.cardBadgeUnlisted,
          item.status === 'listed' && styles.cardBadgeListed,
        ]}>
          <Text style={[
            styles.badgeText,
            item.status === 'sold' && styles.badgeTextSold,
            item.status === 'unlisted' && styles.badgeTextUnlisted,
            item.status === 'listed' && styles.badgeTextListed,
          ]}>
            {item.status === 'sold' ? 'Sold' : item.status === 'unlisted' ? 'Unlisted' : 'Listed'}
          </Text>
        </View>
      )}
      {hasRedFlags && (
        <View style={styles.cardRedFlag}>
          <AppIcon name="flag" size={12} color="#FFFFFF" />
        </View>
      )}
      {isCloset && !!item.cat && (
        <View style={[styles.cardBadge, styles.cardBadgeCloset]}>
          <Text style={[styles.badgeText, styles.badgeTextCloset]}>
            {item.cat.charAt(0).toUpperCase() + item.cat.slice(1)}
          </Text>
        </View>
      )}
      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      {!isCloset && (
        <Text style={[styles.cardProfit, item.status === 'sold' && styles.cardProfitSold]}>{profitLabel}</Text>
      )}
    </Pressable>
  );
});

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { inventory, addItem, addItems, haulTitles } = useInventory();
  const { showToast } = useToast();
  const { gridColumns, hPad, headerHPad, contentMaxWidth, isTablet } = useResponsive();
  const [view, setView] = useState<VaultView>('flips');
  const [search, setSearch] = useState('');
  const [haulSearch, setHaulSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [redFlagDismissedIds, setRedFlagDismissedIds] = useState<Set<number>>(() => new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ids = inventory.map((i) => i.id);
        if (ids.length === 0) {
          if (!cancelled) setRedFlagDismissedIds(new Set());
          return;
        }
        const keys = ids.map((id) => `tv_prompt_dismissed_${id}`);
        try {
          const pairs = await AsyncStorage.multiGet(keys);
          if (cancelled) return;
          const next = new Set<number>();
          for (const [key, raw] of pairs) {
            if (!raw) continue;
            try {
              const flags = JSON.parse(raw) as { redFlagBanner?: boolean };
              if (flags.redFlagBanner) {
                const id = Number(key.slice('tv_prompt_dismissed_'.length));
                if (Number.isFinite(id)) next.add(id);
              }
            } catch { /* ignore */ }
          }
          setRedFlagDismissedIds(next);
        } catch { /* ignore */ }
      })();
      return () => { cancelled = true; };
    }, [inventory])
  );
  const numColumns = gridColumns;
  const styles = useMemo(
    () => createStyles(theme, hPad, headerHPad, numColumns),
    [theme, hPad, headerHPad, numColumns]
  );

  const handleItemPress = useCallback(
    (id: number) => router.push({ pathname: '/detail', params: { itemId: String(id) } }),
    [router]
  );

  const handleHaulPress = useCallback(
    (date: string) => router.push({ pathname: '/haul-detail', params: { date: encodeURIComponent(date) } }),
    [router]
  );

  const handleManualAdd = useCallback(() => {
    const id = Date.now();
    const intent = view === 'closet' ? 'closet' : 'flip';
    const newItem: Item = {
      id,
      name: 'New Item',
      cat: '' as any,
      paid: null,
      resale: 0,
      status: '' as any,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
      store: '',
      platform: '',
      notes: '',
      soldPrice: null,
      img: '',
      intent,
    };
    addItem(newItem);
    Haptics.selectionAsync();
    router.push({ pathname: '/detail', params: { itemId: String(id), manual: '1' } });
  }, [view, addItem, router]);

  const createHaulItems = useCallback(async (
    assets: ImagePicker.ImagePickerAsset[],
    store: string,
    intent: 'flip' | 'closet',
  ) => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const items: Item[] = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const id = Date.now() + i;
      let imgUri = asset.uri;
      if (asset.uri.startsWith('file:') && FileSystem.documentDirectory) {
        try {
          const dest = `${FileSystem.documentDirectory}item_${id}.jpg`;
          await FileSystem.copyAsync({ from: asset.uri, to: dest });
          imgUri = dest;
        } catch { /* use original uri */ }
      }
      items.push({
        id,
        name: `Find ${i + 1}`,
        cat: 'tops',
        paid: null,
        resale: 0,
        status: 'unlisted',
        date: today,
        store,
        platform: '',
        notes: '',
        soldPrice: null,
        img: imgUri,
        photos: [imgUri],
        intent,
      });
    }
    addItems(items);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return items.length;
  }, [addItems]);

  const STORE_PRESETS = ['Goodwill', 'Salvation Army', 'Savers', 'Plato\'s Closet'];
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [storePickerAssets, setStorePickerAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [customStore, setCustomStore] = useState('');
  const customStoreRef = useRef<TextInput>(null);

  const handleNewHaul = useCallback(async () => {
    if (Platform.OS === 'web') {
      showToast('Not available on web');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    setStorePickerAssets(result.assets);
    setSelectedStore('_none');
    setCustomStore('');
    setStorePickerVisible(true);
  }, []);

  const handleStorePickerConfirm = useCallback(async () => {
    const store =
      selectedStore === '_custom'
        ? customStore.trim()
        : selectedStore === '_none' || !selectedStore
          ? ''
          : selectedStore;
    setStorePickerVisible(false);
    const n = await createHaulItems(storePickerAssets, store, 'flip');
    showToast(`Added ${n} find${n !== 1 ? 's' : ''} to today's haul`);
  }, [selectedStore, customStore, storePickerAssets, createHaulItems, showToast]);

  const handleAddToCloset = useCallback(async () => {
    if (Platform.OS === 'web') {
      showToast('Not available on web');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const n = await createHaulItems(result.assets, '', 'closet');
    showToast(`Added ${n} piece${n !== 1 ? 's' : ''} to your closet`);
  }, [createHaulItems, showToast]);

  const filtersForView = view === 'closet' ? CLOSET_FILTERS : FLIP_FILTERS;

  const listByView = useMemo(() => {
    if (view === 'closet') {
      return inventory.filter((i) => i.intent === 'closet');
    }
    if (view === 'hauls') return [];
    return inventory.filter((i) => i.intent === 'flip');
  }, [inventory, view]);

  const filtered = useMemo(() => {
    let list = listByView;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.store.toLowerCase().includes(q) ||
          i.notes.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      const group = CATEGORY_GROUPS.find((g) => g.key === filter);
      if (group) {
        list = list.filter((i) => group.cats.includes(i.cat));
      } else if (STATUS_FILTERS.some((f) => f.key === filter)) {
        list = list.filter((i) => i.status === filter);
      }
    }
    if (view === 'closet' || view === 'flips') {
      list = [...list].sort((a, b) => (b.updatedAt ?? b.id) - (a.updatedAt ?? a.id));
    }
    return list;
  }, [listByView, search, filter, view]);


  const hauls = useMemo(() => {
    const byDate = new Map<string, Item[]>();
    for (const i of inventory) {
      if (!i.date.trim()) continue;
      const list = byDate.get(i.date) ?? [];
      list.push(i);
      byDate.set(i.date, list);
    }
    const result: Haul[] = [];
    byDate.forEach((items, date) => {
      const stores = [...new Set(items.map((i) => i.store.trim()))].filter(Boolean);
      const totalSpent = items.reduce((s, i) => s + (Number(i.paid) || 0), 0);
      const profit = items
        .filter((i) => i.intent === 'flip' && i.status === 'sold' && i.soldPrice != null)
        .reduce((s, i) => s + (Number(i.soldPrice) - (Number(i.paid) || 0)), 0);
      result.push({ date, title: haulTitles[date], items, stores, totalSpent, profit });
    });
    result.sort((a, b) => {
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      return Number.isNaN(dB) && Number.isNaN(dA) ? 0 : (Number.isNaN(dB) ? -1 : Number.isNaN(dA) ? 1 : dB - dA);
    });
    return result;
  }, [inventory, haulTitles]);

  const filteredHauls = useMemo(() => {
    const getHaulDayStart = (haul: Haul): number | null => {
      for (const item of haul.items) {
        const t = parseDateToDayStart(item.date);
        if (t != null) return t;
      }
      return parseDateToDayStart(haul.date);
    };

    const FULL_TO_SHORT_MONTH: Record<string, string> = {
      january: 'jan', february: 'feb', march: 'mar', april: 'apr',
      may: 'may', june: 'jun', july: 'jul', august: 'aug',
      september: 'sep', october: 'oct', november: 'nov', december: 'dec',
    };

    let list = hauls;
    if (haulSearch.trim()) {
      const raw = haulSearch.trim().toLowerCase();
      const q = raw.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
        (m) => FULL_TO_SHORT_MONTH[m] ?? m);
      list = list.filter(
        (haul) =>
          haul.date.toLowerCase().includes(q) ||
          (haul.title?.toLowerCase().includes(q) ?? false) ||
          haul.stores.some((s) => s.toLowerCase().includes(q)) ||
          haul.items.some((i) => i.name.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const tA = getHaulDayStart(a) ?? 0;
      const tB = getHaulDayStart(b) ?? 0;
      return tB - tA;
    });
  }, [hauls, haulSearch]);

  const flipsClosetListHeader = (
    <View style={styles.listHeaderWrap}>
      <View style={styles.searchRow}>
        <AppIcon name="search" size={20} color={theme.colors.mauve} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, store, or notes..."
          placeholderTextColor={theme.colors.mauve}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch('')}
            style={({ pressed }) => [styles.searchClear, pressed && styles.searchClearPressed]}
            hitSlop={8}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <AppIcon name="close-circle" size={20} color={theme.colors.mauve} />
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        data={filtersForView}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              filter === item.key && styles.chipActive,
            ]}
            onPress={() => { Haptics.selectionAsync(); setFilter(item.key); }}
            accessibilityLabel={`Filter by ${item.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.key }}
          >
            <Text
              style={[
                styles.chipText,
                filter === item.key && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />
      {view === 'closet' && (
        <Pressable
          style={({ pressed }) => [styles.addToClosetBtn, pressed && { opacity: 0.8 }]}
          onPress={handleAddToCloset}
          accessibilityLabel="Add to closet"
          accessibilityRole="button"
        >
          <AppIcon name="images-outline" size={18} color={theme.colors.onPrimary} />
          <Text style={styles.addToClosetBtnText}>Add to Closet</Text>
        </Pressable>
      )}
    </View>
  );

  const topHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>My Vault</Text>
        <Text style={styles.sub}>Your thrift inventory</Text>
      </View>
      <View style={styles.switcherRow}>
        <Pressable
          style={[styles.switcherTab, view === 'flips' && styles.switcherTabActive]}
          onPress={() => { Haptics.selectionAsync(); setView('flips'); setFilter('all'); setSearch(''); }}
          accessibilityLabel="Flips"
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'flips' }}
        >
          <Text style={[styles.switcherText, view === 'flips' && styles.switcherTextActive]}>Flips</Text>
        </Pressable>
        <Pressable
          style={[styles.switcherTab, view === 'closet' && styles.switcherTabActive]}
          onPress={() => { Haptics.selectionAsync(); setView('closet'); setFilter('all'); setSearch(''); }}
          accessibilityLabel="Closet"
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'closet' }}
        >
          <Text style={[styles.switcherText, view === 'closet' && styles.switcherTextActive]}>Closet</Text>
        </Pressable>
        <Pressable
          style={[styles.switcherTab, view === 'hauls' && styles.switcherTabActive]}
          onPress={() => { Haptics.selectionAsync(); setView('hauls'); }}
          accessibilityLabel="Hauls"
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'hauls' }}
        >
          <Text style={[styles.switcherText, view === 'hauls' && styles.switcherTextActive]}>Hauls</Text>
        </Pressable>
      </View>
    </>
  );

  const isFiltering = search.trim().length > 0 || filter !== 'all';

  const centeredContent = useMemo(() =>
    isTablet && contentMaxWidth
      ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
      : undefined,
    [isTablet, contentMaxWidth]
  );

  const flatListStyle = useMemo(() =>
    centeredContent ? [{ flex: 1 as const }, centeredContent] : [{ flex: 1 as const }],
    [centeredContent]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={centeredContent}>
        {topHeader}
      </View>
      {view === 'hauls' ? (
        <FlatList
          data={filteredHauls}
          key={`hauls-${numColumns}`}
          numColumns={numColumns}
          keyExtractor={(haul) => `haul-${haul.date}`}
          style={flatListStyle}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={styles.haulsGridContent}
          columnWrapperStyle={styles.haulsGridRow}
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              <View style={styles.searchRow}>
                <AppIcon name="search" size={20} color={theme.colors.mauve} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by date, store, or item name..."
                  placeholderTextColor={theme.colors.mauve}
                  value={haulSearch}
                  onChangeText={setHaulSearch}
                />
                {haulSearch.length > 0 && (
                  <Pressable
                    onPress={() => setHaulSearch('')}
                    style={({ pressed }) => [styles.searchClear, pressed && styles.searchClearPressed]}
                    hitSlop={8}
                    accessibilityLabel="Clear search"
                    accessibilityRole="button"
                  >
                    <AppIcon name="close-circle" size={20} color={theme.colors.mauve} />
                  </Pressable>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [styles.newHaulBtn, pressed && { opacity: 0.8 }]}
                onPress={handleNewHaul}
                accessibilityLabel="Create new haul"
                accessibilityRole="button"
              >
                <AppIcon name="images-outline" size={18} color={theme.colors.onPrimary} />
                <Text style={styles.newHaulBtnText}>New Haul</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppIcon
                name="bag-handle-outline"
                size={48}
                color={theme.colors.mauve}
              />
              <Text style={styles.emptyTitle}>
                {hauls.length === 0
                  ? 'Your haul history lives here'
                  : 'No hauls match your search'}
              </Text>
              <Text style={styles.emptySub}>
                {hauls.length === 0
                  ? 'Log items from your last thrift run to track spending and profits by trip.'
                  : 'Try clearing the search.'}
              </Text>
              {hauls.length === 0 && (
                <Pressable
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleNewHaul}
                  accessibilityLabel="Create new haul"
                  accessibilityRole="button"
                >
                  <AppIcon name="images-outline" size={16} color={theme.colors.onPrimary} />
                  <Text style={styles.emptyBtnText}>New Haul</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: haul }) => (
            <HaulCard
              haul={haul}
              onPress={handleHaulPress}
              styles={styles}
              theme={theme}
            />
          )}
        />
      ) : (
        <FlatList
          data={filtered}
          key={`items-${view}-${numColumns}`}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.id)}
          style={flatListStyle}
          contentContainerStyle={styles.gridContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={5}
          removeClippedSubviews
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={flipsClosetListHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isFiltering ? (
                <AppIcon name="search-outline" size={48} color={theme.colors.mauve} />
              ) : (
                <View style={styles.emptyGhostRow}>
                  <View style={styles.emptyGhostCard}>
                    <View style={styles.emptyGhostImg} />
                    <View style={styles.emptyGhostLine} />
                    <View style={styles.emptyGhostLineSm} />
                  </View>
                  <View style={styles.emptyGhostCard}>
                    <View style={styles.emptyGhostImg} />
                    <View style={[styles.emptyGhostLine, { width: '55%' }]} />
                    <View style={[styles.emptyGhostLineSm, { width: '70%' }]} />
                  </View>
                </View>
              )}
              <Text style={styles.emptyTitle}>
                {isFiltering
                  ? 'No results'
                  : view === 'closet' ? 'Keep what you love in one place' : 'Your first find is one scan away'}
              </Text>
              <Text style={styles.emptySub}>
                {isFiltering
                  ? 'Try a different search or filter.'
                  : view === 'closet'
                    ? 'Add pieces from your personal wardrobe to track their value.'
                    : 'Scan an item with AI to see its resale value instantly.'}
              </Text>
              {!isFiltering && (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => router.replace('/(tabs)/scan')}
                  >
                    <Text style={styles.emptyBtnText}>Scan with AI</Text>
                    <AppIcon name="arrow-forward" size={16} color={theme.colors.onPrimary} />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.emptyBtnSecondary, pressed && { opacity: 0.8 }]}
                    onPress={handleManualAdd}
                  >
                    <Text style={styles.emptyBtnSecondaryText}>Add manually</Text>
                  </Pressable>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              isCloset={view === 'closet'}
              onPress={handleItemPress}
              redFlagDismissed={redFlagDismissedIds.has(item.id)}
              styles={styles}
              theme={theme}
            />
          )}
        />
      )}

      <Modal
        visible={storePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStorePickerVisible(false)}
      >
        <View style={styles.storePickerOverlay}>
          <Pressable style={styles.storePickerBackdrop} onPress={() => setStorePickerVisible(false)} />
          <Pressable style={styles.storePickerSheet} onPress={() => Keyboard.dismiss()}>
            <Text style={styles.storePickerTitle}>Where'd you thrift?</Text>
            <View style={styles.storePickerChips}>
              <Pressable
                style={[styles.storePickerChip, selectedStore === '_none' && styles.storePickerChipActive]}
                onPress={() => { setSelectedStore('_none'); setCustomStore(''); }}
              >
                <Text style={[styles.storePickerChipText, selectedStore === '_none' && styles.storePickerChipTextActive]}>Not set</Text>
              </Pressable>
              {STORE_PRESETS.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.storePickerChip, selectedStore === s && styles.storePickerChipActive]}
                  onPress={() => { setSelectedStore(s); setCustomStore(''); }}
                >
                  <Text style={[styles.storePickerChipText, selectedStore === s && styles.storePickerChipTextActive]}>{s}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.storePickerChip, selectedStore === '_custom' && styles.storePickerChipActive]}
                onPress={() => { setSelectedStore('_custom'); setTimeout(() => customStoreRef.current?.focus(), 100); }}
              >
                <Text style={[styles.storePickerChipText, selectedStore === '_custom' && styles.storePickerChipTextActive]}>Other</Text>
              </Pressable>
            </View>
            {selectedStore === '_custom' && (
              <TextInput
                ref={customStoreRef}
                style={styles.storePickerInput}
                placeholder="Type store name..."
                placeholderTextColor={theme.colors.mauve}
                value={customStore}
                onChangeText={setCustomStore}
                autoFocus
              />
            )}
            <Pressable
              style={({ pressed }) => [
                styles.storePickerConfirm,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleStorePickerConfirm}
            >
              <Text style={styles.storePickerConfirmText}>Add to Haul</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme, hPad: number, headerHPad: number, numColumns: number) {
  const cardMaxWidth = `${Math.floor(100 / numColumns) - 2}%` as `${number}%`;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  header: {
    paddingHorizontal: headerHPad,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.charcoal,
  },
  sub: {
    ...theme.typography.bodySmall,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    marginHorizontal: hPad,
    borderRadius: theme.radius.md,
    marginBottom: 12,
    ...(theme.shadows.sm ?? {}),
  },
  statBlock: {
    alignItems: 'center',
  },
  statVal: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.charcoal,
  },
  statValProfit: {
    color: theme.colors.profit,
  },
  statLabel: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.charcoalSoft,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: hPad,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    ...(theme.shadows.sm ?? {}),
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.charcoal,
    padding: 0,
    minHeight: 0,
  },
  searchClear: {
    padding: 4,
    alignSelf: 'center',
  },
  searchClearPressed: {
    opacity: 0.7,
  },
  chips: {
    height: 44,
    flexShrink: 0,
    flexGrow: 0,
    marginBottom: 16,
  },
  chipsContent: {
    paddingHorizontal: hPad,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant,
  },
  chipActive: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  chipText: {
    ...theme.typography.caption,
    fontFamily: 'DMSans_600SemiBold',
    color: theme.colors.mauve,
  },
  chipTextActive: {
    color: theme.colors.onPrimary,
  },
  haulsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  haulsTitle: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginBottom: 10,
  },
  haulsScroll: {
    paddingRight: 20,
    flexDirection: 'row',
    paddingBottom: 4,
  },
  haulsOnlySection: {
    flex: 1,
  },
  newHaulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: hPad,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.vintageBlueDark,
  },
  newHaulBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  addToClosetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: hPad,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.vintageBlueDark,
  },
  addToClosetBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  storePickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlayHeavy,
  },
  storePickerSheet: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xl,
    marginHorizontal: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...(theme.shadows.md ?? {}),
  },
  storePickerTitle: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.lg,
  },
  storePickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  storePickerChip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant,
  },
  storePickerChipActive: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  storePickerChipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
  },
  storePickerChipTextActive: {
    color: theme.colors.onPrimary,
  },
  storePickerInput: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  storePickerConfirm: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storePickerConfirmText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  haulsGrid: {
    flex: 1,
  },
  haulsGridContent: {
    paddingHorizontal: hPad,
    paddingBottom: 120,
  },
  haulsGridRow: {
    gap: 12,
    marginBottom: 12,
  },
  haulCard: {
    flex: 1,
    maxWidth: cardMaxWidth,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...(theme.shadows.sm ?? {}),
  },
  haulCardPressed: { opacity: 0.9 },
  haulCardPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: theme.colors.surfaceVariant,
    position: 'relative',
  },
  haulCardImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  haulCardGridOuter: {
    width: '100%',
    height: '100%',
    padding: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.lavender,
    overflow: 'hidden',
  },
  haulCardGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  haulCardGridCell2: {
    width: '50%',
    height: '100%',
  },
  haulCardGridCell4: {
    width: '50%',
    height: '50%',
  },
  haulCardPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haulCardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.vintageBlueDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    ...(theme.shadows.sm ?? {}),
  },
  haulCardBadgeText: {
    ...theme.typography.label,
    fontSize: 11,
    color: theme.colors.onPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  haulCardCaption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  haulDate: {
    ...theme.typography.bodySmall,
    fontFamily: 'DMSans_600SemiBold',
    color: theme.colors.charcoal,
  },
  haulCaptionLine: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: theme.spacing.xs,
  },
  haulCaptionProfit: {
    color: theme.colors.profit,
    fontWeight: '600',
  },
  listHeaderWrap: {
    marginHorizontal: -hPad,
  },
  gridContent: {
    paddingHorizontal: hPad,
    paddingBottom: 120,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  switcherRow: {
    flexDirection: 'row',
    marginHorizontal: hPad,
    marginBottom: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.full,
    padding: 4,
  },
  switcherTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.full,
  },
  switcherTabActive: {
    backgroundColor: theme.colors.vintageBlueDark,
    ...(theme.shadows.sm ?? {}),
  },
  switcherText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.mauve,
  },
  switcherTextActive: {
    color: theme.colors.onPrimary,
  },
  card: {
    flex: 1,
    maxWidth: cardMaxWidth,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...(theme.shadows.sm ?? {}),
  },
  cardCloset: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardBadgeCloset: {
    backgroundColor: theme.colors.surface,
  },
  cardImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceVariant,
  },
  cardImgPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRedFlag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.loss,
    padding: 5,
    borderRadius: theme.radius.full,
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.vintageBlueDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    ...(theme.shadows.sm ?? {}),
  },
  cardBadgeSold: {
    backgroundColor: theme.colors.profit,
  },
  cardBadgeUnlisted: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  cardBadgeListed: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  badgeText: {
    ...theme.typography.label,
    fontSize: 11,
    color: theme.colors.onPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  badgeTextSold: {
    color: theme.colors.onPrimary,
  },
  badgeTextUnlisted: {
    color: theme.colors.onPrimary,
  },
  badgeTextListed: {
    color: theme.colors.onPrimary,
  },
  badgeTextCloset: {
    color: theme.colors.mauve,
  },
  cardName: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
    padding: 8,
  },
  cardPaid: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cardProfit: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.profit,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cardProfitSold: {
    color: theme.colors.charcoal,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 60,
  },
  emptyGhostRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: theme.spacing.xl,
    opacity: 0.45,
  },
  emptyGhostCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...(theme.shadows.sm ?? {}),
  },
  emptyGhostImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceVariant,
  },
  emptyGhostLine: {
    height: 10,
    width: '75%',
    backgroundColor: theme.colors.lavender,
    borderRadius: theme.radius.full,
    margin: 8,
    marginBottom: 4,
  },
  emptyGhostLineSm: {
    height: 8,
    width: '45%',
    backgroundColor: theme.colors.lavender,
    borderRadius: theme.radius.full,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  emptyTitle: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
    marginTop: 16,
  },
  emptySub: {
    ...theme.typography.bodySmall,
    color: theme.colors.mauve,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.vintageBlueDark,
  },
  emptyBtnText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  emptyBtnSecondary: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  emptyBtnSecondaryText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.vintageBlueDark,
  },
  });
}
