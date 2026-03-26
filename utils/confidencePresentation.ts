import type { Theme } from '@/theme';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidencePresentation(
  level: ConfidenceLevel,
  theme: Theme,
): { label: string; color: string; bg: string } {
  switch (level) {
    case 'low':
      return {
        label: 'Low resale data - price manually',
        color: theme.colors.terra,
        bg: theme.colors.terraLight,
      };
    case 'medium':
      return {
        label: 'Medium confidence - verify comps when pricing',
        color: theme.colors.vintageBlueDark,
        bg: theme.colors.surfaceVariant,
      };
    case 'high':
      return {
        label: 'High confidence - strong resale comps',
        color: theme.colors.profit,
        bg: theme.colors.surfaceVariant,
      };
  }
}

export function getConfidenceColor(theme: Theme, level?: ConfidenceLevel | null): string {
  if (level === 'low' || level === 'medium' || level === 'high') {
    return getConfidencePresentation(level, theme).color;
  }
  return theme.colors.mauve;
}
