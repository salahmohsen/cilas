// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

describe('public media uploads', () => {
  let payload: Payload
  const created: number[] = []
  const user = { id: -1, collection: 'users', roles: ['member'] } as User
  const upload = async (name: string, mimetype: string, data: Buffer) => {
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Security upload probe' },
      file: { name, mimetype, data, size: data.length },
      user,
      overrideAccess: false,
    })
    created.push(media.id)
    return media
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
  })
  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'media', id })
    await payload?.destroy()
  })

  it.each([
    ['probe.html', 'text/html', '<script>alert(document.domain)</script>'],
    [
      'probe.svg',
      'image/svg+xml',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"/>',
    ],
  ])('refuses active content in %s', async (name, mimetype, body) => {
    await expect(upload(name, mimetype, Buffer.from(body))).rejects.toThrow()
  })

  it.each([
    ['pixel.png', 'image/png'],
    ['tiny.pdf', 'application/pdf'],
  ])('preserves supported uploads of %s', async (name, mimetype) => {
    const data = await readFile(new URL(`../fixtures/${name}`, import.meta.url))
    expect((await upload(name, mimetype, data)).id).toBeGreaterThan(0)
  })
})
