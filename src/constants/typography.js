/**
 * TalkingLabs Typography System
 * Inspired by Nomi Health — clean, elegant, clinical.
 * Uses system serif for headings (Georgia) and system sans-serif for body,
 * mirroring Nomi's p22-mackinac-pro serif + clean sans-serif pairing.
 */

import { Platform } from 'react-native';

// Serif font for headings (closest to Nomi's Mackinac Pro)
const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
});

// Sans-serif for body (system default, clean and modern)
const sansFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
});

const Typography = {
  // Font families
  serif: serifFont,
  sans: sansFont,

  // Heading styles (Nomi-inspired: large, bold, serif)
  hero: {
    fontFamily: serifFont,
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: serifFont,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: serifFont,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: serifFont,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  h4: {
    fontFamily: serifFont,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },

  // Body styles (sans-serif, clean)
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },

  // Label / UI styles
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  labelSmall: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Button styles
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonSmall: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Accent styles
  stat: {
    fontFamily: serifFont,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  pill: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
};

export default Typography;
