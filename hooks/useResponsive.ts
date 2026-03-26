import { Platform, useWindowDimensions } from 'react-native';

/**
 * Responsive hook covering iPhone, iPad, and desktop web breakpoints.
 *
 * Breakpoints:
 *  - phone:        < 744px   (all iPhones)
 *  - tablet:      744–1023px (iPad mini, iPad Air, iPad Pro 11")
 *  - tabletLarge: 1024–1279px (iPad Pro 12.9" / 13", any iPad in landscape)
 *  - desktop:     ≥ 1280px   (browser on laptop / desktop)
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 744;
  const isTabletLarge = width >= 1024;
  const isDesktop = Platform.OS === 'web' && width >= 1280;
  const isLandscape = width > height;

  /** Grid columns: 2 / 3 / 4 across phone → tabletLarge/desktop */
  const gridColumns = isTabletLarge ? 4 : isTablet ? 3 : 2;

  /** Horizontal padding for screen edges */
  const hPad = isDesktop ? 48 : isTablet ? 32 : 20;

  /** Padding for page-level headers and titles */
  const headerHPad = isDesktop ? 56 : isTablet ? 40 : 24;

  /**
   * Max-width for a centred content column on wide screens.
   * Apply with `alignSelf: 'center'` and `width: '100%'` on the container.
   */
  const contentMaxWidth: number | undefined = isDesktop ? 1100 : isTabletLarge ? 960 : isTablet ? 768 : undefined;

  /**
   * Max-width for single-column form / card content.
   */
  const formMaxWidth: number | undefined = isDesktop ? 800 : isTablet ? 600 : undefined;

  return {
    width,
    height,
    isTablet,
    isTabletLarge,
    isDesktop,
    isLandscape,
    gridColumns,
    hPad,
    headerHPad,
    contentMaxWidth,
    formMaxWidth,
  };
}
