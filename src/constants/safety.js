/**
 * The safety phrase that ends patient-facing medical text, per language.
 * English and Akan text end with the English phrase; French text ends with the
 * French one only.
 */

export const SAFETY_PHRASE = 'Consult a licensed healthcare provider.';
export const SAFETY_PHRASE_FR = 'Consultez un professionnel de santé agréé.';

export const SAFETY_PHRASES = { en: SAFETY_PHRASE, fr: SAFETY_PHRASE_FR, ak: SAFETY_PHRASE };

// Spellings found in model output and older saved text, removed before the right phrase is added.
const KNOWN_PHRASES = [
  /Consult a licensed healthcare provider\.?/gi,
  /Consultez un professionnel de sant[ée] agr[ée][ée]\.?/gi,
];

// Gemma often adds its own English disclaimer in markdown ("*** *Disclaimer: This analysis is …*"),
// even inside the French text. The app's safety phrase replaces it.
const MODEL_DISCLAIMER = /\*{0,2}\s*(?:Disclaimer|Avertissement)\s*:[^*]*\*{0,2}/gi;
const MARKDOWN_RULE = /(?:^|\s)[*_-]{3,}(?=\s|$)/g;

/**
 * Remove any copies of a safety phrase (and model-written disclaimers) and end
 * the text with exactly one safety phrase, in `lang`.
 */
export function withSafetyPhrase(text, lang = 'en') {
  const body = [MODEL_DISCLAIMER, MARKDOWN_RULE, ...KNOWN_PHRASES]
    .reduce((t, re) => t.replace(re, ' '), String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
  return body ? `${body} ${SAFETY_PHRASES[lang] || SAFETY_PHRASE}` : '';
}
