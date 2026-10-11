import { Newsreader, Noto_Naskh_Arabic } from 'next/font/google'

/**
 * Reading faces for long-form text (articles). The interface stays in the
 * site's sans; essays are set in a serif, Latin in Newsreader and Arabic in
 * Naskh, which reads better at length than the sans.
 *
 * No generated fallback face: next/font's metric-matched fallback is local
 * Arial, which has Arabic glyphs and would catch Arabic text before Naskh.
 * The stack in styles.css puts Newsreader first; it has no Arabic, so Arabic
 * text falls through to Naskh (Naskh also ships Latin, which must not win).
 */
export const serifLatin = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif-latin',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
  fallback: [],
})

export const serifArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--font-serif-arabic',
  adjustFontFallback: false,
  fallback: [],
})

export const readingFonts = `${serifLatin.variable} ${serifArabic.variable}`
