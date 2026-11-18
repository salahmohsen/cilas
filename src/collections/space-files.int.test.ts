// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SpaceFiles } from '@/collections/SpaceFiles'
import config from '@/payload.config'
import { FILE_LIMITS, IMAGE_EDGE, SPACE_FILE_LIMIT } from '@/lib/space-file-limits'

/**
 * The space-files collection is the authority on what a space may store
 * (docs/spaces-media-budget.md). These run against the local object store,
 * like the rest of tests/int, and delete what they create.
 */
let payload: Payload
const made: { collection: 'space-files' | 'space-posts' | 'spaces'; id: number }[] = []
let spaceId: number
let postId: number

const photo = async (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
  } as never)
    .withExif({ IFD0: { Make: 'Probe', Model: 'Camera' } })
    .jpeg({ quality: 92 })
    .toBuffer()

const store = async (
  data: Buffer,
  mimetype: string,
  name: string,
  post: number | null = postId,
) => {
  const created = await payload.create({
    collection: 'space-files',
    data: { space: spaceId, post, filename: name } as never,
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  made.push({ collection: 'space-files', id: created.id })
  return created
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const space = await payload.create({
    collection: 'spaces',
    data: { kind: 'community' },
    overrideAccess: true,
  })
  made.push({ collection: 'spaces', id: space.id })
  spaceId = space.id
  const post = await payload.create({
    collection: 'space-posts',
    data: { space: spaceId, kind: 'discussion', body: 'probe-f files' } as never,
    overrideAccess: true,
  })
  made.push({ collection: 'space-posts', id: post.id })
  postId = post.id
})

afterAll(async () => {
  for (const { collection, id } of made.reverse())
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
})

describe('space-files media budget', () => {
  it('stores one upright WebP of at most the edge, with no EXIF, and no other size', async () => {
    const input = await photo(3000, 2000)
    const file = await store(input, 'image/jpeg', 'probe-f-big.jpg')
    expect(file.mimeType).toBe('image/webp')
    expect(file.filename).toMatch(/^[0-9a-f]{32}-probe-f-big\.webp$/)
    expect(Math.max(file.width!, file.height!)).toBe(IMAGE_EDGE)
    expect(file.filesize!).toBeLessThan(input.length)
    expect((file as { sizes?: unknown }).sizes ?? {}).toEqual({})

    const collection = payload.collections['space-files']
    const handler = collection.config.upload.handlers![0]!
    const response = (await handler(await createLocalReq({}, payload), {
      doc: file,
      headers: new Headers(),
      params: { collection: 'space-files', filename: file.filename! },
    })) as Response
    const bytes = Buffer.from(await response.arrayBuffer())
    const meta = await sharp(bytes).metadata()
    expect(bytes.length).toBe(file.filesize)
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
    console.info(`probe: ${input.length} bytes in, ${bytes.length} bytes stored`)
  })

  it('keeps a small photo at its size, as WebP', async () => {
    const file = await store(await photo(600, 400), 'image/jpeg', 'probe-f-small.jpg')
    expect(file.mimeType).toBe('image/webp')
    expect([file.width, file.height]).toEqual([600, 400])
  })

  it('refuses anything that is not a JPEG, PNG or WebP', async () => {
    const pdf = Buffer.from('%PDF-1.4\n')
    await expect(store(pdf, 'application/pdf', 'probe-f.pdf')).rejects.toThrow()
    await expect(store(Buffer.from('GIF89a'), 'image/gif', 'probe-f.gif')).rejects.toThrow()
  })

  it('refuses a file over the input limit before any work', async () => {
    const big = Buffer.alloc(SPACE_FILE_LIMIT + 1)
    await expect(store(big, 'image/jpeg', 'probe-f-huge.jpg')).rejects.toThrow(/too large/)
  })

  it('refuses a new file on a comment', async () => {
    await expect(
      payload.create({
        collection: 'space-files',
        data: { space: spaceId, comment: 1, filename: 'probe-f-comment.jpg' } as never,
        file: { data: await photo(100, 100), mimetype: 'image/jpeg', name: 'c.jpg', size: 1 },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/takes no files/)
  })

  it('refuses a photo beyond the limit on one post', async () => {
    const other = await payload.create({
      collection: 'space-posts',
      data: { space: spaceId, kind: 'discussion', body: 'probe-f limit' } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'space-posts', id: other.id })
    const tiny = await photo(64, 64)
    for (let n = 0; n < FILE_LIMITS.post; n++)
      await store(tiny, 'image/jpeg', `probe-f-n${n}.jpg`, other.id)
    await expect(store(tiny, 'image/jpeg', 'probe-f-over.jpg', other.id)).rejects.toThrow(/at most/)
  })

  it('lets a browser keep a file for good, but only its own', () => {
    const headers = SpaceFiles.upload as {
      modifyResponseHeaders: (a: { headers: Headers }) => Headers
    }
    const out = headers.modifyResponseHeaders({ headers: new Headers() })
    expect(out.get('Cache-Control')).toBe('private, max-age=31536000, immutable')
  })
})
