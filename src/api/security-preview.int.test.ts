import { draftMode } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { getArticleForReading } from '@/api/articles.api'
import { getBridgeYear } from '@/api/programmes.api'
import type { User } from '@/payload-types'
import { GET } from '@/app/(frontend)/api/preview/route'
import FormPreviewPage from '@/app/(frontend)/[locale]/(site)/forms/preview/page'

import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { navigationOutcome } from '../../testing/redirect.test-utils'
import { signedInHeaders } from '../../testing/reader.test-utils'

const OWNER_SLUG = uniq('security-preview-owner')
const ARTICLE_SLUG = uniq('security-private-preview')
const PROGRAMME_SLUG = uniq('security-private-programme')
const COURSE_SLUG = uniq('security-private-course')
const PUBLIC_SLUG = uniq('security-public-article')

describe('draft preview authorization', () => {
  let payload: Payload
  let person: number
  let fellowPerson: number
  let article: number
  let publicArticle: number
  let programme: number
  let course: number
  let form: number
  let owner: Account
  let stranger: Account
  let ownerFellow: Account
  let strangerFellow: Account
  let admin: Account
  const userIds: number[] = []
  const peopleIds: number[] = []
  const { track, cleanup } = createTracker()

  type Account = { user: User; email: string; password: string }

  const account = async (key: string, roles: User['roles'], withPerson: number | null) => {
    const password = crypto.randomUUID()
    const email = uniqEmail(`security-preview-${key}`)
    const created = await payload.create({
      collection: 'users',
      data: { email, password, roles, ...(withPerson ? { person: withPerson } : {}) },
      overrideAccess: true,
    })
    userIds.push(created.id)
    return { user: { ...created, collection: 'users' } as User, email, password }
  }

  const strangerPerson = async (key: string) => {
    const created = await payload.create({
      collection: 'people',
      data: { name: `Preview ${key}`, slug: uniq(`security-preview-${key}`) },
      overrideAccess: true,
    })
    peopleIds.push(created.id)
    return created.id
  }

  const preview = async (query: string, who: Account | null) => {
    const headers = who ? await signedInHeaders(payload, who) : {}
    const { result } = await runInRequest(
      async () => ({
        outcome: await navigationOutcome(() =>
          GET(new Request(`http://localhost/api/preview?${query}`)),
        ),
        enabled: (await draftMode()).isEnabled,
      }),
      { headers },
    )
    return result
  }

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
    owner = await account('owner', ['member'], person)
    fellowPerson = await strangerPerson('owner-fellow')
    ownerFellow = await account('owner-fellow', ['fellow'], fellowPerson)
    stranger = await account('stranger', ['member'], await strangerPerson('stranger'))
    strangerFellow = await account(
      'stranger-fellow',
      ['fellow'],
      await strangerPerson('stranger-fellow'),
    )
    admin = await account('admin', ['admin'], null)
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
    track('articles', article)
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
    track('articles', publicArticle)
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
          fellows: [fellowPerson],
          tier: 'owner',
        },
      })
    ).id
    track('courses', course)
  })

  afterAll(async () => {
    if (form) await payload.delete({ collection: 'forms', id: form })
    if (programme) await payload.delete({ collection: 'programmes', id: programme })
    if (payload) await cleanup(payload)
    for (const id of userIds) await payload.delete({ collection: 'users', id })
    for (const id of peopleIds) await payload.delete({ collection: 'people', id })
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
        user: stranger.user,
      }),
    ).toBeUndefined()
  })

  it('lets the owner and admin preview the draft', async () => {
    for (const user of [owner.user, admin.user]) {
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
    for (const user of [null, stranger.user]) {
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
      user: owner.user,
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
        user: owner.user,
      }),
    ).toBeNull()
    expect(
      (
        await getBridgeYear(payload, 'en', {
          slug: PROGRAMME_SLUG,
          draft: true,
          user: admin.user,
        })
      )?.programme.id,
    ).toBe(programme)
  })

  it.each([
    ['articles', ARTICLE_SLUG, () => stranger],
    ['courses', COURSE_SLUG, () => strangerFellow],
  ])(
    'applies the %s ownership filter before enabling draft mode',
    async (collection, slug, who) => {
      const { outcome, enabled } = await preview(`collection=${collection}&slug=${slug}`, who())
      expect(outcome.returned?.status).toBe(404)
      expect(enabled).toBe(false)
    },
  )

  it('lets the course owner enable a preview', async () => {
    const { outcome, enabled } = await preview(
      `collection=courses&slug=${COURSE_SLUG}`,
      ownerFellow,
    )
    expect(outcome).toEqual({ redirect: `/en/study/${COURSE_SLUG}` })
    expect(enabled).toBe(true)
  })

  it.each([
    ['anonymous', () => null],
    ['a member', () => owner],
    ['a fellow', () => ownerFellow],
  ])('refuses form previews for %s', async (_who, who) => {
    const { outcome, enabled } = await preview(`collection=forms&id=${form}`, who())
    expect(outcome.returned?.status).toBe(403)
    expect(enabled).toBe(false)
    const headers = who() ? await signedInHeaders(payload, who()!) : {}
    const { result } = await runInRequest(
      () =>
        navigationOutcome(() =>
          FormPreviewPage({
            params: Promise.resolve({ locale: 'en' }),
            searchParams: Promise.resolve({ form: String(form) }),
          }),
        ),
      { headers },
    )
    expect(result).toEqual({ notFound: true })
  })

  it.each(['en', 'ar'])('opens the form template preview in %s for an admin', async (locale) => {
    const { outcome } = await preview(`collection=forms&id=${form}&locale=${locale}`, admin)
    expect(outcome).toEqual({ redirect: `/${locale}/forms/preview?form=${form}` })
  })
})
