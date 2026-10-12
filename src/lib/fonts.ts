import { Amiri_Quran, IBM_Plex_Sans_Arabic, Inter, Newsreader } from 'next/font/google'

/**
 * The site's four faces, two roles in two scripts:
 *
 *   titles  Newsreader (Latin)  ·  Amiri Quran (Arabic)
 *   text    Inter (Latin)       ·  IBM Plex Sans Arabic (Arabic)
 *
 * styles.css stacks each role Latin first (`--font-title`, `--font-text`).
 * The Latin faces have no Arabic, so Arabic falls through to its own face.
 * The Arabic faces load only their Arabic subset, so their Latin never wins.
 *
 * No generated fallback faces: next/font's metric-matched fallback is local
 * Arial, which has Arabic glyphs and would catch Arabic text before the
 * Arabic face.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
  fallback: [],
})

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  // Every weight the text uses, so none is synthesised.
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  adjustFontFallback: false,
  fallback: [],
})

// Variable, with optical sizes: large titles take the display cut.
const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
  fallback: [],
})

// One weight only: Arabic titles are set at 400 whatever weight the Latin takes.
const amiriQuran = Amiri_Quran({
  subsets: ['arabic'],
  weight: '400',
  variable: '--font-amiri-quran',
  adjustFontFallback: false,
  fallback: [],
})

/** The faces' variables, set once on the document. */
export const fontVariables = [inter, plexArabic, newsreader, amiriQuran]
  .map((f) => f.variable)
  .join(' ')
