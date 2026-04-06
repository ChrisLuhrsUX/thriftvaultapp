import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import type { Theme } from '@/theme';

const FADE_DURATION = 250;

export function Toast() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { message } = useToast();
  const opacity = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!message) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { top: insets.top + 64 },
        { opacity },
      ]}
    >
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      maxWidth: '80%',
      backgroundColor: theme.colors.charcoal,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.md,
    },
    text: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
}
