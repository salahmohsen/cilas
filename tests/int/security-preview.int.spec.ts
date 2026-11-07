// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const { enable } = vi.hoisted(() => ({ enable: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  draftMode: async () => ({ enable }),
}))
vi.mock('next/headers.js', () => ({
  headers: async () => new Headers(),
  draftMode: async () => ({ enable }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))

import config from '@/payload.config'
import { getArticleForReading } from '@/api/articles.api'
import { getBridgeYear } from '@/api/programmes.api'
import type { User } from '@/payload-types'
import { GET } from '@/app/(frontend)/api/preview/route'

import { uniq } from './fixtures'

const OWNER_SLUG = uniq('security-preview-owner')
const ARTICLE_SLUG = uniq('security-private-preview')
const PROGRAMME_SLUG = uniq('security-private-programme')
const COURSE_SLUG = uniq('security-private-course')

describe('draft preview authorization', () => {
  let payload: Payload
  let person: number
  let article: number
  let programme: number
  let course: number
  let owner: User
  let stranger: User
  const admin = { id: -1, collection: 'users', roles: ['admin'] } as User

  beforeAll(async () => {
    payload = await getPayload({ config })
    person = (
      await payload.create({
        collection: 'people',
        data: { name: 'Preview owner', slug: OWNER_SLUG },
      })
    ).id
    owner = { id: -2, collection: 'users', roles: ['member'], person } as User
    stranger = { id: -3, collection: 'users', roles: ['member'], person: -3 } as User
    article = (
      await payload.create({
        collection: 'articles',
        draft: true,
        data: {
          title: 'Private preview',
          slug: ARTICLE_SLUG,
          authors: [person],
          tier: 'owner',
        },
      })
    ).id
    programme = (
      await payload.create({
        collection: 'programmes',
        draft: true,
        data: {
          title: 'Private programme',
          slug: PROGRAMME_SLUG,
          kind: 'bridge',
        },
      })
    ).id
    course = (
      await payload.create({
        collection: 'courses',
        draft: true,
        data: {
          title: 'Private course',
          slug: COURSE_SLUG,
          course_type: 'CORE',
          fellows: [person],
          tier: 'owner',
        },
      })
    ).id
  })

  afterEach(() => {
    vi.restoreAllMocks()
    enable.mockClear()
  })

  afterAll(async () => {
    if (course) await payload.delete({ collection: 'courses', id: course })
    if (programme) await payload.delete({ collection: 'programmes', id: programme })
    if (article) await payload.delete({ collection: 'articles', id: article })
    if (person) await payload.delete({ collection: 'people', id: person })
    await payload?.destroy()
  })

  it('does not treat the preview flag as authority after logout', async () => {
    expect(
      await getArticleForReading(payload, ARTICLE_SLUG, {
        locale: 'en',
        preview: true,
      }),
    ).toBeUndefined()
  })

  it("does not let an author preview someone else's draft", async () => {
    expect(
      await getArticleForReading(payload, ARTICLE_SLUG, {
        locale: 'en',
        preview: true,
        user: stranger,
      }),
    ).toBeUndefined()
  })

  it('lets the owner and admin preview the draft', async () => {
    for (const user of [owner, admin]) {
      expect(
        (
          await getArticleForReading(payload, ARTICLE_SLUG, {
            locale: 'en',
            preview: true,
            user,
          })
        )?.article.id,
      ).toBe(article)
    }
  })

  it('refuses anonymous programme previews', async () => {
    expect(await getBridgeYear(payload, 'en', { slug: PROGRAMME_SLUG, draft: true })).toBeNull()
  })

  it('restricts programme previews to administrators', async () => {
    expect(
      await getBridgeYear(payload, 'en', {
        slug: PROGRAMME_SLUG,
        draft: true,
        user: owner,
      }),
    ).toBeNull()
    expect(
      (
        await getBridgeYear(payload, 'en', {
          slug: PROGRAMME_SLUG,
          draft: true,
          user: admin,
        })
      )?.programme.id,
    ).toBe(programme)
  })

  it.each([
    ['articles', ARTICLE_SLUG, 'member'],
    ['courses', COURSE_SLUG, 'fellow'],
  ])(
    'applies the %s ownership filter before enabling draft mode',
    async (collection, slug, role) => {
      vi.spyOn(payload, 'auth').mockResolvedValue({
        user: { ...stranger, roles: [role] },
      } as Awaited<ReturnType<Payload['auth']>>)
      const response = await GET(
        new Request(`http://localhost/api/preview?collection=${collection}&slug=${slug}`),
      )
      expect(response.status).toBe(404)
      expect(enable).not.toHaveBeenCalled()
    },
  )

  it('lets the course owner enable a preview', async () => {
    vi.spyOn(payload, 'auth').mockResolvedValue({
      user: { ...owner, roles: ['fellow'] },
    } as Awaited<ReturnType<Payload['auth']>>)
    await expect(
      GET(new Request(`http://localhost/api/preview?collection=courses&slug=${COURSE_SLUG}`)),
    ).rejects.toThrow(`redirect:/en/study/${COURSE_SLUG}`)
    expect(enable).toHaveBeenCalledOnce()
  })
})
