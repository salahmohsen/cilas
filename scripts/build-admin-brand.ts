// Writes the admin's static SVG brand files from the CILAS mark in
// src/components/home/home-scene-logo.ts. Run: pnpm exec tsx scripts/build-admin-brand.ts
//
// Why files and not only components: payload-theme draws the sidebar and login
// logo as an <img> from a URL, and `currentColor` does not reach inside an
// <img>, so it needs one file per colour scheme. A browser tab icon is a file too.
import { writeFileSync } from 'node:fs'

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
console.log('wrote admin brand SVGs')
