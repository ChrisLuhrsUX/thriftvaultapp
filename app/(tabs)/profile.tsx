import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { PaywallModal } from '@/components/PaywallModal';
import { TRIAL_DURATION_DAYS } from '@/constants/monetization';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';
import { formatMoney, formatMoneyWithSign } from '@/utils/currency';

const SETTINGS_ROWS = [
  { id: 'subscription', label: 'Subscription', icon: 'card-outline' as const },
  { id: 'manage', label: 'Manage Subscription', icon: 'settings-outline' as const },
  { id: 'restore', label: 'Restore Purchases', icon: 'refresh-outline' as const },
  { id: 'feedback', label: 'Send Feedback', icon: 'mail-outline' as const },
  { id: 'privacy', label: 'Privacy Policy', icon: 'lock-closed-outline' as const },
  { id: 'terms', label: 'Terms of Service', icon: 'document-text-outline' as const },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, colorScheme, setColorScheme } = useTheme();
  const { inventory } = useInventory();
  const { restorePurchases } = usePurchases();
  const { formMaxWidth, headerHPad } = useResponsive();
  const { showToast } = useToast();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const styles = useMemo(() => createStyles(theme, headerHPad, formMaxWidth), [theme, headerHPad, formMaxWidth]);

  const stats = useMemo(() => {
    const sold = inventory.filter((i) => i.status === 'sold');
    const totalProfit = sold.reduce(
      (s, i) => s + ((Number(i.soldPrice ?? i.resale) || 0) - (Number(i.paid) || 0)),
      0
    );
    const bestFlip =
      sold.length > 0
        ? Math.max(
            ...sold.map((i) => (Number(i.soldPrice ?? i.resale) || 0) - (Number(i.paid) || 0))
          )
        : 0;
    const active = inventory.filter(
      (i) => i.intent === 'flip' && (i.status === 'unlisted' || i.status === 'listed')
    ).length;
    return {
      totalItems: inventory.length,
      totalProfit,
      bestFlip,
      soldCount: sold.length,
      active,
    };
  }, [inventory]);

  const storeStats = useMemo(() => {
    const soldFlips = inventory.filter(
      (i) => i.intent === 'flip' && i.status === 'sold'
    );
    const byStore = new Map<
      string,
      { profit: number; count: number; totalSpent: number }
    >();
    for (const i of soldFlips) {
      const storeKey = i.store.trim() || 'Not set';
      const prev = byStore.get(storeKey) ?? { profit: 0, count: 0, totalSpent: 0 };
      const paid = Number(i.paid) || 0;
      const revenue = Number(i.soldPrice ?? i.resale) || 0;
      const itemProfit = revenue - paid;
      byStore.set(storeKey, {
        profit: prev.profit + itemProfit,
        count: prev.count + 1,
        totalSpent: prev.totalSpent + paid,
      });
    }
    const list = Array.from(byStore.entries()).map(([store, data]) => ({
      store,
      ...data,
    }));
    list.sort((a, b) => b.profit - a.profit);
    return list;
  }, [inventory]);

  const handleSetting = async (id: string) => {
if (id === 'subscription') {
      setPaywallVisible(true);
      return;
    }
    if (id === 'feedback') {
      Linking.openURL('mailto:thriftvaultapp@gmail.com?subject=ThriftVault%20Feedback').catch(() => {});
      return;
    }
    if (id === 'manage') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
      return;
    }
    if (id === 'restore') {
      const result = await restorePurchases();
      if (result.success) {
        showToast('Purchases restored');
      } else {
        showToast(result.error ?? 'Nothing to restore');
      }
      return;
    }
    if (id === 'privacy') {
      Linking.openURL('https://chrisluhrsux.github.io/thriftvaultapp/assets/privacy-policy.html').catch(() => {});
      return;
    }
    if (id === 'terms') {
      Linking.openURL('https://chrisluhrsux.github.io/thriftvaultapp/assets/terms.html').catch(() => {});
      return;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        {storeStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profit by store</Text>
            {storeStats.length >= 2 && (
              <Text style={styles.storeCopy}>
                You make more profit from <Text style={styles.storeCopyHighlight}>{storeStats[0].store}</Text> than {storeStats[1].store} – {storeStats[0].store} has better finds.
              </Text>
            )}
            <ScrollView
              style={styles.storeListScroll}
              contentContainerStyle={styles.storeListScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {storeStats.map((s, idx) => (
                <View key={s.store} style={styles.storeRow}>
                  <View style={styles.storeRowLeft}>
                    <View style={styles.storeNameRow}>
                      <Text style={styles.storeName}>{s.store}</Text>
                      {idx === 0 && (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>Best store</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.storeMeta}>{s.count} sold · {formatMoney(s.totalSpent)} spent</Text>
                  </View>
                  <Text style={[styles.storeProfit, s.profit >= 0 && styles.profitGreen]}>
                    {formatMoneyWithSign(s.profit)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.row}>
            <AppIcon name="cash-outline" size={22} color={theme.colors.profit} />
            <Text style={styles.rowLabel}>Total Profit</Text>
            <Text style={[styles.rowValue, stats.soldCount > 0 && styles.profitGreen]}>
              {stats.soldCount > 0 ? formatMoneyWithSign(stats.totalProfit) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <AppIcon name="trending-up-outline" size={22} color={theme.colors.profit} />
            <Text style={styles.rowLabel}>Best Single Flip</Text>
            <Text style={[styles.rowValue, stats.soldCount > 0 && styles.profitGreen]}>
              {stats.soldCount > 0 ? formatMoneyWithSign(stats.bestFlip) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <AppIcon name="cube-outline" size={22} color={theme.colors.mauve} />
            <Text style={styles.rowLabel}>Total Items Tracked</Text>
            <Text style={styles.rowValue}>{stats.totalItems}</Text>
          </View>
          <View style={styles.row}>
            <AppIcon name="checkmark-circle-outline" size={22} color={theme.colors.mauve} />
            <Text style={styles.rowLabel}>Items Sold</Text>
            <Text style={styles.rowValue}>{stats.soldCount}</Text>
          </View>
          <View style={styles.row}>
            <AppIcon name="storefront-outline" size={22} color={theme.colors.mauve} />
            <Text style={styles.rowLabel}>Active Listings</Text>
            <Text style={styles.rowValue}>{stats.active}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceRowLeft}>
              <AppIcon name="contrast-outline" size={22} color={theme.colors.mauve} />
              <Text style={styles.rowLabel}>Appearance</Text>
            </View>
            <Pressable
              style={styles.appearanceSwitch}
              onPress={() => setColorScheme(colorScheme === 'light' ? 'dark' : 'light')}
            >
              <AppIcon
                name={colorScheme === 'light' ? 'moon' : 'bulb'}
                size={16}
                color={theme.colors.mauve}
              />
              <Text style={styles.appearanceSwitchText}>
                {colorScheme === 'light' ? 'Dark' : 'Light'}
              </Text>
            </Pressable>
          </View>
          {SETTINGS_ROWS.map((row) => (
            <Pressable
              key={row.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleSetting(row.id)}
            >
              <AppIcon name={row.icon} size={22} color={theme.colors.mauve} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <AppIcon name="chevron-forward" size={20} color={theme.colors.mauve} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.upgradeBtn, pressed && styles.btnPressed]}
          onPress={() => setPaywallVisible(true)}
        >
          <AppIcon name="sparkles" size={20} color={theme.colors.onPrimary} />
          <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
        </Pressable>
        <Text style={styles.trialNote}>{TRIAL_DURATION_DAYS}-day free trial</Text>
        </View>
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </View>
  );
}

function createStyles(theme: Theme, headerHPad: number, formMaxWidth?: number) {
  const centered = formMaxWidth
    ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : {};
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  contentWrapper: {
    ...centered,
  },
  header: {
    paddingHorizontal: headerHPad,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.charcoal,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginHorizontal: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.vintageBlueDark,
    marginBottom: 4,
  },
  btnPressed: {
    opacity: 0.9,
  },
  upgradeBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  trialNote: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...(theme.shadows.sm ?? {}),
  },
  sectionTitle: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.mauve,
    marginBottom: 12,
  },
  storeCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
    marginBottom: 12,
  },
  storeCopyHighlight: {
    fontWeight: '600',
    color: theme.colors.profit,
  },
  storeListScroll: {
    maxHeight: 220,
  },
  storeListScrollContent: {
    paddingBottom: 4,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lavender,
  },
  storeRowLeft: {
    flex: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestBadge: {
    backgroundColor: theme.colors.vintageBlueDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  bestBadgeText: {
    ...theme.typography.label,
    fontSize: 10,
    color: theme.colors.onPrimary,
  },
  storeName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  storeMeta: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  storeProfit: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowLabel: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.charcoal,
  },
  rowValue: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  profitGreen: {
    color: theme.colors.profit,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  footerSub: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  appearanceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appearanceSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant,
  },
  appearanceSwitchText: {
    ...theme.typography.caption,
    fontFamily: 'DMSans_600SemiBold',
    color: theme.colors.mauve,
  },
  });
}
