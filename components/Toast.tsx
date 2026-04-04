import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/context/ToastContext';
import { theme } from '@/theme';

const FADE_DURATION = 250;

export function Toast() {
  const insets = useSafeAreaInsets();
  const { message } = useToast();
  const opacity = useRef(new Animated.Value(0)).current;

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

const styles = StyleSheet.create({
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
