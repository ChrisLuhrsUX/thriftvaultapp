import { usePathname, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/context/ThemeContext';

export const SIDEBAR_WIDTH = 220;

const NAV_ITEMS = [
  { name: 'index', label: 'My Vault', icon: 'folder-open' as const, path: '/(tabs)' },
  { name: 'scan', label: 'Scan', icon: 'camera' as const, path: '/(tabs)/scan' },
  { name: 'profile', label: 'Profile', icon: 'person' as const, path: '/(tabs)/profile' },
] as const;

export function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      backgroundColor: theme.colors.surface,
      borderRightWidth: 1,
      borderRightColor: theme.colors.mauveLight,
      paddingTop: 0,
    },
    logoArea: {
      paddingHorizontal: 20,
      paddingVertical: 22,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.mauveLight,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    logo: {
      width: 34,
      height: 34,
      borderRadius: 8,
    },
    appName: {
      ...theme.typography.h2,
      color: theme.colors.charcoal,
    },
    nav: {
      paddingTop: 12,
    },
    navItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
      marginHorizontal: 8,
      marginVertical: 2,
      borderRadius: theme.radius.md,
    },
    navItemActive: {
      backgroundColor: theme.colors.vintageBlueLight,
    },
    navLabel: {
      ...theme.typography.body,
      color: theme.colors.mauve,
    },
    navLabelActive: {
      color: theme.colors.vintageBlueDark,
      fontWeight: '600' as const,
    },
  }), [theme]);

  const isActive = (name: string) => {
    if (name === 'index') {
      return pathname === '/' || pathname === '/(tabs)' || (!pathname.includes('scan') && !pathname.includes('profile'));
    }
    return pathname.includes(name);
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoArea}>
        <Image
          source={require('@/assets/logo/thriftvault_logo.jpg')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.appName}>ThriftVault</Text>
      </View>
      <View style={styles.nav}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.name);
          return (
            <Pressable
              key={item.name}
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => router.replace(item.path as any)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <AppIcon
                name={item.icon}
                size={20}
                color={active ? theme.colors.vintageBlueDark : theme.colors.mauve}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
