import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { DEFAULT_PLAN_ID, PLANS, TRIAL_DURATION_DAYS, type PlanOption } from '@/constants/monetization';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

const SHEET_OFFSCREEN = 700;

const FEATURES = [
  'Unlimited AI scans, pricing & unlimited vault',
  'Handmade detection & rescanning',
  'Counterfeit & scam alerts on every scan',
  'Upcycle suggestions & flip ideas',
  'Haul tracking & profit analytics',
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
  const reducedMotion = useReducedMotion();
  const { subscribe, restorePurchases } = usePurchases();
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_PLAN_ID);
  const [purchasing, setPurchasing] = useState(false);
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;

  useEffect(() => {
    if (isDesktop) return;
    if (visible) {
      if (reducedMotion) {
        translateY.setValue(0);
        return;
      }
      translateY.setValue(SHEET_OFFSCREEN);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 55,
        friction: 11,
      }).start();
    }
  }, [visible, isDesktop, translateY, reducedMotion]);

  const dismiss = useCallback(() => {
    if (isDesktop) {
      onClose();
      return;
    }
    if (reducedMotion) {
      translateY.setValue(SHEET_OFFSCREEN);
      onClose();
      return;
    }
    Animated.timing(translateY, {
      toValue: SHEET_OFFSCREEN,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(SHEET_OFFSCREEN);
      onClose();
    });
  }, [isDesktop, onClose, translateY, reducedMotion]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Let children own their own taps; only steal the gesture once a clear downward drag begins.
        // Matches the BottomSheetModal pattern so the inner ScrollView wins vertical scrolls.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dx) < Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.5) {
            dismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          }
        },
      }),
    [dismiss, translateY]
  );

  const activePlan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success) {
      dismiss();
      showToast('Purchases restored');
    } else {
      showToast(result.error ?? 'Nothing to restore');
    }
  };

  const handleSubscribe = async () => {
    if (purchasing) return;
    setPurchasing(true);
    const result = await subscribe(activePlan.id);
    setPurchasing(false);
    if (result.success) {
      dismiss();
      if (!result.alreadyActive) showToast(`Welcome to ThriftVault Pro!`);
    } else if (result.error) {
      showToast(result.error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'none'}
      onRequestClose={dismiss}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={() => { Haptics.selectionAsync(); dismiss(); }} accessibilityLabel="Dismiss" accessibilityRole="button" />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            isDesktop
              ? { paddingBottom: theme.spacing.xl }
              : { paddingBottom: insets.bottom + theme.spacing.xl, transform: [{ translateY }] },
          ]}
          {...(!isDesktop ? panResponder.panHandlers : {})}
        >
          {isDesktop ? (
            <Pressable
              style={styles.closeBtn}
              onPress={() => { Haptics.selectionAsync(); dismiss(); }}
              hitSlop={12}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <AppIcon name="close" size={20} color={theme.colors.mauve} />
            </Pressable>
          ) : (
            <View style={styles.handleArea} onStartShouldSetResponder={() => true}>
              <View style={styles.handle} />
            </View>
          )}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header} accessible accessibilityRole="header" accessibilityLabel="ThriftVault Pro">
              <Text style={styles.title}>ThriftVault Pro</Text>
              <AppIcon name="sparkles" size={22} color={theme.colors.vintageBlueDark} style={styles.titleIcon} />
            </View>
            <Text style={styles.sub}>
              Your first {TRIAL_DURATION_DAYS} days are free with every Pro feature unlocked. Pick a plan to continue after your trial.
            </Text>

            <View style={styles.features}>
              {FEATURES.map((text, i) => (
                <View key={i} style={styles.featRow}>
                  <AppIcon name="checkmark-circle" size={20} color={theme.colors.vintageBlueDark} />
                  <Text style={styles.featText}>{text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.plans}>
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  onSelect={() => { Haptics.selectionAsync(); setSelectedPlan(plan.id); }}
                  styles={styles}
                />
              ))}
            </View>
          </ScrollView>

          <Button
            label="Start Free Trial"
            onPress={handleSubscribe}
            size="lg"
            loading={purchasing}
            accessibilityLabel="Start free trial"
            style={{ marginTop: theme.spacing.xs }}
          />
          <Pressable
            onPress={() => { Haptics.selectionAsync(); dismiss(); }}
            style={styles.notNowBtn}
            accessibilityLabel="Not now"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.notNowText}>Not now</Text>
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
            <Pressable onPress={() => { Haptics.selectionAsync(); Linking.openURL('https://thriftvaultapp.com/privacy-policy/'); }} accessibilityLabel="Privacy Policy" accessibilityRole="link">
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalDot}> · </Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); Linking.openURL('https://thriftvaultapp.com/terms/'); }} accessibilityLabel="Terms of Use" accessibilityRole="link">
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.legalDot}> · </Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); handleRestore(); }} disabled={restoring} accessibilityLabel="Restore purchases" accessibilityRole="button">
              <Text style={styles.legalLink}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
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
  styles,
}: {
  plan: PlanOption;
  selected: boolean;
  onSelect: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
      ]}
      onPress={onSelect}
      accessibilityLabel={`${plan.label} plan, ${plan.price}${plan.period}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {plan.badge ? (
        <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
          <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>{plan.badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{plan.label}</Text>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{plan.price}</Text>
      <Text style={[styles.planPeriod, selected && styles.planPeriodSelected]}>{plan.period}</Text>
      {plan.perMonth ? (
        <Text style={[styles.planPerMonth, selected && styles.planPerMonthSelected]}>{plan.perMonth}</Text>
      ) : null}
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
    backgroundColor: theme.colors.overlayHeavy,
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
    maxHeight: '90%',
    ...(theme.shadows.md ?? {}),
  },
  scrollArea: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    minWidth: theme.minTouchTargetSize,
    minHeight: theme.minTouchTargetSize,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: theme.colors.mauve,
    fontWeight: '400',
    marginBottom: 2,
  },
  planPeriodSelected: {
    color: theme.colors.vintageBlueDark,
  },
  planPerMonth: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  planPerMonthSelected: {
    color: theme.colors.vintageBlueDark,
  },
  notNowBtn: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    minHeight: theme.minTouchTargetSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: {
    ...theme.typography.body,
    color: theme.colors.mauve,
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
