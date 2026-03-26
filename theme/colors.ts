export const lightColors = {
  cream: '#F8F1E9',
  blush: '#FFEFEF',
  blushDeep: '#F4DEDE',
  /** Vintage blue (logo fabric). Primary UI: buttons, tabs, active states. */
  vintageBlue: '#508C88',
  vintageBlueDark: '#3F7B77',
  vintageBlueDeep: '#2E6A66',
  profit: '#4A7A44',
  terra: '#8B4E30',
  terraLight: 'rgba(139,78,48,0.12)',
  charcoal: '#3C2F2F',
  charcoalSoft: '#5A4A4A',
  mauve: '#706060',
  mauveLight: 'rgba(112,96,96,0.15)',
  lavender: '#E8D9E0',
  /** Inactive chip/pill background and borders (replaces lavender for pills to avoid purple tint). */
  surfaceVariant: '#E8E2DC',
  white: '#FAF8F5',
  surface: '#FAF8F5',
  onPrimary: '#FAF8F5',
} as const;

export const darkColors = {
  cream: '#1C1B1F',
  blush: '#2D2A2E',
  blushDeep: '#3A3639',
  /** Vintage blue (logo fabric). Primary UI: buttons, tabs, active states. */
  vintageBlue: '#8ab8b4',
  /** Same dark teal as light mode — stays dark so white onPrimary text passes AA (4.63:1). */
  vintageBlueDark: '#3F7B77',
  vintageBlueDeep: '#2E6A66',
  profit: '#8FBC88',
  terra: '#C97C5D',
  terraLight: 'rgba(201,124,93,0.2)',
  charcoal: '#E8E4E1',
  charcoalSoft: '#C9C4BF',
  mauve: '#B5A8A8',
  mauveLight: 'rgba(155,138,138,0.25)',
  lavender: '#3D3840',
  surfaceVariant: '#3A3639',
  white: '#E8E4E1',
  surface: '#2D2A2E',
  onPrimary: '#FAF8F5',
} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;

export const colors = lightColors;
