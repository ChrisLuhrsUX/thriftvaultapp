import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/context/ThemeContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { Theme } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ONBOARDING_KEY = 'tv_onboarding_done';

const SLIDES = [
  {
    title: 'Flip thrift finds.\nReal profit.',
    titleEm: 'Real profit.',
    sub: 'Scan any thrift store find. Get instant AI flip predictions, trend insights, and buy/skip advice.',
  },
  {
    title: 'Track every flip\neffortlessly',
    titleEm: 'effortlessly',
    sub: 'Your personal thrift dashboard. Every item from purchase to sale, profit calculated automatically.',
  },
  {
    title: "Your vault awaits,\nlet's start flipping",
    titleEm: "let's start flipping",
    sub: 'Turn secondhand treasures into serious side income. Start with a 30-day free trial, then from $4.99/mo.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { isTablet } = useResponsive();
  const styles = useMemo(() => createStyles(theme, isTablet), [theme, isTablet]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    Alert.alert(
      'Your data stays on this device',
      'Your vault is stored locally — no account required. AI scan needs internet, but everything else works offline. Uninstalling the app will permanently delete your vault.',
      [{ text: 'Got it', onPress: () => router.replace('/(tabs)') }]
    );
  }, [router]);

  const next = useCallback(() => {
    if (index < SLIDES.length - 1) {
      const nextIndex = index + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
      setIndex(nextIndex);
    } else {
      finish();
    }
  }, [index, screenWidth, finish]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={false}
        style={styles.slidesWrap}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setIndex(newIndex);
        }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: screenWidth }]}>
            <View style={styles.illo}>
              <AppIcon
                name={i === 0 ? 'camera' : i === 1 ? 'folder-open' : 'sparkles'}
                size={isTablet ? 120 : 80}
                color={theme.colors.vintageBlueDark}
              />
            </View>
            <Text style={styles.title}>
              {slide.title.split('\n')[0]}
              {'\n'}
              <Text style={styles.titleEm}>{slide.titleEm}</Text>
            </Text>
            <Text style={styles.sub}>{slide.sub}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <View style={styles.footerInner}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={next}
            accessibilityLabel={index < SLIDES.length - 1 ? 'Continue' : 'Start free trial'}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>
              {index < SLIDES.length - 1 ? 'Continue' : 'Start Free Trial'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
            onPress={finish}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
          >
            <Text style={styles.btnGhostText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: Theme, isTablet: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  slidesWrap: {
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: isTablet ? 60 : 32,
    justifyContent: 'center',
  },
  illo: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? 40 : 0,
    flex: isTablet ? 0 : 1,
    minHeight: isTablet ? 0 : 200,
  },
  title: {
    ...theme.typography.display,
    fontSize: isTablet ? 36 : 30,
    textAlign: 'center',
    color: theme.colors.charcoal,
    marginBottom: 14,
    maxWidth: isTablet ? 560 : undefined,
  },
  titleEm: {
    fontStyle: 'italic',
    color: theme.colors.vintageBlueDark,
  },
  sub: {
    ...theme.typography.body,
    fontSize: isTablet ? 17 : undefined,
    color: theme.colors.mauve,
    textAlign: 'center',
    maxWidth: isTablet ? 480 : 340,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceVariant,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.vintageBlue,
  },
  footer: {
    paddingHorizontal: 28,
  },
  footerInner: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  btnPrimary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnPrimaryText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  btnGhost: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnGhostText: {
    ...theme.typography.body,
    color: theme.colors.mauve,
  },
  });
}
