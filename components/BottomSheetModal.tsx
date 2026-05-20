import { useTheme } from '@/context/ThemeContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SHEET_OFFSCREEN = 700;

interface BottomSheetModalProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  /** Optional override applied on top of the default sheet style (e.g. maxHeight). */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Accessibility label for the backdrop dismiss target. Defaults to "Dismiss". */
  backdropLabel?: string;
  /** Fires once the slide-down animation completes and the sheet has unmounted. Mirrors the native Modal `onDismiss` semantics, useful for chaining a follow-up flow (e.g. opening an image picker after the sheet finishes closing). */
  onAfterDismiss?: () => void;
}

/**
 * Slide-down bottom sheet modal. Mirrors the PaywallModal pattern: spring open from
 * 700px offscreen, 240ms timing dismiss, PanResponder drag-to-dismiss, desktop fallback
 * to centered fade. `visible: true → false` (from anywhere) triggers the slide-down
 * before unmount via an internal `shouldRender` gate, so callers can flip `visible`
 * directly from button onPress handlers without losing the close animation.
 */
export function BottomSheetModal({
  visible,
  onDismiss,
  children,
  sheetStyle,
  backdropLabel = 'Dismiss',
  onAfterDismiss,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

  const [shouldRender, setShouldRender] = useState(visible);
  const translateY = useRef(new Animated.Value(visible ? 0 : SHEET_OFFSCREEN)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      if (isDesktop) return;
      translateY.setValue(SHEET_OFFSCREEN);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 55,
        friction: 11,
      }).start();
      return;
    }
    if (!shouldRender) return;
    if (isDesktop) {
      setShouldRender(false);
      onAfterDismiss?.();
      return;
    }
    Animated.timing(translateY, {
      toValue: SHEET_OFFSCREEN,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setShouldRender(false);
      onAfterDismiss?.();
    });
  }, [visible, shouldRender, isDesktop, translateY, onAfterDismiss]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Let children own their own taps; only steal the gesture once a clear downward drag begins.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dx) < Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.5) {
            onDismiss();
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
    [onDismiss, translateY]
  );

  if (!shouldRender) return null;

  return (
    <Modal
      visible
      transparent
      animationType={isDesktop ? 'fade' : 'none'}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityLabel={backdropLabel}
          accessibilityRole="button"
        />
        <Animated.View
          style={[
            styles.sheet,
            isDesktop
              ? { paddingBottom: theme.spacing.xl }
              : { paddingBottom: insets.bottom + theme.spacing.xl, transform: [{ translateY }] },
            sheetStyle,
          ]}
          {...(!isDesktop ? panResponder.panHandlers : {})}
        >
          {!isDesktop && (
            <View style={styles.handleArea} onStartShouldSetResponder={() => true}>
              <View style={styles.handle} />
            </View>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
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
      ...(theme.shadows.md ?? {}),
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
  });
}
