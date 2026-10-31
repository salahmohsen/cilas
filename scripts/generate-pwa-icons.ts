/**
 * Writes the installable-app icons from the CILAS mark, the same path data
 * the site header draws (src/components/home/home-scene-logo.ts). The mark is
 * white on the brand dark, like the favicon. Run after the mark changes:
 *
 *   node_modules/.bin/tsx scripts/generate-pwa-icons.ts
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { LOGO, LOGO_VIEWBOX } from '../src/components/home/home-scene-logo'

const OUT = fileURLToPath(new URL('../public/assets/icons/', import.meta.url))
const BRAND = '#18181b'

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}"><g fill="#ffffff" fill-rule="evenodd">${LOGO.map((shape) => `<path d="${shape.d}"/>`).join('')}</g></svg>`

/** The mark rasterised sharp at the target height; the width follows its proportions. */
const mark = (height: number) =>
  sharp(Buffer.from(markSvg), { density: 600 }).resize({ height }).png().toBuffer()

/**
 * A square on the brand colour with the mark centred. `markRatio` is the
 * mark's height as a share of the square: a maskable icon keeps the mark
 * inside the central safe zone, and Apple's icon has no transparency.
 */
async function writeIcon(file: string, size: number, markRatio: number) {
  const logo = await mark(Math.round(size * markRatio))
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(OUT, file))
  console.log(`wrote ${file} (${size}x${size}, mark ${markRatio})`)
}

await mkdir(OUT, { recursive: true })
await writeIcon('icon-192.png', 192, 0.6)
await writeIcon('icon-512.png', 512, 0.6)
await writeIcon('icon-maskable-512.png', 512, 0.5)
await writeIcon('apple-touch-icon.png', 180, 0.6)
