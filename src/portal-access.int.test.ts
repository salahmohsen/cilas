import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

import { RUN, createTracker, uniq, uniqEmail, uniqPath } from '../testing/payload.fixture'

type Role = 'fellow' | 'member'
type Owned = 'articles' | 'courses' | 'publications'

let payload: Payload
const { track, cleanup } = createTracker()
const accounts = {} as Record<Role | 'admin', User>
const people = {} as Record<Role | 'student', number>
let cycleId: number
let taughtCourse: number
let otherCourse: number

let serial = 0
const fresh = (base: string) => uniq(`${base}-${(serial += 1)}`)

const actingAs = (user?: User) => ({ overrideAccess: false as const, ...(user ? { user } : {}) })

const at = (doc: object, path: string) =>
  path
    .split('.')
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | null)?.[key], doc)

const nest = (path: string, value: unknown) =>
  path.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<
    string,
    unknown
  >

const stored = (collection: Owned, id: number) =>
  payload.findByID({ collection, id, draft: true, depth: 0, overrideAccess: true })

const ownDraft = async (collection: Owned, user: User, data: Record<string, unknown> = {}) =>
  track(
    collection,
    await payload.create({
      collection,
      data: { title: fresh(`Portal ${collection}`), ...data } as never,
      draft: true,
      ...actingAs(user),
    }),
  )

const makePerson = async (name: string) =>
  track(
    'people',
    await payload.create({ collection: 'people', data: { name: uniq(name), slug: uniq(name) } }),
  ).id

const makeAccount = async (roles: User['roles'], person?: number) =>
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(`portal-${roles.join('-')}`),
        password: crypto.randomUUID(),
        roles,
        ...(person ? { person } : {}),
      },
    }),
  )

const lexical = (text: string) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      },
    ],
  },
})

const OWNERS: [Owned, Role][] = [
  ['articles', 'fellow'],
  ['articles', 'member'],
  ['publications', 'fellow'],
  ['publications', 'member'],
  ['courses', 'fellow'],
]

const DROPPED: { collection: Owned; roles: Role[]; field: string; value: () => unknown }[] = [
  { collection: 'articles', roles: ['fellow', 'member'], field: 'tier', value: () => 'public' },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'published_date',
    value: () => '2030-01-01T00:00:00.000Z',
  },
  { collection: 'articles', roles: ['fellow', 'member'], field: 'featured', value: () => true },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-article')}`,
  },
  {
    collection: 'publications',
    roles: ['fellow', 'member'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'publications',
    roles: ['fellow', 'member'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-publication')}`,
  },
  { collection: 'courses', roles: ['fellow'], field: 'tier', value: () => 'public' },
  { collection: 'courses', roles: ['fellow'], field: 'cycle', value: () => cycleId },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'registration',
    value: () => ({ mode: 'closed' }),
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'pricing_override',
    value: () => ({ options: [{ amount: 100, default: true }] }),
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-course')}`,
  },
]

const DROPPED_CASES = DROPPED.flatMap((row) => row.roles.map((role) => ({ ...row, role })))

