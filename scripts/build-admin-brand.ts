// Writes the admin's static SVG brand files from the CILAS mark in
// src/components/home/home-scene-logo.ts. Run: pnpm exec tsx scripts/build-admin-brand.ts
//
// Why files and not only components: payload-theme draws the sidebar and login
// logo as an <img> from a URL, and `currentColor` does not reach inside an
// <img>, so it needs one file per colour scheme. A browser tab icon is a file too.
import { readFileSync, writeFileSync } from 'node:fs'

import opentype from 'opentype.js'

import messages from '../messages/en.json' with { type: 'json' }
import { LOGO, LOGO_VIEWBOX } from '../src/components/home/home-scene-logo'

const paths = LOGO.map((shape) => `<path d="${shape.d}"/>`).join('')
const svg = (fill: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" fill="${fill}" fill-rule="evenodd">${extra}${paths}</svg>\n`

const out = (path: string, body: string) =>
  writeFileSync(new URL(`../${path}`, import.meta.url), body)

out('public/assets/admin/cilas-mark-light.svg', svg('#18181b'))
out('public/assets/admin/cilas-mark-dark.svg', svg('#fafafa'))
// The favicon follows the browser's colour scheme.
out(
  'public/assets/icons/favicon.svg',
  svg('#18181b', '<style>@media (prefers-color-scheme: dark){svg{fill:#fafafa}}</style>'),
)

// The sidebar wordmark: the mark and the site header's two-line name, as on
// the public site (src/components/site-header.tsx). The name is drawn as
// paths in Inter, the site's font: an <img> cannot load a web font.
const FONT_SIZE = 16
const LINE_HEIGHT = FONT_SIZE * 1.15
const MARK_HEIGHT = 32
const GAP = 8
const font = opentype.parse(
  readFileSync(new URL('../public/assets/fonts/og/inter-400.ttf', import.meta.url)).buffer,
)
const [, , markW, markH] = LOGO_VIEWBOX.split(' ').map(Number) as [number, number, number, number]
const markScale = MARK_HEIGHT / markH
const lines = messages.Header.brand.split('\n')
const height = Math.max(MARK_HEIGHT, lines.length * LINE_HEIGHT)
const textX = markW * markScale + GAP
// Each line's em box is centred in its line, as CSS places it.
const unit = FONT_SIZE / font.unitsPerEm
const toBaseline = ((font.ascender + font.descender) / 2) * unit
const textTop = (height - lines.length * LINE_HEIGHT) / 2
const text = lines
  .map((line, i) =>
    font
      .getPath(line, textX, textTop + i * LINE_HEIGHT + LINE_HEIGHT / 2 + toBaseline, FONT_SIZE)
      .toPathData(2),
  )
  .join('')
const width = Math.ceil(textX + Math.max(...lines.map((l) => font.getAdvanceWidth(l, FONT_SIZE))))
const wordmark = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height.toFixed(2)}" fill="${fill}" role="img" aria-label="${lines.join(' ')}">` +
  `<g transform="translate(0 ${((height - MARK_HEIGHT) / 2).toFixed(2)}) scale(${markScale.toFixed(5)})" fill-rule="evenodd">${paths}</g>` +
  `<path d="${text}"/></svg>\n`
out('public/assets/admin/cilas-wordmark-light.svg', wordmark('#18181b'))
out('public/assets/admin/cilas-wordmark-dark.svg', wordmark('#fafafa'))

console.log('wrote admin brand SVGs')
