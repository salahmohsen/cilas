/** An event cover's colours: the field its details sit on is made from the photo's own colour. */

const HEX = /^#([0-9a-f]{6})$/i

const linear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** OKLCH of an sRGB hex colour (Björn Ottosson's OKLab), or null for anything else. */
export const hexToOklch = (hex: string): { l: number; c: number; h: number } | null => {
  const match = HEX.exec(hex.trim())
  if (!match) return null
  const n = parseInt(match[1]!, 16)
  const r = linear((n >> 16) & 255)
  const g = linear((n >> 8) & 255)
  const b = linear(n & 255)
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675778 * s_
  const c = Math.sqrt(A * A + B * B)
  const h = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c, h: c < 1e-4 ? 0 : (h + 360) % 360 }
}

/**
 * The darkest and lightest the field may be. White text on OKLCH lightness
 * 0.42 measures about 7.4:1 (WCAG), so the details stay readable whatever
 * the photo; 0.22 keeps a black photo from turning the card into a hole.
 */
const FIELD_L = { min: 0.22, max: 0.42 }
/** Enough colour to read as the photo's, not so much that a neon photo glows. */
const FIELD_C = 0.09

const round = (n: number, places = 3) => Number(n.toFixed(places))

/**
 * The colour of the field under a cover, as CSS: the photo's tone kept in
 * hue, darkened into the readable band and calmed in chroma. A missing or
 * broken tone gives a neutral dark field.
 */
export const coverField = (tone: string | null | undefined): string => {
  const lch = tone ? hexToOklch(tone) : null
  if (!lch) return 'oklch(0.3 0 0)'
  const l = Math.min(FIELD_L.max, Math.max(FIELD_L.min, lch.l * 0.6))
  const c = Math.min(FIELD_C, lch.c)
  return `oklch(${round(l)} ${round(c)} ${round(c < 0.005 ? 0 : lch.h, 1)})`
}

/** A cover is stored at most this wide or tall; the card never shows it larger. */
export const COVER_EDGE = 1600
/** The kinds a cover may be: photos only, as the post's own photos. */
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