describe('portal access, phase 0', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    people.fellow = await makePerson('portal-fellow')
    people.member = await makePerson('portal-member')
    people.student = await makePerson('portal-student')
    accounts.admin = await makeAccount(['admin'])
    accounts.fellow = await makeAccount(['fellow', 'member'], people.fellow)
    accounts.member = await makeAccount(['member'], people.member)
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: uniq('Portal place'), slug: uniq('portal-place'), city: uniq('Portal city') },
      }),
    )
    cycleId = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2089, place: place.id },
      }),
    ).id
    taughtCourse = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: uniq('Taught course'), course_type: 'THEMATIC', fellows: [people.fellow] },
        draft: true,
      }),
    ).id
    otherCourse = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: uniq('Other course'), course_type: 'THEMATIC' },
        draft: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  describe('owned drafts', () => {
    it.each(DROPPED_CASES)(
      '$collection as $role: a write to $field is dropped',
      async ({ collection, role, field, value }) => {
        const user = accounts[role]
        const doc = await ownDraft(collection, user)
        const before = at(await stored(collection, doc.id), field)
        const title = fresh('Retitled')
        await payload.update({
          collection,
          id: doc.id,
          data: { title, ...nest(field, value()) } as never,
          draft: true,
          ...actingAs(user),
        })
        const after = await stored(collection, doc.id)
        expect(after.title).toBe(title)
        expect(at(after, field)).toEqual(before)
      },
    )

    it.each(DROPPED_CASES)(
      '$collection as $role: $field given on create is dropped',
      async ({ collection, role, field, value }) => {
        const user = accounts[role]
        const plain = await stored(collection, (await ownDraft(collection, user)).id)
        const given = await stored(
          collection,
          (await ownDraft(collection, user, nest(field, value()))).id,
        )
        expect(at(given, field)).toEqual(at(plain, field))
      },
    )

    it.each(OWNERS)(
      '%s as %s: a create takes the slug from the title and drops a hand-written slug',
      async (collection, role) => {
        const doc = await ownDraft(collection, accounts[role], {
          title: `Slug Probe ${collection} ${role} ${RUN}`,
          slug: fresh('hand-written'),
        })
        expect((await stored(collection, doc.id)).slug).toBe(
          `slug-probe-${collection}-${role}-${RUN}`,
        )
      },
    )

    it.each(['articles', 'courses', 'publications'] as const)(
      'admin: %s keeps a hand-written slug and legacy_url',
      async (collection) => {
        const slug = uniq(`admin-${collection}`)
        const legacy = uniqPath(`admin-${collection}`)
        const doc = await ownDraft(collection, accounts.admin, { slug, legacy_url: legacy })
        const after = await stored(collection, doc.id)
        expect(after.slug).toBe(slug)
        expect(after.legacy_url).toBe(legacy)
      },
    )

    it.each([
      ['articles', 'fellow'],
      ['articles', 'member'],
      ['courses', 'fellow'],
    ] as [Owned, Role][])(
      '%s as %s: a publish throws Forbidden and the document stays a draft',
      async (collection, role) => {
        const user = accounts[role]
        const doc = await ownDraft(collection, user)
        await expect(
          payload.update({
            collection,
            id: doc.id,
            data: { _status: 'published' } as never,
            ...actingAs(user),
          }),
        ).rejects.toThrow(Forbidden)
        expect((await stored(collection, doc.id))._status).toBe('draft')
      },
    )
  })

  describe('slug follows the title until the first publish', () => {
    const retitle = (collection: Owned, id: number, user: User, data: Record<string, unknown>) =>
      payload.update({ collection, id, data: data as never, draft: true, ...actingAs(user) })

    const arabicDraft = async (title: string) =>
      track(
        'articles',
        await payload.create({
          collection: 'articles',
          locale: 'ar',
          data: { title } as never,
          draft: true,
          ...actingAs(accounts.member),
        }),
      )

    it.each(['articles', 'publications'] as const)(
      '%s as member: a draft slug follows each title change',
      async (collection) => {
        const doc = await ownDraft(collection, accounts.member, {
          title: `First ${collection} ${RUN}`,
        })
        expect((await stored(collection, doc.id)).slug).toBe(`first-${collection}-${RUN}`)
        await retitle(collection, doc.id, accounts.member, { title: `Second ${collection} ${RUN}` })
        expect((await stored(collection, doc.id)).slug).toBe(`second-${collection}-${RUN}`)
      },
    )

    it.each(['articles', 'publications'] as const)(
      '%s as member: a hand-written slug on update is dropped',
      async (collection) => {
        const doc = await ownDraft(collection, accounts.member, {
          title: `Hand ${collection} ${RUN}`,
        })
        await retitle(collection, doc.id, accounts.member, { slug: fresh('claimed') })
        expect((await stored(collection, doc.id)).slug).toBe(`hand-${collection}-${RUN}`)
      },
    )

    it.each(['articles', 'publications'] as const)(
      '%s: a slug an admin sets stays when the owner retitles',
      async (collection) => {
        const doc = await ownDraft(collection, accounts.member)
        const chosen = fresh(`chosen-${collection}`)
        await retitle(collection, doc.id, accounts.admin, { slug: chosen })
        await retitle(collection, doc.id, accounts.member, { title: fresh('Owner title') })
        expect((await stored(collection, doc.id)).slug).toBe(chosen)
      },
    )

    it('articles: after the first publish, a title change keeps the slug', async () => {
      const doc = await ownDraft('articles', accounts.member, { title: `Before ${RUN}` })
      await retitle('articles', doc.id, accounts.member, { title: `Published ${RUN}` })
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { _status: 'published' } as never,
        ...actingAs(accounts.admin),
      })
      await retitle('articles', doc.id, accounts.member, { title: `After ${RUN}` })
      const live = await payload.findByID({
        collection: 'articles',
        id: doc.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(live.slug).toBe(`published-${RUN}`)
      expect((await stored('articles', doc.id)).slug).toBe(`published-${RUN}`)
    })

    it('articles: a title change in Arabic leaves the slug, and so does a publish from Arabic', async () => {
      const doc = await ownDraft('articles', accounts.member, { title: `English ${RUN}` })
      await payload.update({
        collection: 'articles',
        id: doc.id,
        locale: 'ar',
        data: { title: 'عنوان عربي' } as never,
        draft: true,
        ...actingAs(accounts.member),
      })
      expect((await stored('articles', doc.id)).slug).toBe(`english-${RUN}`)
      await payload.update({
        collection: 'articles',
        id: doc.id,
        locale: 'ar',
        data: { _status: 'published' } as never,
        ...actingAs(accounts.admin),
      })
      await retitle('articles', doc.id, accounts.member, { title: `Changed ${RUN}` })
      expect((await stored('articles', doc.id)).slug).toBe(`english-${RUN}`)
    })

    it('articles: a draft made only in Arabic gets a slug from its title', async () => {
      const title = `عنوان ${RUN}`
      const doc = await arabicDraft(title)
      expect((await stored('articles', doc.id)).slug).toBe(slugify(title))
    })

    it('articles: an update in English with no English title keeps the slug, and a later English title moves it', async () => {
      const title = `مقالة ${RUN}`
      const doc = await arabicDraft(title)
      await retitle('articles', doc.id, accounts.member, { tags: [{ tag: 'probe' }] })
      expect((await stored('articles', doc.id)).slug).toBe(slugify(title))
      await retitle('articles', doc.id, accounts.member, { title: `Later English ${RUN}` })
      expect((await stored('articles', doc.id)).slug).toBe(`later-english-${RUN}`)
    })

    it('articles: a title that gives a slug another article holds leaves the slug, and the next title moves it', async () => {
      const holder = await ownDraft('articles', accounts.member, { title: `Taken ${RUN}` })
      const doc = await ownDraft('articles', accounts.member, { title: `Free ${RUN}` })
      await retitle('articles', doc.id, accounts.member, { title: `Taken ${RUN}` })
      expect((await stored('articles', doc.id)).slug).toBe(`free-${RUN}`)
      expect((await stored('articles', holder.id)).slug).toBe(`taken-${RUN}`)
      await retitle('articles', doc.id, accounts.member, { title: `Third ${RUN}` })
      expect((await stored('articles', doc.id)).slug).toBe(`third-${RUN}`)
    })

    it('articles: a publish that repeats a published slug is refused until an admin sets another slug', async () => {
      const first = await ownDraft('articles', accounts.member, { title: `Alpha ${RUN}` })
      const second = await ownDraft('articles', accounts.member, { title: `Beta ${RUN}` })
      const shared = `Shared ${RUN}`
      await retitle('articles', first.id, accounts.member, { title: shared })
      await retitle('articles', second.id, accounts.member, { title: shared })
      const publish = (id: number) =>
        payload.update({
          collection: 'articles',
          id,
          data: { _status: 'published' } as never,
          ...actingAs(accounts.admin),
        })
      await publish(first.id)
      expect((await stored('articles', first.id)).slug).toBe(`shared-${RUN}`)
      await expect(publish(second.id)).rejects.toMatchObject({
        data: { errors: [{ path: 'slug' }] },
      })
      const chosen = fresh('after-clash')
      await retitle('articles', second.id, accounts.admin, { slug: chosen })
      await publish(second.id)
      expect((await stored('articles', second.id)).slug).toBe(chosen)
      expect((await stored('articles', first.id)).slug).toBe(`shared-${RUN}`)
    })
  })

  describe('people, own person', () => {
    it('member: a write to their own slug is dropped', async () => {
      const before = await payload.findByID({
        collection: 'people',
        id: people.member,
        depth: 0,
        overrideAccess: true,
      })
      const name = uniq('Renamed member')
      await payload.update({
        collection: 'people',
        id: people.member,
        data: { name, slug: uniq('claimed-person') },
        ...actingAs(accounts.member),
      })
      const after = await payload.findByID({
        collection: 'people',
        id: people.member,
        depth: 0,
        overrideAccess: true,
      })
      expect(after.name).toBe(name)
      expect(after.slug).toBe(before.slug)
    })
  })

  describe('enrollments', () => {
    it('fellow: writes to person, course, status, slot and source of a taught course are dropped', async () => {
      const enrollment = track(
        'enrollments',
        await payload.create({
          collection: 'enrollments',
          data: {
            person: people.student,
            course: taughtCourse,
            status: 'applied',
            source: 'admin',
          },
        }),
      )
      await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        data: {
          person: people.member,
          course: otherCourse,
          status: 'accepted',
          slot: 'evening',
          source: 'backfill',
          assessment: lexical('Strong reading'),
        },
        ...actingAs(accounts.fellow),
      })
      const after = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(after).toMatchObject({
        person: people.student,
        course: taughtCourse,
        status: 'applied',
        source: 'admin',
      })
      expect(after.slot ?? null).toBeNull()
      expect(at(after, 'assessment.root.children')).toEqual(lexical('Strong reading').root.children)
    })

    it('member: an own assessment write throws, and a read returns no assessment', async () => {
      const enrollment = track(
        'enrollments',
        await payload.create({
          collection: 'enrollments',
          data: {
            person: people.member,
            course: otherCourse,
            status: 'accepted',
            source: 'admin',
            assessment: lexical('Written by a fellow'),
          },
        }),
      )
      await expect(
        payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          data: { assessment: lexical('Written by the student') },
          ...actingAs(accounts.member),
        }),
      ).rejects.toThrow(Forbidden)
      const own = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        ...actingAs(accounts.member),
      })
      expect(own.id).toBe(enrollment.id)
      expect(own).not.toHaveProperty('assessment')
      const after = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(at(after, 'assessment.root.children')).toEqual(
        lexical('Written by a fellow').root.children,
      )
    })
  })

  describe('space-preferences, own row', () => {
    it.each(['fellow', 'member'] as Role[])(
      '%s: a write to digest_sent_at is dropped, and their own choices still save',
      async (role) => {
        const account = accounts[role]
        const row = track(
          'space-preferences',
          await payload.create({
            collection: 'space-preferences',
            data: {
              account: account.id,
              digest: 'weekly',
              digest_sent_at: '2030-01-05T14:00:00.000Z',
            },
          }),
        )
        await payload.update({
          collection: 'space-preferences',
          id: row.id,
          data: { digest_sent_at: '2031-01-01T00:00:00.000Z', stop_all_email: true },
          ...actingAs(account),
        })
        const after = await payload.findByID({
          collection: 'space-preferences',
          id: row.id,
          overrideAccess: true,
        })
        expect(after.stop_all_email).toBe(true)
        expect(after.digest_sent_at).toBe('2030-01-05T14:00:00.000Z')
      },
    )
  })

  describe('form-submissions', () => {
    it.each(['fellow', 'member', 'anonymous'] as const)(
      '%s: find throws Forbidden',
      async (who) => {
        await expect(
          payload.find({
            collection: 'form-submissions',
            ...actingAs(who === 'anonymous' ? undefined : accounts[who]),
          }),
        ).rejects.toThrow(Forbidden)
      },
    )
  })

  describe('anonymous', () => {
    it.each(['articles', 'courses', 'publications'] as const)(
      'a create of %s throws, and nothing is stored',
      async (collection) => {
        const title = uniq(`Anonymous ${collection}`)
        await expect(
          payload.create({ collection, data: { title } as never, draft: true, ...actingAs() }),
        ).rejects.toThrow(Forbidden)
        const { totalDocs } = await payload.count({
          collection,
          where: { title: { equals: title } },
          overrideAccess: true,
        })
        expect(totalDocs).toBe(0)
      },
    )

    it('an update of an article throws, and the title stays', async () => {
      const doc = await ownDraft('articles', accounts.member)
      await expect(
        payload.update({
          collection: 'articles',
          id: doc.id,
          data: { title: fresh('Anonymous edit') },
          draft: true,
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      expect((await stored('articles', doc.id)).title).toBe(doc.title)
    })

    it('a create of an enrollment or a space preference throws', async () => {
      await expect(
        payload.create({
          collection: 'enrollments',
          data: { person: people.student, course: otherCourse, status: 'applied', source: 'admin' },
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      await expect(
        payload.create({
          collection: 'space-preferences',
          data: { account: accounts.member.id, digest: 'off' },
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      const { totalDocs } = await payload.count({
        collection: 'enrollments',
        where: { person: { equals: people.student }, course: { equals: otherCourse } },
        overrideAccess: true,
      })
      expect(totalDocs).toBe(0)
    })
  })
})
