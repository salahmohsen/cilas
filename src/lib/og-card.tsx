import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Metadata } from 'next'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'

import { POSTER_COLORS } from '@/components/arc/lib/poster-colors'
import { LOGO, LOGO_VIEWBOX } from '@/components/home/home-scene-logo'
import { env } from '@/env'
import { arabicVisualWord } from '@/lib/arabic-visual'

/**
 * The share card a page's opengraph-image.tsx draws, in the registration
 * poster's look (src/components/home/poster.tsx): ink rules, paper cells and
 * the posters' yellow. One column holds what it is and the title on the
 * yellow; the other holds the page's image (its SEO image, else its cover),
 * or the CILAS boat when it has none. No description: it rarely fits, and
 * Satori cannot be trusted to cut it well. A strip runs along
 * the foot: the mark, the site's address and the action. Arabic mirrors it.
 */

const SIZE = { width: 1200, height: 630 }
const INK = '#121212'
const PAPER = '#ffffff'
const RULE = `2px solid ${INK}`
const PAD = 32
const STRIP = 96
const TEXT_COLUMN = 500
// The label's cell: its line and padding, and the rule under it.
const LABEL = 40 * 1.2 + PAD * 2 + 2
const IMAGE = { width: SIZE.width - TEXT_COLUMN, height: SIZE.height - STRIP }

// Satori (behind ImageResponse) reads TTF, not WOFF2. It shapes Arabic with
// the first font of the family and crashes on the Latin fonts' and Amiri's
// ligature tables, so Arabic text gets IBM Plex Sans Arabic alone (it has
// Latin letters too) and Latin text gets the poster's faces. The files ship
// in public/, which the Docker image copies.
const PUBLIC = join(process.cwd(), 'public')
const font = (file: string) => readFile(join(PUBLIC, 'assets/fonts/og', file))
type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']
let fonts: Promise<Fonts> | null = null
const loadFonts = () =>
  (fonts ??= Promise.all([
    font('playfair-display-400.ttf'),
    font('playfair-display-700.ttf'),
    font('inter-400.ttf'),
    font('inter-500.ttf'),
    font('ibm-plex-sans-arabic-400.ttf'),
    font('ibm-plex-sans-arabic-600.ttf'),
  ]).then(([label, title, text, strong, arabic, arabicStrong]) => [
    { name: 'Label', data: label, weight: 400 as const },
    { name: 'Title', data: title, weight: 700 as const },
    { name: 'Text', data: text, weight: 400 as const },
    { name: 'Strong', data: strong, weight: 500 as const },
    { name: 'Arabic', data: arabic, weight: 400 as const },
    { name: 'ArabicStrong', data: arabicStrong, weight: 600 as const },
  ]))

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const isArabic = (text: string) => ARABIC.test(text)

/** What a route says about its card beyond the page's metadata, in the page's language. */
export type CardWords = {
  /** Above the title: what it is ("Article"). */
  label?: string
  /** The strip's last cell: what the link does ("Read"). */
  action: string
}

/** The page's own title, without the " — CILAS" the tab title carries; the logo says it. */
const titleOf = (metadata: Metadata): string => {
  const { title } = metadata
  const text =
    typeof title === 'string'
      ? title
      : title && 'absolute' in title
        ? title.absolute
        : title && 'default' in title
          ? title.default
          : ''
  return (text ?? '').replace(/\s*[—·|-]\s*CILAS\s*$/u, '').trim()
}

/** The first image the page's metadata names, if any. */
const imageOf = (metadata: Metadata): string | null => {
  const images = metadata.openGraph?.images
  const first = Array.isArray(images) ? images[0] : images
  if (!first) return null
  if (typeof first === 'string') return first
  if (first instanceof URL) return first.href
  return String(first.url)
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
}

/** Every card's colour: the posters' yellow. */
const COLOR = POSTER_COLORS[0]

/**
 * The image, cut to its cell as a JPEG data URL: media are WebP, which Satori
 * does not draw. A site path reads from public/. Null when it cannot be read;
 * the cell then shows the boat.
 */
