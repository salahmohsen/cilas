// Writes the PNGs the emails use (mail clients do not show SVG or WebP):
// the sail logo and one icon per social platform in Site settings.
// Run: node scripts/email-assets.mjs
import sharp from 'sharp'
import { siFacebook, siInstagram, siX, siYoutube } from 'simple-icons'

const out = new URL('../public/assets/email/', import.meta.url)
const GRAY = '#7B7D81' // colors.fg3 in src/emails/theme.ts

await sharp(new URL('../public/assets/images/logo.webp', import.meta.url).pathname)
  .resize({ height: 96 })
  .png()
  .toFile(new URL('logo.png', out).pathname)

const icons = { facebook: siFacebook, twitter: siX, youtube: siYoutube, instagram: siInstagram }
for (const [platform, icon] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path fill="${GRAY}" d="${icon.path}"/></svg>`
  await sharp(Buffer.from(svg))
    .png()
    .toFile(new URL(`${platform}.png`, out).pathname)
}
console.log('email assets written')
