import { Platform } from 'react-native';
import type { ThemeColors } from './colors';
import { colors, darkColors, lightColors } from './colors';
import { typography } from './typography';

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  full: 9999,
} as const;

function shadowsFor() {
  return {
    sm: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
      default: {},
    }),
    md: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 32,
      },
      android: { elevation: 6 },
      default: {},
    }),
  } as const;
}

const animation = {
  duration: 300,
  easing: [0.4, 0, 0.2, 1] as const,
};

const minTouchTargetSize = 44;

export type Theme = {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: ReturnType<typeof shadowsFor>;
  animation: typeof animation;
  minTouchTargetSize: number;
};

export function getTheme(colorsOverride: ThemeColors): Theme {
  return {
    colors: colorsOverride,
    typography,
    spacing,
    radius,
    shadows: shadowsFor(),
    animation,
    minTouchTargetSize,
  };
}

export const lightTheme = getTheme(lightColors);
export const darkTheme = getTheme(darkColors);

export const theme = getTheme(colors);