async function picture(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const source = url.startsWith('/')
      ? await readFile(join(PUBLIC, url))
      : Buffer.from(await (await fetch(url)).arrayBuffer())
    const jpeg = await sharp(source)
      .resize(IMAGE.width, IMAGE.height, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

/** For generateImageMetadata: one card, named for the page. */
export function ogCardImages(metadata: Metadata) {
  const title = titleOf(metadata)
  if (!title) return []
  return [{ id: 'card', alt: title, size: SIZE, contentType: 'image/png' }]
}

/**
 * Satori lays text out left to right only, so each word is its own box and
 * an Arabic line runs right to left (row-reverse). Arabic words go in
 * already joined and in drawing order (arabicVisualWord), as Satori measures
 * the words it shapes itself wrongly. Runs of Latin words inside Arabic text
 * stay together, in their own order.
 */
function Words({
  text,
  latin,
  arabic,
  fontSize,
  lineHeight,
  lines,
}: {
  text: string
  latin: string
  arabic: string
  fontSize: number
  lineHeight: number
  lines: number
}) {
  const rtl = isArabic(text)
  // About how many letters the lines hold, so a longer text ends in "…"
  // rather than at the cell's edge.
  const perLine = Math.floor((TEXT_COLUMN - PAD * 2) / (fontSize * (rtl ? 0.46 : 0.52)))
  const words = clip(text, perLine * lines)
    .split(' ')
    .reduce<string[]>((runs, word) => {
      const last = runs.at(-1)
      if (rtl && last !== undefined && !isArabic(word) && !isArabic(last)) {
        runs[runs.length - 1] = `${last} ${word}`
      } else runs.push(word)
      return runs
    }, [])
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: rtl ? 'row-reverse' : 'row',
        columnGap: Math.round(fontSize * 0.26),
        fontFamily: rtl ? arabic : latin,
        fontSize,
        // Arabic needs the taller line the site gives it.
        lineHeight: rtl ? Math.max(lineHeight, 1.35) : lineHeight,
        // Whole lines only: a longer text stops at the last line that fits.
        maxHeight: Math.floor(fontSize * (rtl ? Math.max(lineHeight, 1.35) : lineHeight) * lines),
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {words.map((word, i) => (
        <span key={i}>{rtl && isArabic(word) ? arabicVisualWord(word) : word}</span>
      ))}
    </div>
  )
}

function Boat({ height, color }: { height: number; color: string }) {
  return (
    <svg
      fill={color}
      fillRule="evenodd"
      height={height}
      viewBox={LOGO_VIEWBOX}
      width={Math.round((height * 63.38) / 109)}
    >
      {LOGO.map((shape) => (
        <path d={shape.d} key={shape.d} />
      ))}
    </svg>
  )
}

/** The card itself, for the image route's default export. */
export async function ogCard(metadata: Metadata, words: CardWords) {
  const title = clip(titleOf(metadata), 100)
  const rtl = isArabic(title)
  const row = rtl ? 'row-reverse' : 'row'
  const leading = rtl ? 'flex-end' : 'flex-start'
  // The rule between two cells, on the side the next one follows.
  const ruleAfter = rtl ? { borderLeft: RULE } : { borderRight: RULE }
  const titleSize = title.length <= 28 ? 72 : title.length <= 60 ? 60 : 48
  const titleLines = Math.floor(
    (IMAGE.height - LABEL - PAD * 2) / (titleSize * (rtl ? 1.35 : 1.08)),
  )
  const [image, cardFonts] = await Promise.all([picture(imageOf(metadata)), loadFonts()])
  const cell = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: leading,
    padding: PAD,
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        color: INK,
      }}
    >
      <div style={{ display: 'flex', flexDirection: row, height: IMAGE.height }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: TEXT_COLUMN,
            ...ruleAfter,
          }}
        >
          {words.label ? (
            <div style={{ ...cell, borderBottom: RULE }}>
              <Words
                arabic="Arabic"
                fontSize={40}
                latin="Label"
                lineHeight={1.2}
                lines={1}
                text={words.label}
              />
            </div>
          ) : null}
          <div style={{ ...cell, flex: 1, background: COLOR }}>
            <Words
              arabic="ArabicStrong"
              fontSize={titleSize}
              latin="Title"
              lineHeight={1.08}
              lines={titleLines}
              text={title}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" height={IMAGE.height} src={image} width={IMAGE.width} />
          ) : (
            <Boat color={INK} height={260} />
          )}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: row,
          height: STRIP,
          borderTop: RULE,
          fontSize: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: STRIP,
            ...ruleAfter,
          }}
        >
          <Boat color={INK} height={60} />
        </div>
        <div
          style={{
            display: 'flex',
            // Ends on the columns' rule, so the action sits under the image.
            width: TEXT_COLUMN - STRIP,
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Text',
            ...ruleAfter,
          }}
        >
          {new URL(env.NEXT_PUBLIC_SERVER_URL).host}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: row,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flex: 1,
            background: COLOR,
            fontFamily: isArabic(words.action) ? 'ArabicStrong' : 'Strong',
          }}
        >
          <span>
            {isArabic(words.action)
              ? words.action.split(' ').map(arabicVisualWord).reverse().join(' ')
              : words.action}
          </span>
          {/* The poster's arrow, pointing the way the line reads. */}
          <svg
            fill="none"
            height={28}
            stroke={INK}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            style={rtl ? { transform: 'scaleX(-1)' } : undefined}
            viewBox="0 0 24 24"
            width={28}
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>,
    { ...SIZE, fonts: cardFonts },
  )
}

/**
 * The two exports an opengraph-image.tsx needs, from the function that
 * builds its page's metadata (with the page's image, if it has one) and the
 * card's words for a locale. Next can pass the params as a promise, so both
 * await them.
 */
export function ogCardRoute<P extends { locale: string }>(
  metadataOf: (params: P) => Promise<Metadata>,
  wordsOf: (locale: string) => CardWords | Promise<CardWords>,
) {
  return {
    generateImageMetadata: async ({ params }: { params: P | Promise<P> }) => {
      const resolved = await params
      // Next also runs this to list the image route's params, outside any
      // request, where next-intl cannot read the locale. The card's id is all
      // that needs, and it never changes.
      const metadata = await metadataOf(resolved).catch(() => ({ title: 'CILAS' }))
      return ogCardImages(metadata)
    },
    Image: async ({ params }: { params: Promise<P> }) => {
      const resolved = await params
      return ogCard(await metadataOf(resolved), await wordsOf(resolved.locale))
    },
  }
}

/** Card words in both languages, for a route that has no translations of them. */
export const cardWords =
  (words: Record<'en' | 'ar', CardWords>) =>
  (locale: string): CardWords =>
    locale === 'ar' ? words.ar : words.en
