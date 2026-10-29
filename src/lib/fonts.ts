import { Amiri, IBM_Plex_Sans_Arabic, Inter, Playfair_Display } from 'next/font/google'

/**
 * The site's four faces, two roles in two scripts:
 *
 *   titles  Playfair Display (Latin)  ·  Amiri (Arabic)
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

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
  fallback: [],
})

// One weight only: Arabic titles are set at 400 whatever weight the Latin takes.
const amiri = Amiri({
  subsets: ['arabic'],
  weight: '400',
  variable: '--font-amiri',
  adjustFontFallback: false,
  fallback: [],
})

/** The faces' variables, set once on the document. */
export const fontVariables = [inter, plexArabic, playfairDisplay, amiri]
  .map((f) => f.variable)
  .join(' ')
