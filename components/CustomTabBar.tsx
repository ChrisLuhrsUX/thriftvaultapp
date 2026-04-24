import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/context/ThemeContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';

const TAB_LABELS: Record<string, string> = {
  index: 'My Vault',
  scan: 'Scan',
  profile: 'Profile',
};

const TAB_ICONS: Record<string, 'shirt' | 'camera' | 'person'> = {
  index: 'shirt',
  scan: 'camera',
  profile: 'person',
};

function createStyles(theme: Theme, isTablet: boolean) {
  const scanSize = isTablet ? 80 : 72;
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      paddingTop: isTablet ? 14 : 10,
      paddingHorizontal: isTablet ? 40 : 20,
      minHeight: theme.minTouchTargetSize + (isTablet ? 32 : 24),
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.mauveLight,
      ...(theme.shadows.md ?? {}),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: theme.minTouchTargetSize,
      opacity: 1,
    },
    tabPressed: {
      opacity: 0.85,
    },
    scanWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: isTablet ? -52 : -44,
      minHeight: theme.minTouchTargetSize,
    },
    scanPressed: {
      opacity: 0.9,
    },
    scanButton: {
      width: scanSize,
      height: scanSize,
      borderRadius: scanSize / 2,
      backgroundColor: theme.colors.vintageBlueDark,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.cream,
      marginBottom: 4,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
          }
        : { elevation: 8 }),
    },
    label: {
      ...theme.typography.label,
      fontSize: isTablet ? 12 : 10,
    },
    scanLabel: {
      fontSize: isTablet ? 13 : 12,
    },
  });
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { isTablet } = useResponsive();
  const styles = useMemo(() => createStyles(theme, isTablet), [theme, isTablet]);
  const routes = state.routes;

  const onTabPress = (routeName: string) => {
    const path = routeName === 'index' ? '/(tabs)' : `/(tabs)/${routeName}`;
    router.replace(path as any);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
      {routes.map((route, index) => {
        const isFocused = state.index === index;
        const isScan = route.name === 'scan';
        const label = TAB_LABELS[route.name] ?? route.name;
        const iconName = TAB_ICONS[route.name] ?? 'ellipse';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            if (isScan) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
              Haptics.selectionAsync();
            }
            onTabPress(route.name);
          }
        };

        const color = isFocused ? theme.colors.vintageBlueDark : theme.colors.mauve;

        if (isScan) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.scanWrap,
                pressed && styles.scanPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Scan"
            >
              <View style={styles.scanButton}>
                <AppIcon name="camera" size={isTablet ? 36 : 32} color={theme.colors.onPrimary} />
              </View>
              <Text style={[styles.label, styles.scanLabel, { color: theme.colors.vintageBlueDark }]}>
                {label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <AppIcon
              name={iconName as 'shirt' | 'person'}
              size={isTablet ? 28 : 24}
              color={color}
            />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
