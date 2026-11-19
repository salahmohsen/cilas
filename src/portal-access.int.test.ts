import { readFile } from 'node:fs/promises'

import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { PHOTO_MAX_BYTES, PHOTO_MAX_PIXELS } from '@/lib/profile-limits'
import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

import { animatedImage } from '../testing/animated-image.test-utils'
import { bucketKeys, bucketObject } from '../testing/bucket.test-utils'
import { hugePng } from '../testing/huge-image.test-utils'
import { RUN, createTracker, uniq, uniqEmail, uniqPath } from '../testing/payload.fixture'
import { rest } from '../testing/payload-rest.test-utils'

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

    it.each(OWNERS)(
      '%s as %s: a draft slug follows each title change',
      async (collection, role) => {
        const doc = await ownDraft(collection, accounts[role], {
          title: `First ${collection} ${role} ${RUN}`,
        })
        expect((await stored(collection, doc.id)).slug).toBe(`first-${collection}-${role}-${RUN}`)
        await retitle(collection, doc.id, accounts[role], {
          title: `Second ${collection} ${role} ${RUN}`,
        })
        expect((await stored(collection, doc.id)).slug).toBe(`second-${collection}-${role}-${RUN}`)
      },
    )

    it.each(OWNERS)(
      '%s as %s: a hand-written slug on update is dropped',
      async (collection, role) => {
        const doc = await ownDraft(collection, accounts[role], {
          title: `Hand ${collection} ${role} ${RUN}`,
        })
        await retitle(collection, doc.id, accounts[role], { slug: fresh('claimed') })
        expect((await stored(collection, doc.id)).slug).toBe(`hand-${collection}-${role}-${RUN}`)
      },
    )

    it.each(OWNERS)(
      '%s as %s: a write to generateSlug is dropped, so the slug keeps following the title',
      async (collection, role) => {
        const doc = await ownDraft(collection, accounts[role])
        await retitle(collection, doc.id, accounts[role], { generateSlug: false })
        const title = fresh(`Still follows ${collection}`)
        await retitle(collection, doc.id, accounts[role], { title })
        expect((await stored(collection, doc.id)).slug).toBe(slugify(title))
      },
    )

    it.each(OWNERS)(
      '%s as %s: two drafts with one title both save, the second slug gets a suffix',
      async (collection, role) => {
        const title = `Twin ${collection} ${role} ${RUN}`
        const first = await ownDraft(collection, accounts[role], { title })
        const second = await ownDraft(collection, accounts[role], { title })
        expect((await stored(collection, first.id)).slug).toBe(slugify(title))
        expect((await stored(collection, second.id)).slug).toBe(`${slugify(title)}-2`)
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

    it('articles: a third draft with the same title gets the next free suffix', async () => {
      const title = `Triplet ${RUN}`
      const slugs = []
      for (let n = 0; n < 3; n += 1) {
        const doc = await ownDraft('articles', accounts.member, { title })
        slugs.push((await stored('articles', doc.id)).slug)
      }
      expect(slugs).toEqual([`triplet-${RUN}`, `triplet-${RUN}-2`, `triplet-${RUN}-3`])
    })

    describe.each(['articles', 'publications'] as const)('%s: an admin', (collection) => {
      it('unlocks the slug with a hand-written value that stays when the owner retitles', async () => {
        const doc = await ownDraft(collection, accounts.member)
        const chosen = fresh(`unlocked-${collection}`)
        await retitle(collection, doc.id, accounts.admin, { slug: chosen })
        await retitle(collection, doc.id, accounts.member, { title: fresh('Owner retitle') })
        expect((await stored(collection, doc.id)).slug).toBe(chosen)
      })

      it('sets generateSlug back to true: the slug is rebuilt from the title and follows it again', async () => {
        const title = `Relocked ${collection} ${RUN}`
        const doc = await ownDraft(collection, accounts.member, { title })
        await retitle(collection, doc.id, accounts.admin, { slug: fresh(`unlocked-${collection}`) })
        await retitle(collection, doc.id, accounts.admin, { generateSlug: true })
        expect((await stored(collection, doc.id)).slug).toBe(slugify(title))
        const next = `Follows again ${collection} ${RUN}`
        await retitle(collection, doc.id, accounts.member, { title: next })
        expect((await stored(collection, doc.id)).slug).toBe(slugify(next))
      })

      it('saves an empty slug on a draft: the slug is rebuilt from the title', async () => {
        const title = `Emptied ${collection} ${RUN}`
        const doc = await ownDraft(collection, accounts.member, { title })
        await retitle(collection, doc.id, accounts.admin, { slug: '' })
        expect((await stored(collection, doc.id)).slug).toBe(slugify(title))
      })
    })

    it('courses: a retitle before the first publish moves the slug', async () => {
      const doc = await ownDraft('courses', accounts.fellow, { title: `Course one ${RUN}` })
      await retitle('courses', doc.id, accounts.fellow, { title: `Course two ${RUN}` })
      expect((await stored('courses', doc.id)).slug).toBe(`course-two-${RUN}`)
    })

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

  describe('version restore', () => {
    const firstVersion = async (collection: Owned, id: number) =>
      (
        await payload.findVersions({
          collection,
          where: { parent: { equals: id } },
          sort: 'createdAt',
          limit: 1,
          overrideAccess: true,
        })
      ).docs[0]!.id

    const restore = (collection: Owned, id: string, user: User) =>
      payload.restoreVersion({ collection, id, draft: true, depth: 0, ...actingAs(user) })

    const ADMIN_SET = ['slug', 'generateSlug']

    const REQUIRED_TO_RESTORE: Record<Owned, Record<string, unknown>> = {
      articles: {},
      courses: { course_type: 'THEMATIC' },
      publications: { kind: 'research' },
    }

    const editedByAdmin = async (collection: Owned, role: Role) => {
      const owner = accounts[role]
      const doc = await ownDraft(collection, owner, REQUIRED_TO_RESTORE[collection])
      const rows = DROPPED.filter((row) => row.collection === collection)
      const data = Object.assign(
        { slug: fresh(`kept-${collection}`), generateSlug: false },
        ...rows.map((row) => nest(row.field, row.value())),
      )
      await payload.update({
        collection,
        id: doc.id,
        data: data as never,
        draft: true,
        ...actingAs(accounts.admin),
      })
      await payload.update({
        collection,
        id: doc.id,
        data: { title: fresh('Owner retitle') } as never,
        draft: true,
        ...actingAs(owner),
      })
      return {
        id: doc.id,
        title: doc.title,
        fields: [...ADMIN_SET, ...rows.map((row) => row.field)],
        version: await firstVersion(collection, doc.id),
      }
    }

    it.each(OWNERS)(
      '%s as %s: restoring an old version as a draft keeps every admin-only value',
      async (collection, role) => {
        const { id, title, fields, version } = await editedByAdmin(collection, role)
        const before = await stored(collection, id)
        await restore(collection, version, accounts[role])
        const after = await stored(collection, id)
        expect(after.title).toBe(title)
        for (const field of fields)
          expect([field, at(after, field)]).toEqual([field, at(before, field)])
      },
    )

    it.each(['articles', 'courses', 'publications'] as const)(
      'admin: %s restore brings back the old admin-only values',
      async (collection) => {
        const role: Role = collection === 'articles' ? 'member' : 'fellow'
        const { id, version } = await editedByAdmin(collection, role)
        const old = await payload.findVersionByID({
          collection,
          id: version,
          depth: 0,
          overrideAccess: true,
        })
        await restore(collection, version, accounts.admin)
        const after = await stored(collection, id)
        expect(after.slug).toBe(old.version.slug)
        expect(after.legacy_url ?? null).toBe(old.version.legacy_url ?? null)
        if ('tier' in old.version) expect(after).toMatchObject({ tier: old.version.tier })
      },
    )

    it.each([
      ['no user', undefined],
      ['a member', 'member'],
    ] as const)(
      'articles: a server restore with overrideAccess and %s brings back the old admin-only values',
      async (_label, role) => {
        const { id, version } = await editedByAdmin('articles', 'member')
        const old = await payload.findVersionByID({
          collection: 'articles',
          id: version,
          depth: 0,
          overrideAccess: true,
        })
        await payload.restoreVersion({
          collection: 'articles',
          id: version,
          draft: true,
          depth: 0,
          overrideAccess: true,
          ...(role ? { user: accounts[role] } : {}),
        })
        const after = await stored('articles', id)
        for (const field of ['slug', 'tier', 'featured', 'legacy_url'])
          expect([field, at(after, field) ?? null]).toEqual([field, at(old.version, field) ?? null])
      },
    )

    it('articles: a restore by the owner keeps a slug that follows the title', async () => {
      const doc = await ownDraft('articles', accounts.member, { title: `Restore A ${RUN}` })
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { title: `Restore B ${RUN}` },
        draft: true,
        ...actingAs(accounts.member),
      })
      const before = await stored('articles', doc.id)
      expect(before.slug).toBe(`restore-b-${RUN}`)
      await restore('articles', await firstVersion('articles', doc.id), accounts.member)
      const after = await stored('articles', doc.id)
      expect(after.title).toBe(`Restore A ${RUN}`)
      expect([after.slug, after.generateSlug]).toEqual([before.slug, true])
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

  describe('media create', () => {
    const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

    const file = (name: string) => readFile(new URL(`../testing/files/${name}`, import.meta.url))

    const upload = (
      who: User | undefined,
      alt: string,
      name: string,
      mimetype: string,
      data: Buffer,
    ) =>
      payload
        .create({
          collection: 'media',
          data: { alt },
          file: { name: `${RUN}-${name}`, mimetype, data, size: data.length },
          ...actingAs(who),
        })
        .then((media) => track('media', media))

    const storedWithAlt = async (alt: string) =>
      (await payload.count({ collection: 'media', where: { alt: { equals: alt } } })).totalDocs

    const runKeys = () => bucketKeys(`media/${RUN}-`)

    const expectNothingStored = async (
      alt: string,
      attempt: () => Promise<unknown>,
      thrown?: RegExp | typeof Forbidden,
    ) => {
      const before = await runKeys()
      await expect(attempt()).rejects.toThrow(thrown)
      expect(await storedWithAlt(alt)).toBe(0)
      expect(await runKeys()).toEqual(before)
    }

    it.each(['fellow', 'member'] as Role[])(
      '%s: a PDF throws, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal pdf ${role}`)
        const pdf = await file('tiny.pdf')
        await expectNothingStored(alt, () =>
          upload(accounts[role], alt, 'tiny.pdf', 'application/pdf', pdf),
        )
      },
    )

    it.each(['fellow', 'member'] as Role[])(
      '%s: PDF bytes that claim to be image/png throw, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal lie ${role}`)
        const pdf = await file('tiny.pdf')
        await expectNothingStored(alt, () =>
          upload(accounts[role], alt, 'lie.png', 'image/png', pdf),
        )
      },
    )

    it.each(['fellow', 'member'] as Role[])(
      '%s: a PNG larger than PHOTO_MAX_BYTES throws, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal big ${role}`)
        const big = Buffer.concat([await file('pixel.png'), Buffer.alloc(PHOTO_MAX_BYTES)])
        await expectNothingStored(alt, () =>
          upload(accounts[role], alt, 'big.png', 'image/png', big),
        )
      },
    )

    it.each(['fellow', 'member'] as Role[])(
      '%s: a small PNG with huge dimensions throws the photo rule at once, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal pixels ${role}`)
        const huge = hugePng(16000, 16000)
        expect(huge.length).toBeLessThan(PHOTO_MAX_BYTES)
        const started = performance.now()
        await expectNothingStored(
          alt,
          () => upload(accounts[role], alt, 'huge.png', 'image/png', huge),
          /megapixels or less/,
        )
        expect(performance.now() - started).toBeLessThan(2000)
      },
    )

    it('admin: a small PNG with huge dimensions throws, and nothing is stored', async () => {
      const alt = uniq('Portal pixels admin')
      const huge = hugePng(16000, 16000)
      await expectNothingStored(alt, () =>
        upload(accounts.admin, alt, 'huge.png', 'image/png', huge),
      )
    })

    it('admin: an animated WebP within the pixel limit is stored with its frame height', async () => {
      const alt = uniq('Portal animated admin')
      const frame = { width: 64, height: 48 }
      const animated = await animatedImage('webp', { ...frame, frames: 3 })
      const media = await upload(accounts.admin, alt, 'animated.webp', 'image/webp', animated)
      expect(await storedWithAlt(alt)).toBe(1)
      expect([media.width, media.height]).toEqual([frame.width, frame.height])
    })

    it.each(['fellow', 'member'] as Role[])(
      '%s: an animation over the pixel limit in all frames throws the photo rule, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal animated pixels ${role}`)
        const frames = { width: 500, height: 500, frames: 210 }
        expect(frames.width * frames.height).toBeLessThan(PHOTO_MAX_PIXELS)
        expect(frames.width * frames.height * frames.frames).toBeGreaterThan(PHOTO_MAX_PIXELS)
        const animated = await animatedImage('webp', frames)
        await expectNothingStored(
          alt,
          () => upload(accounts[role], alt, 'animated.webp', 'image/webp', animated),
          /megapixels or less/,
        )
      },
    )

    it('admin: a GIF over the photo pixel limit in all frames is stored as WebP', async () => {
      const alt = uniq('Portal animated gif admin')
      const frames = { width: 800, height: 600, frames: 105 }
      expect(frames.width * frames.height * frames.frames).toBeGreaterThan(PHOTO_MAX_PIXELS)
      const animated = await animatedImage('gif', frames)
      const media = await upload(accounts.admin, alt, 'animated.gif', 'image/gif', animated)
      expect(await storedWithAlt(alt)).toBe(1)
      expect([media.mimeType, media.width, media.height]).toEqual([
        'image/webp',
        frames.width,
        frames.height,
      ])
    })

    it.each(['fellow', 'member'] as Role[])(
      '%s: a GIF throws, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal gif ${role}`)
        await expectNothingStored(alt, () =>
          upload(accounts[role], alt, 'pixel.gif', 'image/gif', GIF),
        )
      },
    )

    it.each(['fellow', 'member'] as Role[])(
      '%s: a create with no file (a remote URL) throws the photo rule, and nothing is stored',
      async (role) => {
        const alt = uniq(`Portal remote ${role}`)
        await expectNothingStored(
          alt,
          () =>
            payload.create({
              collection: 'media',
              data: { alt, filename: `${RUN}-remote.png`, url: 'http://127.0.0.1:9/remote.png' },
              ...actingAs(accounts[role]),
            }),
          /image of 5 MB or less/,
        )
      },
    )

    it.each(['fellow', 'member'] as Role[])('%s: a small PNG is stored', async (role) => {
      const alt = uniq(`Portal png ${role}`)
      await upload(accounts[role], alt, 'pixel.png', 'image/png', await file('pixel.png'))
      expect(await storedWithAlt(alt)).toBe(1)
    })

    it('admin: a PDF is stored', async () => {
      const alt = uniq('Portal pdf admin')
      await upload(accounts.admin, alt, 'tiny.pdf', 'application/pdf', await file('tiny.pdf'))
      expect(await storedWithAlt(alt)).toBe(1)
    })

    it('anonymous: a PNG throws Forbidden, and nothing is stored', async () => {
      const alt = uniq('Portal png anonymous')
      const png = await file('pixel.png')
      await expectNothingStored(
        alt,
        () => upload(undefined, alt, 'pixel.png', 'image/png', png),
        Forbidden,
      )
    })

    describe('over REST', () => {
      const password = crypto.randomUUID()
      let token: string

      beforeAll(async () => {
        const email = uniqEmail('portal-rest-member')
        track(
          'users',
          await payload.create({
            collection: 'users',
            data: { email, password, roles: ['member'] },
          }),
        )
        token =
          (await payload.login({ collection: 'users', data: { email, password } })).token ?? ''
      })

      const post = (alt: string, name: string, data: Buffer) => {
        const body = new FormData()
        body.set('_payload', JSON.stringify({ alt }))
        body.set('file', new File([new Uint8Array(data)], `${RUN}-${name}`, { type: 'image/png' }))
        return rest('POST', 'media', { token, body })
      }

      it('a PNG with a script after its last chunk is stored as WebP without the script', async () => {
        const alt = uniq('Portal polyglot')
        const polyglot = Buffer.concat([
          await file('pixel.png'),
          Buffer.from('<script>alert(document.domain)</script>'),
        ])
        const response = await post(alt, 'polyglot.png', polyglot)
        expect(response.status).toBe(201)
        const { doc } = (await response.json()) as { doc: { id: number; filename: string } }
        track('media', doc.id)
        const media = await payload.findByID({ collection: 'media', id: doc.id })
        expect(media.mimeType).toBe('image/webp')
        const object = await bucketObject(`media/${media.filename}`)
        expect(object.subarray(0, 4).toString()).toBe('RIFF')
        expect(object.toString('latin1')).not.toContain('<script')
      })

      it('PNG signature bytes followed by a script throw, and nothing is stored', async () => {
        const alt = uniq('Portal polyglot head')
        const head = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.from('<script>alert(document.domain)</script>'),
        ])
        const before = await runKeys()
        expect((await post(alt, 'head.png', head)).status).toBe(400)
        expect(await storedWithAlt(alt)).toBe(0)
        expect(await runKeys()).toEqual(before)
      })

      it('serves a stored image with nosniff and inline', async () => {
        const alt = uniq('Portal served png')
        const media = await upload(
          accounts.member,
          alt,
          'served.png',
          'image/png',
          await file('pixel.png'),
        )
        const response = await rest('GET', `media/file/${media.filename}`)
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/webp')
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(response.headers.get('content-disposition')).toBeNull()
      })

      it('serves a stored PDF with nosniff and as an attachment', async () => {
        const alt = uniq('Portal served pdf')
        const media = await upload(
          accounts.admin,
          alt,
          'served.pdf',
          'application/pdf',
          await file('tiny.pdf'),
        )
        const response = await rest('GET', `media/file/${media.filename}`)
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('application/pdf')
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(response.headers.get('content-disposition')).toMatch(/^attachment/)
      })
    })
  })
})
