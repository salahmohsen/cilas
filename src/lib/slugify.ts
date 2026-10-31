/**
 * Slug generation shared by every collection's `slugField`.
 *
 * Payload's built-in slugify (`val.trim().replace(/ /g, '-').replace(/[^\w-]+/g,
 * '').toLowerCase()`) keeps only ASCII word characters, so an Arabic title such
 * as "البطولة والحداثة" reduces to an empty string. Our titles are bilingual, so
 * Arabic is romanised first and then slugified with the same rules.
 */

/** Arabic letter -> Latin transliteration (simplified, omits short vowels). */
const ARABIC_TO_LATIN: Record<string, string> = {
  // alif
  آ: 'a',
  أ: 'a',
  إ: 'i',
  ا: 'a',
  // ba
  ب: 'b',
  // ta
  ت: 't',
  ث: 'th',
  // jim
  ج: 'j',
  // ha
  ح: 'h',
  خ: 'kh',
  // dal
  د: 'd',
  ذ: 'dh',
  // ra
  ر: 'r',
  ز: 'z',
  // sin
  س: 's',
  ش: 'sh',
  // sad
  ص: 's',
  ض: 'd',
  // tah
  ط: 't',
  ظ: 'z',
  // ain
  ع: 'a',
  غ: 'gh',
  // fa / qaf
  ف: 'f',
  ق: 'q',
  // kaf
  ك: 'k',
  // lam
  ل: 'l',
  // mim / noon
  م: 'm',
  ن: 'n',
  // ha
  ه: 'h',
  // waw
  و: 'w',
  // ya
  ي: 'y',
  ى: 'a',
  ئ: 'i',
  // hamza carriers
  ء: '',
  ؤ: 'u',
  // ta marbuta
  ة: 'a',
  // lam-alef ligatures
  لا: 'la',
  لأ: 'la',
  لإ: 'li',
}

/**
 * Diacritics (harakat), tatweel and Quranic annotation marks carry no phonetic
 * value in a URL, so they are dropped.
 *
 * Written as explicit escapes on purpose: the Arabic *letters* occupy
 * U+0620-U+064A, and the harakat start immediately after at U+064B. A range
 * written as `\u0610-\u064B` would swallow the letters themselves and leave an
 * empty slug.
 */
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

const romanizeArabic = (value: string): string =>
  value
    .replace(ARABIC_DIACRITICS, '')
    // Ligatures and multi-char keys must be handled before single chars.
    .replace(/لا|لأ|لإ/g, (m) => ARABIC_TO_LATIN[m] ?? '')
    .replace(/[؀-ۿ]/g, (char) => ARABIC_TO_LATIN[char] ?? '')

/** Latin combining marks left behind by NFD decomposition (é -> e). */
const COMBINING_MARKS = /[\u0300-\u036F]/g

/**
 * Produces a URL-safe slug: lowercase, ASCII only, words joined by single
 * dashes. Latin input (including already-transliterated text) is unaffected.
 */
export const slugify = (value: string | null | undefined): string => {
  if (!value) return ''

  return romanizeArabic(String(value))
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
