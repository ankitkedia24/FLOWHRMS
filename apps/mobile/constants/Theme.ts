/**
 * FlowHRMS Design Tokens for React Native
 * ========================================
 * Exact 1:1 mapping from apps/web/src/styles/tokens.css
 * and design/tokens/*.json (FlowHRMS-Design-Handoff-v1).
 *
 * The mobile app uses the LIGHT theme by default (employee warm surface),
 * matching the web's employee view. Dark mode overrides the colour block
 * only, same as the web's [data-theme="dark"] block.
 */

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface FlowThemeType {
  colors: typeof lightColors;
  typography: typeof typography;
  radius: typeof radius;
  spacing: typeof spacing;
  layout: typeof layout;
  shadows: typeof shadows;
  motion: typeof motion;
}

/* ---- Light theme colours (the designed primary theme) ---- */
const lightColors = {
  // Brand (Stitch "Respectful Field Utility": Electric Indigo + Deep Twilight)
  brandPrimary: '#6366F1',
  brandPrimaryHover: '#4F46E5',
  brandPrimaryActive: '#4338CA',
  brandPrimarySubtle: '#EDE9FE',
  brandPrimarySubtleHover: '#E0E7FF',
  brandPrimarySubtleActive: '#C7D2FE',
  brandNavy: '#181445',
  brandNavyDeep: '#1E1B4B',
  brandDeepTwilight: '#2E2A72',

  // Accent / Success (Mint Emerald - positive operational momentum)
  accentPositive: '#10B981',
  accentPositiveHover: '#059669',
  accentPositiveBg: '#ECFDF5',
  accentPositiveBorder: '#A7F3D0',

  // Warm (employee positive moments only — max one per screen)
  warmAccent: '#A2451F',
  warmAccentSoft: '#C4653C',
  warmSubtle: '#FBEFE7',
  warmText: '#7E3417',
  warmBorder: '#EDD9CC',

  // Surfaces
  surfaceCanvas: '#F7F8FC',
  surfaceCanvasWarm: '#FAF8F5', // Employee surface
  surfaceDefault: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F1F3FA',
  surfaceInverse: '#17163E',
  surfaceDisabled: '#EDEEF4',
  surfaceOverlay: 'rgba(18,23,46,0.48)',

  // Text
  textPrimary: '#17163E',
  textSecondary: '#5A6076',
  textTertiary: '#7A81A0',
  textDisabled: '#A6ABC4',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnWarm: '#FFFFFF',
  textLink: '#7166F3',

  // Borders
  borderSubtle: '#EDEEF4',
  borderDefault: '#E3E6F0',
  borderStrong: '#C9CFE2',
  borderStrongHover: '#B7BFD6',
  borderFocus: '#7166F3',
  borderWarm: '#EDD9CC',

  // Status tones (strict data contract D-005)
  status: {
    success: {
      fg: '#148A5E',
      bg: '#E2F4ED',
      text: '#0E6647',
      border: '#B8E2D2',
    },
    warning: {
      fg: '#A16207',
      bg: '#FAF0DA',
      text: '#7A4E06',
      border: '#EAD6A3',
    },
    error: {
      fg: '#C6293C',
      bg: '#FBE4E7',
      text: '#9A1F2E',
      border: '#F1BEC5',
    },
    info: {
      fg: '#2F6FD8',
      bg: '#E5EDFB',
      text: '#22509E',
      border: '#C0D3F2',
    },
    neutral: {
      fg: '#7A81A0',
      bg: '#EDEEF4',
      text: '#525878',
      border: '#DCDEE9',
    },
  },

  // Chart
  chartSeries1: '#7166F3',
  chartSeries2: '#5265D6',
  chartSeries3: '#8B97E8',
  chartSeries4: '#B9C2F2',
  chartGrid: '#EDEEF4',
};

