// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { findRedirect } from '@/lib/redirects'
import type { User } from '@/payload-types'

let payload: Payload
const created: Array<{ collection: 'redirects' | 'courses'; id: number }> = []

describe('redirects and SEO', () => {
  let courseId: number
  let courseSlug: string

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const { docs } = await payload.find({
      collection: 'courses',
      where: { title: { equals: 'Writing the Self' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      draft: true,
    })
    courseId = docs[0].id
    courseSlug = docs[0].slug
    const r = await payload.create({
      collection: 'redirects',
      data: {
        from: '/writing-the-self-probe.html',
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'courses', value: courseId } },
      },
      overrideAccess: true,
    })
    created.push({ collection: 'redirects', id: r.id })
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('resolves an old path, in any of its forms, to the course page', async () => {
    for (const path of [
      '/writing-the-self-probe.html',
      '/writing-the-self-probe',
      '/writing-the-self-probe/',
    ]) {
      expect(await findRedirect(payload, path)).toEqual({
        url: `/study/${courseSlug}`,
        permanent: true,
      })
    }
  })

  it('finds nothing for an unknown path', async () => {
    expect(await findRedirect(payload, '/no-such-page.html')).toBeNull()
  })

  it('refuses a redirect from a non-admin', async () => {
    const member = { id: -1, roles: ['member'] } as unknown as User
    await expect(
      payload.create({
        collection: 'redirects',
        data: {
          from: '/hijack.html',
          type: '301',
          to: { type: 'custom', url: 'https://example.org' },
        },
        user: member,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('keeps SEO fields per locale', async () => {
    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { meta: { title: 'Writing the Self · CILAS' } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { meta: { title: 'نكتب أنفسنا · سيلاس' } },
      locale: 'ar',
      overrideAccess: true,
    })
    const course = (await payload.findByID({
      collection: 'courses',
      id: courseId,
      locale: 'all',
      overrideAccess: true,
      draft: true,
    })) as unknown as { meta: { title: { en: string; ar: string } } }
    expect(course.meta.title).toEqual({ en: 'Writing the Self · CILAS', ar: 'نكتب أنفسنا · سيلاس' })
  })
})
