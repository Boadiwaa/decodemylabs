/**
 * Decode My Labs Color Palette
 * A single teal ramp: #F3FBFB → #CDEEEE → #6FD0CC → #1A9E9B → #0C4E4C,
 * plus one in-between teal (#15807D) so buttons and small teal text meet
 * WCAG AA contrast. Text/background pairs below are AA (4.5:1) unless noted.
 */

const Colors = {
  // Primary brand
  teal: '#15807D',        // buttons (white text 4.8:1), links, small teal text, icons
  tealDark: '#106B68',    // teal text on tealLight surfaces (5.1:1)
  tealLight: '#CDEEEE',   // tinted cards, chips, selected states, header band
  tealMuted: '#6FD0CC',   // chart lines, progress, borders — decoration only
  tealVivid: '#1A9E9B',   // brand accent: logo, large headings, large icons (3:1, large only)

  // Deep teal (text hierarchy; names kept from the earlier navy palette)
  navy: '#0C4E4C',
  navyLight: '#0E5F5D',
  navyMuted: '#106B68',

  // Legacy blue (kept for continuity)
  blue: '#0072E3',
  blueLight: '#EFF6FF',

  // Severity / Status: deep colours for text and dots, soft backgrounds.
  // Kept distinct from the brand teal so "normal" never reads as decoration.
  danger: '#B4474F',
  dangerBg: '#FBEDEE',
  dangerBorder: '#F0C9CC',

  warn: '#8A5A12',
  warnBg: '#FBF4E6',
  warnBorder: '#EED9B3',

  safe: '#2E7A55',
  safeBg: '#EAF6EF',
  safeBorder: '#BFE3CF',

  // Onboarding accent (was indigo; now part of the teal ramp)
  indigo: '#15807D',
  indigoLight: '#E6F5F5',

  // Backgrounds
  bgPrimary: '#F3FBFB',
  bgCard: '#FFFFFF',
  bgSecondary: '#E6F5F5',
  bgWarm: '#E6F5F5',
  white: '#FFFFFF',

  // Borders
  border: '#D5E9E9',
  borderLight: '#E6F2F2',

  // Text
  textPrimary: '#0C4E4C',
  textSecondary: '#4F6B6A',
  textMuted: '#5E7877',
  textWhite: '#FFFFFF',

  // Shadows (use as shadowColor)
  shadow: '#0C4E4C',

  // Overlays
  overlayDark: 'rgba(12, 78, 76, 0.92)',
  overlayLight: 'rgba(255, 255, 255, 0.92)',
};

export default Colors;