/* ---- Dark mode colour overrides (tokens.css [data-theme="dark"]) ---- */
const darkColors: typeof lightColors = {
  brandPrimary: '#9F8EF4',
  brandPrimaryHover: '#B3A5F7',
  brandPrimaryActive: '#CEB4F5',
  brandPrimarySubtle: '#262462',
  brandPrimarySubtleHover: '#2F2C74',
  brandPrimarySubtleActive: '#38348A',
  brandNavy: '#F1F0FA',
  brandNavyDeep: '#010123',
  brandDeepTwilight: '#2F2C74',

  accentPositive: '#35C79D',
  accentPositiveHover: '#2DB38C',
  accentPositiveBg: 'rgba(53,199,157,0.16)',
  accentPositiveBorder: 'rgba(53,199,157,0.36)',

  warmAccent: '#E08A64',
  warmAccentSoft: '#EBA98B',
  warmSubtle: '#33231B',
  warmText: '#F2C7A8',
  warmBorder: '#4A3226',

  surfaceCanvas: '#07062A',
  surfaceCanvasWarm: '#141834',
  surfaceDefault: '#171C3E',
  surfaceRaised: '#1E2450',
  surfaceSunken: '#1E2450',
  surfaceInverse: '#F1F2F8',
  surfaceDisabled: '#242A55',
  surfaceOverlay: 'rgba(5,7,20,0.64)',

  textPrimary: '#F1F2F8',
  textSecondary: '#9BA3C7',
  textTertiary: '#7F87AD',
  textDisabled: '#5A6294',
  textInverse: '#17163E',
  textOnPrimary: '#07062A',
  textOnWarm: '#26150E',
  textLink: '#9F8EF4',

  borderSubtle: '#222850',
  borderDefault: '#2A3057',
  borderStrong: '#3A4270',
  borderStrongHover: '#4A5280',
  borderFocus: '#9F8EF4',
  borderWarm: '#4A3226',

  status: {
    success: {
      fg: '#3CBE88',
      bg: 'rgba(60,190,136,0.16)',
      text: '#8EE0BF',
      border: 'rgba(60,190,136,0.36)',
    },
    warning: {
      fg: '#D99A2B',
      bg: 'rgba(217,154,43,0.16)',
      text: '#EFCB86',
      border: 'rgba(217,154,43,0.36)',
    },
    error: {
      fg: '#EF6E7C',
      bg: 'rgba(239,110,124,0.16)',
      text: '#F7B3BB',
      border: 'rgba(239,110,124,0.36)',
    },
    info: {
      fg: '#7BA8F0',
      bg: 'rgba(123,168,240,0.16)',
      text: '#B6CEF7',
      border: 'rgba(123,168,240,0.36)',
    },
    neutral: {
      fg: '#9BA3C7',
      bg: 'rgba(155,163,199,0.16)',
      text: '#C3C9E2',
      border: 'rgba(155,163,199,0.32)',
    },
  },

  chartSeries1: '#7166F3',
  chartSeries2: '#5265D6',
  chartSeries3: '#8B97E8',
  chartSeries4: '#B9C2F2',
  chartGrid: '#222850',
};

/* ---- Typography (mobile-first scale from tokens.css) ---- */
const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  bodyLg: { fontSize: 17, lineHeight: 26, fontWeight: '400' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  bodySemibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  captionSemibold: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  dataXl: { fontSize: 32, lineHeight: 36, fontWeight: '600' as const },
  dataLg: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  data: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  mono: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const },
};

/* ---- Radius (tokens.css) ---- */
const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  input: 10,
  button: 10,
  buttonMobilePrimary: 14,
  chip: 999,
  card: 12,
  cardEmployee: 16,
  modal: 16,
  sheet: 20,
  avatar: 999,
  pill: 999,
  appIcon: 0.25,  // 25% — use manually
};

/* ---- Spacing (4px base, matching token names) ---- */
const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
};

/* ---- Layout / touch targets ---- */
const layout = {
  screenPaddingMobile: 20, // space-5
  cardPaddingMobile: 20,   // space-5
  sectionGapMobile: 16,    // space-4
  fieldGap: 16,            // space-4
  inlineGap: 8,            // space-2
  bottomNavHeight: 64,
  topBarHeightMobile: 56,
  thumbZoneBottom: 160,
  touchEmployeeMin: 48,
  touchPrimaryMobileAction: 56,
  touchIconButtonMobile: 48,
};

/* ---- Shadows (tokens.css) ---- */
const shadows = {
  elevation0: {},
  elevation1: {
    shadowColor: 'rgba(18,23,46,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  elevation2: {
    shadowColor: 'rgba(18,23,46,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  elevation3: {
    shadowColor: 'rgba(18,23,46,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  elevation4: {
    shadowColor: 'rgba(18,23,46,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 8,
  },
  primaryAction: {
    shadowColor: 'rgba(47,69,196,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 6,
  },
  warmAction: {
    shadowColor: 'rgba(162,69,31,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 6,
  },
};

/* ---- Motion ---- */
const motion = {
  durationInstant: 80,
  durationFast: 120,
  durationBase: 180,
  durationSlow: 260,
  durationSheet: 320,
  durationSkeleton: 1400,
};

/* ---- Exports ---- */
export const FlowTheme: FlowThemeType = {
  colors: lightColors,
  typography,
  radius,
  spacing,
  layout,
  shadows,
  motion,
};

export const FlowThemeDark: FlowThemeType = {
  colors: darkColors,
  typography,
  radius,
  spacing,
  layout,
  shadows,
  motion,
};

/**
 * Returns the correct theme for the given color scheme.
 * Light is the primary/default theme — same as web.
 */
export function getTheme(colorScheme: 'light' | 'dark' | null | undefined): FlowThemeType {
  return colorScheme === 'dark' ? FlowThemeDark : FlowTheme;
}
