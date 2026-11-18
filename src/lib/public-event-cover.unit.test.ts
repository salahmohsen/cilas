import { http, HttpResponse } from 'msw'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { prepareCover } from '@/lib/event-cover-image'
import { publicEventCoverTone, readCoverTone } from '@/lib/public-event-cover'

import { mockNetwork } from '../../testing/msw-node.test-utils'
import { runInRequest } from '../../testing/next-request.test-utils'

const network = mockNetwork()

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
    network.use(
      http.get(
        'https://images.test/cover.png',
        () => new HttpResponse(new Uint8Array(photo), { headers: { 'content-type': 'image/png' } }),
      ),
    )
    expect(await readCoverTone('https://images.test/cover.png')).toBe(
      (await prepareCover(photo, 'cover'))?.tone,
    )
  })
  it('falls back when a photo is unavailable', async () => {
    network.use(http.get('https://images.test/offline.png', () => HttpResponse.error()))
    const { result } = await runInRequest(() =>
      publicEventCoverTone('https://images.test/offline.png'),
    )
    expect(result).toBeNull()
  })
  it('rejects non-images and oversized responses', async () => {
    network.use(
      http.get('https://images.test/page', () => HttpResponse.html('<html>')),
      http.get(
        'https://images.test/huge.png',
        () =>
          new HttpResponse('image', {
            headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) },
          }),
      ),
    )
    await expect(readCoverTone('https://images.test/page')).rejects.toThrow('unavailable')
    await expect(readCoverTone('https://images.test/huge.png')).rejects.toThrow('image limit')
  })
})
