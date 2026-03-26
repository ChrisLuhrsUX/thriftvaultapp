import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

export function StatusBar() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      height: 50,
      backgroundColor: theme.colors.cream,
    },
  }), [theme]);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]} />
  );
}
