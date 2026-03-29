import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { TRIAL_DURATION_DAYS, PLANS, DEFAULT_PLAN_ID, type PlanOption } from '@/constants/monetization';
import { usePurchases } from '@/hooks/usePurchases';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';

const FEATURES = [
  'Unlimited AI scans & price estimates',
  'Unlimited inventory items & hauls',
  'Profit tracking & store analytics',
  'Multi-photo item galleries',
];

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { isDesktop } = useResponsive();
  const { subscribe } = usePurchases();
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_PLAN_ID);
  const [purchasing, setPurchasing] = useState(false);
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 2,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const activePlan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];

  const handleSubscribe = async () => {
    if (purchasing) return;
    setPurchasing(true);
    const result = await subscribe(activePlan.id);
    setPurchasing(false);
    if (result.success) {
      onClose();
      showToast(`Welcome to ThriftVault Pro!`);
    } else if (result.error) {
      showToast(result.error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            isDesktop
              ? { paddingBottom: theme.spacing.xl }
              : { paddingBottom: insets.bottom + theme.spacing.xl, transform: [{ translateY }] },
          ]}
          {...(!isDesktop ? panResponder.panHandlers : {})}
        >
          {isDesktop ? (
            <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
              <AppIcon name="close" size={20} color={theme.colors.mauve} />
            </Pressable>
          ) : (
            <View style={styles.handleArea} onStartShouldSetResponder={() => true}>
              <View style={styles.handle} />
            </View>
          )}
          <View style={styles.header}>
            <Text style={styles.title}>ThriftVault Pro</Text>
            <AppIcon name="sparkles" size={22} color={theme.colors.vintageBlueDark} style={styles.titleIcon} />
          </View>
          <Text style={styles.sub}>
            Your first {TRIAL_DURATION_DAYS} days are free with every Pro feature unlocked. Pick a plan to continue after your trial.
          </Text>

          <ScrollView style={styles.features} showsVerticalScrollIndicator={false}>
            {FEATURES.map((text, i) => (
              <View key={i} style={styles.featRow}>
                <AppIcon name="checkmark-circle" size={20} color={theme.colors.vintageBlueDark} />
                <Text style={styles.featText}>{text}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.plans}>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
                theme={theme}
                styles={styles}
              />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, (pressed || purchasing) && styles.ctaPressed]}
            onPress={handleSubscribe}
            disabled={purchasing}
          >
            {purchasing
              ? <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              : <Text style={styles.ctaText}>Start Free Trial</Text>
            }
          </Pressable>
          <Text style={styles.fine}>
            {TRIAL_DURATION_DAYS}-day free trial · then {activePlan.price}{activePlan.period} · cancel anytime
          </Text>
          <Text style={styles.legal}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before the
            end of the current period. Your account will be charged for renewal within 24
            hours prior to the end of the current period. Manage and cancel subscriptions
            in your Account Settings after purchase.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL('https://chrisluhrsux.github.io/thriftvaultapp/assets/privacy-policy.html')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalDot}> · </Text>
            <Pressable onPress={() => Linking.openURL('https://chrisluhrsux.github.io/thriftvaultapp/assets/terms.html')}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  theme,
  styles,
}: {
  plan: PlanOption;
  selected: boolean;
  onSelect: () => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
      ]}
      onPress={onSelect}
    >
      {plan.badge ? (
        <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
          <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>{plan.badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{plan.label}</Text>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>
        {plan.price}<Text style={styles.planPeriod}>{plan.period}</Text>
      </Text>
      <Text style={[styles.planPerMonth, selected && styles.planPerMonthSelected]}>{plan.perMonth}</Text>
    </Pressable>
  );
}

function createStyles(theme: Theme, isDesktop: boolean) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: isDesktop ? 'center' : 'flex-end',
    alignItems: isDesktop ? 'center' : 'stretch',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.cream,
    borderRadius: isDesktop ? theme.radius.xl : undefined,
    borderTopLeftRadius: isDesktop ? undefined : theme.radius.xl,
    borderTopRightRadius: isDesktop ? undefined : theme.radius.xl,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: isDesktop ? theme.spacing.xxl : theme.spacing.md,
    maxWidth: 520,
    width: isDesktop ? 520 : '100%',
    ...(theme.shadows.md ?? {}),
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  handleArea: {
    paddingVertical: theme.spacing.sm,
    marginHorizontal: -theme.spacing.xxl,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.mauveLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.charcoal,
  },
  titleIcon: {
    marginLeft: 6,
  },
  sub: {
    ...theme.typography.bodySmall,
    color: theme.colors.mauve,
    marginBottom: theme.spacing.lg,
  },
  features: {
    maxHeight: 160,
    marginBottom: theme.spacing.lg,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  featText: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
    flex: 1,
  },
  plans: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  planCardSelected: {
    borderColor: theme.colors.vintageBlueDark,
    backgroundColor: theme.colors.surface,
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant,
    marginBottom: 6,
  },
  planBadgeSelected: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  planBadgeText: {
    ...theme.typography.label,
    color: theme.colors.mauve,
  },
  planBadgeTextSelected: {
    color: theme.colors.onPrimary,
  },
  planLabel: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginBottom: 4,
  },
  planLabelSelected: {
    color: theme.colors.vintageBlueDark,
  },
  planPrice: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
  },
  planPriceSelected: {
    color: theme.colors.vintageBlueDark,
  },
  planPeriod: {
    ...theme.typography.caption,
    fontWeight: '400',
  },
  planPerMonth: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  planPerMonthSelected: {
    color: theme.colors.vintageBlueDark,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  fine: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    textAlign: 'center',
  },
  legal: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 15,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  legalLink: {
    ...theme.typography.label,
    color: theme.colors.vintageBlueDark,
    textDecorationLine: 'underline',
  },
  legalDot: {
    ...theme.typography.label,
    color: theme.colors.mauve,
  },
  });
}
