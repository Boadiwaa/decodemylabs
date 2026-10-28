/**
 * TalkingLabs Typography System
 *
 * One bundled font, Noto Sans, on iOS and Android so the app looks the same
 * everywhere. It covers English, French and Akan (ɛ, ɔ) plus lab symbols
 * (µ, ², ×). Registered in app.json via the expo-font plugin as "Noto Sans"
 * with real 400/500/600/700 weights, so fontWeight works as usual.
 *
 * Scale (size / line height), nothing below 12 px:
 *   display 30/38 · title 24/32 · heading 20/28 · subheading 17/24
 *   body 16/24 · secondary 14/20 · caption 13/18 · small 12/16
 */

const fontFamily = 'Noto Sans';

const Typography = {
  // Font family (kept as two names for existing styles; both are Noto Sans)
  serif: fontFamily,
  sans: fontFamily,

  // Headings
  hero: {
    fontFamily,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
  },
  h1: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h2: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h3: {
    fontFamily,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h4: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },

  // Body
  bodyLarge: {
    fontFamily,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
  },
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // Labels: sentence case reads more easily than spaced-out capitals
  label: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  labelSmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  caption: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Buttons
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSmall: {
    fontFamily,
    fontSize: 14,
    fontWeight: '700',
  },

  // Accents
  stat: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Lab values: digits of equal width so numbers line up in lists
  numbers: {
    fontVariant: ['tabular-nums'],
  },
};

export default Typography;
