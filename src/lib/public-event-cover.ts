import { unstable_cache } from 'next/cache'
import { cache } from 'react'

import { prepareCover } from '@/lib/event-cover-image'

const MAX_COVER_BYTES = 8 * 1024 * 1024

export async function readCoverTone(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
    throw new Error('Event cover is unavailable')
  if (Number(response.headers.get('content-length')) > MAX_COVER_BYTES || !response.body)
    throw new Error('Event cover exceeds the image limit')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_COVER_BYTES) throw new Error('Event cover exceeds the image limit')
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
  }
  const cover = await prepareCover(Buffer.concat(chunks), 'cover')
  if (!cover) throw new Error('Event cover is not an image')
  return cover.tone
}

const cachedTone = unstable_cache(readCoverTone, ['public-event-cover-tone'], { revalidate: 86400 })

export const publicEventCoverTone = cache(async (url: string): Promise<string | null> => {
  try {
    return await cachedTone(url)
  } catch {
    return null
  }
})
