import { readFile } from 'node:fs/promises'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { RUN } from '../testing/payload.fixture'

describe('public media uploads', () => {
  let payload: Payload
  const created: number[] = []
  const admin = { id: -1, collection: 'users', roles: ['admin'] } as User
  const member = { id: -2, collection: 'users', roles: ['member'] } as User
  const upload = async (user: User, name: string, mimetype: string, data: Buffer) => {
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Security upload probe' },
      file: { name: name.replace(/(\.[^.]+)$/, `-${RUN}$1`), mimetype, data, size: data.length },
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
  ])('refuses active content in %s, even from an admin', async (name, mimetype, body) => {
    await expect(upload(admin, name, mimetype, Buffer.from(body))).rejects.toThrow()
  })

  it.each([
    [admin, 'pixel.png', 'image/png'],
    [admin, 'tiny.pdf', 'application/pdf'],
    [member, 'pixel.png', 'image/png'],
  ])('preserves supported uploads (%#: %s)', async (user, name, mimetype) => {
    const data = await readFile(new URL(`../testing/files/${name}`, import.meta.url))
    expect((await upload(user, name, mimetype, data)).id).toBeGreaterThan(0)
  })
})
