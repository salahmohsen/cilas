// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { findRedirect } from '@/lib/redirects'
import type { User } from '@/payload-types'

import { RUN, createTracker, uniq } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()
const OLD = `/writing-the-self-probe-${RUN}`

describe('redirects and SEO', () => {
  let courseId: number
  let courseSlug: string

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: 'Redirect Place',
          slug: uniq('redirect-place'),
          city: `Redirectville ${RUN}`,
        },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: {
          season: 'spring',
          start_year: 2031,
          place: place.id,
          registration: { method: 'closed' },
        },
        overrideAccess: true,
      }),
    )
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Writing the Self',
          slug: uniq('writing-the-self'),
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'public',
          cycle: cycle.id,
          _status: 'published',
        },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { title: 'نكتب أنفسنا' },
      locale: 'ar',
      overrideAccess: true,
    })
    courseId = course.id
    courseSlug = course.slug
    const r = await payload.create({
      collection: 'redirects',
      data: {
        from: `${OLD}.html`,
        type: '301',
        to: { type: 'reference', reference: { relationTo: 'courses', value: courseId } },
      },
      overrideAccess: true,
    })
    track('redirects', r)
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('resolves an old path, in any of its forms, to the course page', async () => {
    for (const path of [`${OLD}.html`, OLD, `${OLD}/`]) {
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
