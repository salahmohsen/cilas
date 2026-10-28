import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { prepareCover } from '@/lib/event-cover-image'
import { publicEventCoverTone, readCoverTone } from '@/lib/public-event-cover'

afterEach(() => vi.unstubAllGlobals())

describe('public event cover colors', () => {
  it('extracts exactly the same photo tone as a Spaces cover', async () => {
    const photo = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#2050c0' },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 100, height: 60, channels: 3, background: '#e0b020' },
          })
            .png()
            .toBuffer(),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(new Uint8Array(photo), { headers: { 'content-type': 'image/png' } }),
        ),
    )
    expect(await readCoverTone('https://images.test/cover.png')).toBe(
      (await prepareCover(photo, 'cover'))?.tone,
    )
  })
  it('falls back when a photo is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await publicEventCoverTone('https://images.test/offline.png')).toBeNull()
  })
  it('rejects non-images and oversized responses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>', { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(
        new Response('image', {
          headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) },
        }),
      )
    vi.stubGlobal('fetch', fetch)
    await expect(readCoverTone('https://images.test/page')).rejects.toThrow('unavailable')
    await expect(readCoverTone('https://images.test/huge.png')).rejects.toThrow('image limit')
  })
})
