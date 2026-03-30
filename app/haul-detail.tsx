import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
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
import type { Item } from '@/types/inventory';
import type { Theme } from '@/theme';

function HaulItemStatusBadge({
  item,
  styles,
}: {
  item: Item;
  styles: ReturnType<typeof createStyles>;
}) {
  const isCloset = item.intent === 'closet';
  if (isCloset) return null;
  const label = item.status === 'sold' ? 'Sold' : item.status === 'unlisted' ? 'Unlisted' : 'Listed';
  return (
    <View
      style={[
        styles.statusBadge,
        item.status === 'sold' && styles.statusBadgeSold,
        item.status === 'unlisted' && styles.statusBadgeUnlisted,
        item.status === 'listed' && styles.statusBadgeListed,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          item.status === 'sold' && styles.statusBadgeTextSold,
          item.status === 'unlisted' && styles.statusBadgeTextUnlisted,
          item.status === 'listed' && styles.statusBadgeTextListed,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function HaulDetailScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { inventory, removeItem, updateItemsByDate } = useInventory();
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [bulkStoreText, setBulkStoreText] = useState('');
  const screenWidth = Dimensions.get('window').width;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const gridPad = theme.spacing.xl;
  const gridGap = theme.spacing.sm;
  const gridWidth = screenWidth - gridPad * 2;

  const date = params.date != null ? decodeURIComponent(params.date) : '';
  const items = useMemo(
    () => (date ? inventory.filter((i) => i.date === date) : []),
    [inventory, date]
  );

  const totalSpent = useMemo(
    () => items.reduce((s, i) => s + (Number(i.paid) || 0), 0),
    [items]
  );
  const haulProfit = useMemo(
    () => items
      .filter((i) => i.intent === 'flip' && i.status === 'sold' && i.soldPrice != null)
      .reduce((s, i) => s + (Number(i.soldPrice) - (Number(i.paid) || 0)), 0),
    [items]
  );

  const commonStoreForHaul = useMemo(() => {
    if (items.length === 0) return '';
    const trimmed = items.map((i) => i.store.trim());
    const uniq = new Set(trimmed);
    if (uniq.size === 1) return [...uniq][0];
    return '';
  }, [items]);

  const [deleted, setDeleted] = useState(false);

  const handleDeleteHaul = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete haul',
      `Remove all ${items.length} item${items.length !== 1 ? 's' : ''} from this haul? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleted(true);
            items.forEach((i) => removeItem(i.id));
            showToast('Haul deleted');
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          },
        },
      ]
    );
  }, [items, removeItem, showToast, router]);

  const openStoreModal = useCallback(() => {
    Haptics.selectionAsync();
    setBulkStoreText(commonStoreForHaul);
    setStoreModalVisible(true);
  }, [commonStoreForHaul]);

  const handleApplyBulkStore = useCallback(() => {
    updateItemsByDate(date, { store: bulkStoreText.trim() });
    showToast('Store updated for this haul');
    setStoreModalVisible(false);
  }, [date, bulkStoreText, updateItemsByDate, showToast]);

  const handleClearBulkStore = useCallback(() => {
    updateItemsByDate(date, { store: '' });
    setBulkStoreText('');
    showToast('Store cleared for this haul');
    setStoreModalVisible(false);
  }, [date, updateItemsByDate, showToast]);

  const empty = !date || (items.length === 0 && !deleted);

  if (empty) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerNavRow}>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.headerBtn}>
              <AppIcon name="arrow-back" size={24} color={theme.colors.charcoal} />
            </Pressable>
            <View style={styles.headerNavSpacer} />
          </View>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerHeroTitle}>Haul</Text>
          </View>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {!date ? 'No haul selected' : 'No items in this haul'}
          </Text>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (deleted) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyWrap} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerNavRow}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <AppIcon name="arrow-back" size={24} color={theme.colors.charcoal} />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
              onPress={openStoreModal}
              accessibilityLabel="Set store for haul"
            >
              <AppIcon name="storefront-outline" size={22} color={theme.colors.charcoal} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
              onPress={() => { Haptics.selectionAsync(); setViewMode(viewMode === 'list' ? 'grid' : 'list'); }}
              accessibilityLabel={viewMode === 'list' ? 'Grid view' : 'List view'}
            >
              <AppIcon name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={22} color={theme.colors.charcoal} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
              onPress={handleDeleteHaul}
              accessibilityLabel="Delete haul"
            >
              <AppIcon name="trash-outline" size={22} color={theme.colors.charcoal} />
            </Pressable>
          </View>
        </View>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerHeroTitle} numberOfLines={2}>
            {date}
          </Text>
          <Text style={styles.headerMetaLine}>
            {items.length} find{items.length !== 1 ? 's' : ''} · ${totalSpent} spent
            {haulProfit > 0 ? (
              <Text style={styles.headerProfit}> · +${haulProfit} profit</Text>
            ) : null}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={viewMode === 'grid' ? styles.gridScrollContent : styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'list' ? (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.itemRow, pressed && styles.itemRowPressed]}
              onPress={() =>
                router.push({ pathname: '/detail', params: { itemId: String(item.id) } })
              }
            >
              <View style={styles.itemRowImageWrap}>
                <HaulItemStatusBadge item={item} styles={styles} />
                <Image source={{ uri: item.img }} style={styles.itemRowImage} resizeMode="cover" />
              </View>
              <View style={styles.itemRowBody}>
                <Text style={styles.itemRowName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemRowMeta}>
                  {item.paid != null ? `Cost $${Number(item.paid)}` : 'Cost —'}
                  {item.intent === 'flip' && Number(item.resale) > 0
                    ? ` · Resale $${Number(item.resale) || 0}`
                    : ''}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={20} color={theme.colors.mauve} />
            </Pressable>
          ))
        ) : (
          <View style={[styles.collageWrap, { width: gridWidth }]}>
            {items.map((item) => {
              const cellSize = (gridWidth - gridGap) / 2;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.collageCell,
                    {
                      width: cellSize,
                      marginBottom: gridGap,
                    },
                    pressed && styles.collageCellPressed,
                  ]}
                  onPress={() =>
                    router.push({ pathname: '/detail', params: { itemId: String(item.id) } })
                  }
                >
                  <View style={[styles.collageImageBlock, { width: cellSize, height: cellSize }]}>
                    <HaulItemStatusBadge item={item} styles={styles} />
                    <Image source={{ uri: item.img }} style={styles.collageImg} resizeMode="cover" />
                  </View>
                  <View style={styles.collageFooter}>
                    <Text style={styles.collageFooterName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.collageFooterMeta} numberOfLines={1}>
                      {item.paid != null ? `Cost $${Number(item.paid)}` : 'Cost —'}
                      {item.intent === 'flip' && Number(item.resale) > 0
                        ? ` · $${Number(item.resale) || 0} resale`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={storeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStoreModalVisible(false)}
      >
        <View style={styles.haulStoreOverlay}>
          <Pressable style={styles.haulStoreBackdrop} onPress={() => setStoreModalVisible(false)} />
          <Pressable style={styles.haulStoreSheet} onPress={() => Keyboard.dismiss()}>
            <Text style={styles.haulStoreTitle}>Store for this haul</Text>
            <Text style={styles.haulStoreHint}>
              Applies to every item on this date. Leave blank to clear.
            </Text>
            <TextInput
              style={styles.haulStoreInput}
              value={bulkStoreText}
              onChangeText={setBulkStoreText}
              placeholder="e.g. Goodwill"
              placeholderTextColor={theme.colors.mauve}
              autoCapitalize="words"
              autoCorrect
            />
            <Pressable
              style={({ pressed }) => [styles.haulStoreClearBtn, pressed && { opacity: 0.6 }]}
              onPress={handleClearBulkStore}
            >
              <Text style={styles.haulStoreClearText}>Clear store</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.haulStoreApplyBtn, pressed && { opacity: 0.85 }]}
              onPress={handleApplyBulkStore}
            >
              <Text style={styles.haulStoreApplyText}>Apply</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.cream,
    },
    header: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.lavender,
      paddingBottom: theme.spacing.md,
    },
    headerNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
    },
    headerNavSpacer: {
      flex: 1,
    },
    headerBtn: {
      padding: 8,
      minWidth: theme.minTouchTargetSize,
      minHeight: theme.minTouchTargetSize,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitleBlock: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xs,
    },
    headerHeroTitle: {
      ...theme.typography.h1,
      color: theme.colors.charcoal,
    },
    headerMetaLine: {
      ...theme.typography.bodySmall,
      color: theme.colors.mauve,
      marginTop: theme.spacing.xs,
    },
    headerProfit: {
      color: theme.colors.profit,
      fontWeight: '600',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: 40,
    },
    gridScrollContent: {
      paddingTop: theme.spacing.lg,
      paddingBottom: 40,
      alignItems: 'center',
    },
    collageWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    collageCell: {
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
      backgroundColor: theme.colors.surface,
      ...(theme.shadows.sm ?? {}),
    },
    collageCellPressed: {
      opacity: 0.9,
    },
    collageImageBlock: {
      position: 'relative',
      backgroundColor: theme.colors.surfaceVariant,
    },
    collageImg: {
      width: '100%',
      height: '100%',
    },
    collageFooter: {
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.lavender,
      backgroundColor: theme.colors.surface,
    },
    collageFooterName: {
      ...theme.typography.caption,
      fontWeight: '600',
      color: theme.colors.charcoal,
    },
    collageFooterMeta: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginTop: 2,
    },
    statusBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      zIndex: 1,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    statusBadgeCloset: {
      backgroundColor: theme.colors.surface,
    },
    statusBadgeSold: {
      backgroundColor: theme.colors.profit,
    },
    statusBadgeUnlisted: {
      backgroundColor: theme.colors.vintageBlueLight,
    },
    statusBadgeListed: {
      backgroundColor: theme.colors.vintageBlueDark,
    },
    statusBadgeText: {
      ...theme.typography.label,
      fontSize: 9,
      color: theme.colors.charcoal,
    },
    statusBadgeTextSold: {
      color: theme.colors.white,
    },
    statusBadgeTextUnlisted: {
      color: theme.colors.vintageBlueDeep,
    },
    statusBadgeTextListed: {
      color: theme.colors.white,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
      ...(theme.shadows.sm ?? {}),
    },
    itemRowPressed: {
      opacity: 0.92,
    },
    itemRowImageWrap: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
      position: 'relative',
    },
    itemRowImage: {
      width: '100%',
      height: '100%',
    },
    itemRowBody: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },
    itemRowName: {
      ...theme.typography.body,
      fontWeight: '500',
      color: theme.colors.charcoal,
    },
    itemRowMeta: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginTop: 2,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xxl,
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.mauve,
      marginBottom: theme.spacing.lg,
    },
    emptyBtn: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.vintageBlueDark,
      borderRadius: theme.radius.sm,
    },
    emptyBtnText: {
      ...theme.typography.body,
      fontWeight: '600',
      color: theme.colors.onPrimary,
    },
    haulStoreOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    haulStoreBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlayHeavy,
    },
    haulStoreSheet: {
      backgroundColor: theme.colors.cream,
      borderRadius: theme.radius.xl,
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xl,
      marginHorizontal: theme.spacing.xl,
      width: '90%',
      maxWidth: 400,
      zIndex: 1,
      ...(theme.shadows.md ?? {}),
    },
    haulStoreTitle: {
      ...theme.typography.h2,
      color: theme.colors.charcoal,
      marginBottom: theme.spacing.sm,
    },
    haulStoreHint: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginBottom: theme.spacing.lg,
    },
    haulStoreInput: {
      ...theme.typography.body,
      color: theme.colors.charcoal,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    haulStoreClearBtn: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    haulStoreClearText: {
      ...theme.typography.bodySmall,
      color: theme.colors.vintageBlueDark,
      fontWeight: '600',
    },
    haulStoreApplyBtn: {
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.vintageBlueDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    haulStoreApplyText: {
      ...theme.typography.body,
      fontWeight: '600',
      color: theme.colors.onPrimary,
    },
  });
}
