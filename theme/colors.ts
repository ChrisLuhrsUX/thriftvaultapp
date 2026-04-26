export const lightColors = {
  cream: '#F8F1E9',
  blush: '#FFEFEF',
  blushDeep: '#F4DEDE',
  /** Vintage blue (logo fabric). Primary UI: buttons, tabs, active states. */
  vintageBlue: '#508C88',
  vintageBlueLight: '#C8E6E4',
  vintageBlueDark: '#3F7B77',
  vintageBlueDeep: '#2E6A66',
  profit: '#4A7A44',
  loss: '#C0392B',
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
  overlayLight: 'rgba(0,0,0,0.15)',
  overlay: 'rgba(0,0,0,0.35)',
  overlayHeavy: 'rgba(0,0,0,0.55)',
  /** White overlays for use on dark image/camera backgrounds. */
  overlayWhiteStrong: 'rgba(255,255,255,0.9)',
  overlayWhiteMid: 'rgba(255,255,255,0.55)',
  overlayWhiteLight: 'rgba(255,255,255,0.2)',
  shadow: '#000000',
  /** Near-black used as background in fullscreen photo viewer. */
  photoBackground: '#1A1A1A',

} as const;

export const darkColors = {
  cream: '#211A14',
  blush: '#2B2118',
  blushDeep: '#352A1E',
  /** Vintage blue (logo fabric). Primary UI: buttons, tabs, active states. */
  vintageBlue: '#6ECEC8',
  vintageBlueLight: '#2A4F4D',
  /** Same dark teal as light mode — stays dark so white onPrimary text passes AA (4.63:1). */
  vintageBlueDark: '#3F7B77',
  vintageBlueDeep: '#2E6A66',
  profit: '#6BBF62',
  loss: '#EF6B6B',
  terra: '#E09070',
  terraLight: 'rgba(224,144,112,0.2)',
  charcoal: '#EDE7DF',
  charcoalSoft: '#C9C4BF',
  mauve: '#B5A8A8',
  mauveLight: 'rgba(155,138,138,0.25)',
  lavender: '#37301F',
  surfaceVariant: '#372C22',
  white: '#EDE7DF',
  surface: '#2C221A',
  onPrimary: '#FAF8F5',
  overlayLight: 'rgba(0,0,0,0.15)',
  overlay: 'rgba(0,0,0,0.35)',
  overlayHeavy: 'rgba(0,0,0,0.55)',
  /** White overlays for use on dark image/camera backgrounds. */
  overlayWhiteStrong: 'rgba(255,255,255,0.9)',
  overlayWhiteMid: 'rgba(255,255,255,0.55)',
  overlayWhiteLight: 'rgba(255,255,255,0.2)',
  shadow: '#000000',
  /** Near-black used as background in fullscreen photo viewer. */
  photoBackground: '#1A1A1A',

} as const;

export type ThemeColors = typeof lightColors | typeof darkColors;

export const colors = lightColors;
