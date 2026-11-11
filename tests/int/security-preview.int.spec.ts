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
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
vi.mock('@/components/forms/rendered-form', () => ({ RenderedForm: () => null }))

import config from '@/payload.config'
import { getArticleForReading } from '@/api/articles.api'
import { getBridgeYear } from '@/api/programmes.api'
import type { User } from '@/payload-types'
import { GET } from '@/app/(frontend)/api/preview/route'
import FormPreviewPage from '@/app/(frontend)/[locale]/forms/preview/page'

import { uniq } from './fixtures'

const OWNER_SLUG = uniq('security-preview-owner')
const ARTICLE_SLUG = uniq('security-private-preview')
const PROGRAMME_SLUG = uniq('security-private-programme')
const COURSE_SLUG = uniq('security-private-course')
const PUBLIC_SLUG = uniq('security-public-article')

describe('draft preview authorization', () => {
  let payload: Payload
  let person: number
  let article: number
  let publicArticle: number
  let programme: number
  let course: number
  let form: number
  let owner: User
  let stranger: User
  const admin = { id: -1, collection: 'users', roles: ['admin'] } as User

  beforeAll(async () => {
    payload = await getPayload({ config })
    form = (
      await payload.create({
        collection: 'forms',
        data: {
          title: 'Preview template',
          template: true,
          fields: [],
          confirmationMessage: {
            root: {
              type: 'root',
              version: 1,
              direction: 'ltr',
              format: '',
              indent: 0,
              children: [
                {
                  type: 'paragraph',
                  version: 1,
                  children: [{ type: 'text', version: 1, text: 'Received' }],
                },
              ],
            },
          },
        },
      })
    ).id
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
    publicArticle = (
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Public article',
          slug: PUBLIC_SLUG,
          authors: [person],
          tier: 'public',
          review: { status: 'approved' },
          _status: 'published',
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
    if (form) await payload.delete({ collection: 'forms', id: form })
    if (course) await payload.delete({ collection: 'courses', id: course })
    if (programme) await payload.delete({ collection: 'programmes', id: programme })
    if (article) await payload.delete({ collection: 'articles', id: article })
    if (publicArticle) await payload.delete({ collection: 'articles', id: publicArticle })
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

  it('reads a published article as published when the draft cookie outlives the preview', async () => {
    for (const user of [null, stranger]) {
      const reading = await getArticleForReading(payload, PUBLIC_SLUG, {
        locale: 'en',
        preview: true,
        user,
      })
      expect(reading?.article.id).toBe(publicArticle)
      expect(reading?.draft).toBe(false)
    }
    const own = await getArticleForReading(payload, PUBLIC_SLUG, {
      locale: 'en',
      preview: true,
      user: owner,
    })
    expect(own?.draft).toBe(true)
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

  it.each([null, 'member', 'fellow'])('refuses form previews for %s', async (role) => {
    vi.spyOn(payload, 'auth').mockResolvedValue({
      user: role ? { ...owner, roles: [role] } : null,
    } as Awaited<ReturnType<Payload['auth']>>)
    const response = await GET(
      new Request(`http://localhost/api/preview?collection=forms&id=${form}`),
    )
    expect(response.status).toBe(403)
    expect(enable).not.toHaveBeenCalled()
    await expect(
      FormPreviewPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ form: String(form) }),
      }),
    ).rejects.toThrow('notFound')
  })

  it.each(['en', 'ar'])('opens the form template preview in %s for an admin', async (locale) => {
    vi.spyOn(payload, 'auth').mockResolvedValue({ user: admin } as Awaited<
      ReturnType<Payload['auth']>
    >)
    await expect(
      GET(new Request(`http://localhost/api/preview?collection=forms&id=${form}&locale=${locale}`)),
    ).rejects.toThrow(`redirect:/${locale}/forms/preview?form=${form}`)
  })
})
