import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { SPACE_FILE_LIMIT } from '@/lib/space-file-limits'
import { COVER_EDGE, coverField, hexToOklch } from '@/lib/event-cover'
import { coverIssue, prepareCover } from '@/lib/event-cover-image'

/** WCAG relative luminance of an OKLCH lightness with no chroma. */
const luminance = (l: number) => l ** 3

describe('the field under a cover', () => {
  it('converts sRGB to OKLCH', () => {
    expect(hexToOklch('#ffffff')!.l).toBeCloseTo(1, 3)
    expect(hexToOklch('#000000')!.l).toBeCloseTo(0, 3)
    const red = hexToOklch('#ff0000')!
    expect(red.l).toBeCloseTo(0.628, 2)
    expect(red.h).toBeCloseTo(29.2, 0)
    expect(hexToOklch('red')).toBeNull()
  })

  it('keeps white text readable on any photo', () => {
    for (const tone of ['#ffffff', '#f5e050', '#101010', '#00ff66', '#3060ff', null, 'x']) {
      const [, l] = /oklch\(([\d.]+)/.exec(coverField(tone))!
      const ratio = 1.05 / (luminance(Number(l)) + 0.05)
      expect(ratio).toBeGreaterThanOrEqual(7)
    }
  })

  it('keeps the photo hue and calms its chroma', () => {
    const field = coverField('#3060ff')
    const [, , c, h] = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(field)!.map(Number)
    expect(c).toBeLessThanOrEqual(0.09)
    expect(h).toBeCloseTo(hexToOklch('#3060ff')!.h, 0)
  })
})

describe('the cover upload rule', () => {
  it('takes a photo within the space file limit only', () => {
    expect(coverIssue({ mimetype: 'image/jpeg', size: 1000 }, SPACE_FILE_LIMIT)).toBeNull()
    expect(
      coverIssue({ mimetype: 'image/webp', size: SPACE_FILE_LIMIT + 1 }, SPACE_FILE_LIMIT),
    ).toBe('file-size')
    expect(coverIssue({ mimetype: 'application/pdf', size: 1000 }, SPACE_FILE_LIMIT)).toBe(
      'file-type',
    )
    expect(coverIssue({ mimetype: 'image/gif', size: 1000 }, SPACE_FILE_LIMIT)).toBe('file-type')
  })

  it('stores a big photo as a WebP no larger than the card needs, with its lower tone', async () => {
    const photo = await sharp({
      create: { width: 3000, height: 4000, channels: 3, background: '#2050c0' },
    })
      .jpeg()
      .toBuffer()
    const ready = (await prepareCover(photo, 'portrait.jpg'))!
    const meta = await sharp(ready.data).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width!, meta.height!)).toBe(COVER_EDGE)
    expect(ready.name).toBe('portrait.webp')
    expect(ready.tone).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('refuses a file that is not an image', async () => {
    expect(await prepareCover(Buffer.from('%PDF-1.4'), 'a.jpg')).toBeNull()
  })
})
