import { loadFont as loadAmiri } from '@remotion/google-fonts/Amiri'
import { loadFont as loadPlexArabic } from '@remotion/google-fonts/IBMPlexSansArabic'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import markOnDark from '../../public/assets/admin/cilas-mark-dark.svg'
import markOnLight from '../../public/assets/admin/cilas-mark-light.svg'
import wordmarkOnDark from '../../public/assets/admin/cilas-wordmark-dark.svg'
import wordmarkOnLight from '../../public/assets/admin/cilas-wordmark-light.svg'
import logoOnDark from '../../docs/assets/cilas-logo-white-on-dark.svg'

// The site's two roles in two scripts, stacked Latin first (src/lib/fonts.ts).
const inter = loadInter('normal', { weights: ['400', '500'], subsets: ['latin'] })
const plexArabic = loadPlexArabic('normal', { weights: ['400', '500'], subsets: ['arabic'] })
const playfair = loadPlayfair('normal', { weights: ['400', '500'], subsets: ['latin'] })
const amiri = loadAmiri('normal', { weights: ['400'], subsets: ['arabic'] })

export const fonts = {
  text: `${inter.fontFamily}, ${plexArabic.fontFamily}, system-ui, sans-serif`,
  title: `${playfair.fontFamily}, ${amiri.fontFamily}, Georgia, serif`,
}

export type Theme = 'light' | 'dark'

// The site's tokens (src/app/(frontend)/styles.css), as sRGB.
export const themes = {
  light: {
    stage: '#f4f4f5',
    surface: '#ffffff',
    ink: '#09090b',
    muted: '#71717a',
    border: '#e4e4e7',
    mark: markOnLight,
    wordmark: wordmarkOnLight,
  },
  dark: {
    stage: '#000000',
    surface: '#09090b',
    ink: '#fafafa',
    muted: '#a1a1aa',
    border: 'rgba(255, 255, 255, 0.1)',
    mark: markOnDark,
    wordmark: wordmarkOnDark,
  },
} satisfies Record<Theme, Record<string, string>>

export const logo = logoOnDark
