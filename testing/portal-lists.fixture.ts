import type { Payload } from 'payload'

import { addDays, cairoDay } from '../src/lib/cairo-day'
import { STATUS_KEYS, type StatusKey } from '../src/lib/review-status'
import { consentAccept } from '../src/lib/spaces-write'
import { makeMedia } from './media.fixture'
import { type createTracker, uniq, uniqEmail } from './payload.fixture'
import {
  account,
  courseRoom,
  PASSWORD,
  type PortalAccount,
  type PortalWorld,
} from './portal.fixture'

type Track = ReturnType<typeof createTracker>['track']

const makeWriter = async (payload: Payload, track: Track) => {
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'List Writer', slug: uniq('list-writer') },
      overrideAccess: true,
    }),
  ).id
  const email = uniqEmail('list-writer')
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password: PASSWORD, roles: ['admin'], person },
      depth: 0,
      overrideAccess: true,
    }),
  )
  const consent = await consentAccept({ payload, user })
  if (!consent.ok) throw new Error(`consent refused for ${email}`)
  return { id: user.id, email, password: PASSWORD, person } satisfies PortalAccount
}

let counter = 0
const nextSlug = (base: string) => uniq(`${base}-${++counter}`)

export const trustedWrites = (payload: Payload, track: Track) => {
  const create = async (collection: 'articles' | 'courses', data: Record<string, unknown>) =>
    track(
      collection,
      await payload.create({ collection, data: data as never, locale: 'en', overrideAccess: true }),
    ).id

  const edit = (collection: 'articles' | 'courses', id: number, data: Record<string, unknown>) =>
    payload.update({
      collection,
      id,
      data: data as never,
      draft: true,
      locale: 'en',
      overrideAccess: true,
    })

  const submit = (
    collection: 'articles' | 'courses',
    id: number,
    request: 'changes' | 'removal' | null = null,
  ) =>
    payload.update({
      collection,
      id,
      data: {
        _status: 'draft',
        review: { status: 'submitted', ...(request ? { request } : {}) },
      } as never,
      locale: 'en',
      overrideAccess: true,
    })

  const decide = (
    collection: 'articles' | 'courses',
    id: number,
    status: 'changes_requested' | 'rejected',
  ) =>
    payload.update({
      collection,
      id,
      data: { _status: 'draft', review: { status, review_note: 'A note' } } as never,
      locale: 'en',
      overrideAccess: true,
    })

  const unpublish = (collection: 'articles' | 'courses', id: number) =>
    payload.update({
      collection,
      id,
      data: { _status: 'draft' } as never,
      locale: 'en',
      overrideAccess: true,
    })

  return { create, edit, submit, decide, unpublish }
}

export const writePublishedArticle = (
  create: ReturnType<typeof trustedWrites>['create'],
  owner: number,
  title: string,
  extra: Record<string, unknown> = {},
) =>
  create('articles', {
    title,
    slug: nextSlug('list-article'),
    authors: [owner],
    tier: 'public',
    review: { status: 'approved' },
    _status: 'published',
    ...extra,
  })

export type ListWorld = Awaited<ReturnType<typeof listWorld>>

/**
 * Rows for the Articles and Courses lists. `bulk` comes first, so every later
 * row is newer on the main row's `updatedAt`: the paged groups sort by it, and
 * the rows the tests look for sit on page 1.
 */
export const listWorld = async (
  payload: Payload,
  track: Track,
  world: PortalWorld,
  { bulk: bulkCount = 60 }: { bulk?: number } = {},
) => {
  const { create, edit, submit, decide, unpublish } = trustedWrites(payload, track)
  const owner = world.accounts.student.person!
  const poster = world.poster.person!

  const draftArticle = (title: string, authors = [owner]) =>
    create('articles', {
      title,
      slug: nextSlug('list-article'),
      authors,
      tier: 'owner',
      review: { status: 'draft' },
    })

  const publishedArticle = (title: string, extra: Record<string, unknown> = {}) =>
    writePublishedArticle(create, owner, title, extra)

  const bulk: number[] = []
  for (let i = 0; i < bulkCount; i++) bulk.push(await publishedArticle(uniq('Bulk')))

  const cover = await makeMedia(payload, track, 'list-cover')
  const titles = {
    alpha: uniq('Alpha'),
    beta: uniq('Beta'),
    sharedCopy: uniq('Shared copy'),
    addedCopy: uniq('Added copy'),
  }

  const articles = {} as Record<StatusKey, number>
  articles.draft = await draftArticle(uniq('Key draft'))

  articles.submitted = await draftArticle(uniq('Key submitted'))
  await submit('articles', articles.submitted)

  articles.changes_requested = await draftArticle(uniq('Key changes requested'))
  await submit('articles', articles.changes_requested)
  await decide('articles', articles.changes_requested, 'changes_requested')

  articles.rejected = await draftArticle(uniq('Key rejected'))
  await submit('articles', articles.rejected)
  await decide('articles', articles.rejected, 'rejected')

  articles.published = await publishedArticle(uniq('Key published'))

  articles.published_unsent = await publishedArticle(titles.alpha)
  await edit('articles', articles.published_unsent, { title: titles.beta })

  articles.published_edits = await publishedArticle(uniq('Key edits'))
  await edit('articles', articles.published_edits, { title: uniq('Key edits, edited') })
  await submit('articles', articles.published_edits, 'changes')

  articles.published_removal = await publishedArticle(uniq('Key removal'))
  await submit('articles', articles.published_removal, 'removal')

  articles.published_edits_returned = await publishedArticle(uniq('Key edits returned'))
  await edit('articles', articles.published_edits_returned, {
    title: uniq('Key edits returned, edited'),
  })
  await submit('articles', articles.published_edits_returned, 'changes')
  await decide('articles', articles.published_edits_returned, 'changes_requested')

  articles.published_edits_declined = await publishedArticle(uniq('Key edits declined'))
  await edit('articles', articles.published_edits_declined, {
    title: uniq('Key edits declined, edited'),
  })
  await submit('articles', articles.published_edits_declined, 'changes')
  await decide('articles', articles.published_edits_declined, 'rejected')

  articles.published_removal_kept = await publishedArticle(uniq('Key removal kept'), {
    cover_image: cover.id,
  })
  await submit('articles', articles.published_removal_kept, 'removal')
  await decide('articles', articles.published_removal_kept, 'rejected')

  const manyDrafts: number[] = []
  for (let i = 0; i < 11; i++) manyDrafts.push(await draftArticle(uniq('Draft')))

  const unpublished = await publishedArticle(uniq('Unpublished'))
  await unpublish('articles', unpublished)

  const shared = await publishedArticle(uniq('Shared'), { authors: [owner, poster] })
  await edit('articles', shared, { authors: [owner], title: titles.sharedCopy })

  const added = await publishedArticle(uniq('Added'))
  await edit('articles', added, { authors: [owner, poster], title: titles.addedCopy })

  const teacher = await account(payload, track, 'fellow', 'list-teacher')
  const writer = await makeWriter(payload, track)

  const writerDraft = await draftArticle(uniq('Writer draft'), [writer.person!])
  const writerManyDrafts: number[] = []
  for (let i = 0; i < 11; i++)
    writerManyDrafts.push(await draftArticle(uniq('Writer many'), [writer.person!]))
  const writerUnpublished = await publishedArticle(uniq('Writer unpublished'), {
    authors: [writer.person!],
  })
  await unpublish('articles', writerUnpublished)

  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'List place', slug: uniq('list-place'), city: uniq('Listville') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2035, place, start_date: '2035-03-04' },
      overrideAccess: true,
    }),
  ).id

  const draftCourse = (title: string) =>
    create('courses', {
      title,
      slug: nextSlug('list-course'),
      course_type: 'THEMATIC',
      tier: 'owner',
      cycle,
      fellows: [teacher.person!],
      review: { status: 'draft' },
    })

  const publishedCourse = async (title: string, fellows = [teacher.person!]) => {
    const id = await create('courses', {
      title,
      slug: nextSlug('list-course'),
      course_type: 'THEMATIC',
      tier: 'public',
      cycle,
      fellows,
      registration: { mode: 'closed' },
      review: { status: 'approved' },
      _status: 'published',
    })
    await courseRoom(payload, track, id)
    return id
  }

  const session = async (course: number, index: number, date: string) =>
    track(
      'sessions',
      await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: `List session ${index + 1}`,
          meetings: [{ date, start_time: '10:00', end_time: '12:00' }],
        },
        overrideAccess: true,
      }),
    )

  const withSpace = async (course: number) => {
    track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: { kind: 'course', course },
        overrideAccess: true,
      }),
    )
    await courseRoom(payload, track, course)
  }

  const today = cairoDay(new Date())!
  const courses = {} as Record<
    | 'published_edits'
    | 'published_edits_returned'
    | 'draft'
    | 'rejected'
    | 'submittedWithSpace'
    | 'rejectedWithSpace'
    | 'othersPublished',
    number
  >

  courses.othersPublished = await publishedCourse(uniq('Course of another fellow'), [poster])

  courses.published_edits = await publishedCourse(uniq('Course edits'))
  for (let i = 0; i < 12; i++)
    await session(courses.published_edits, i, addDays(today, (i - 3) * 7 + 1))
  await edit('courses', courses.published_edits, { title: uniq('Course edits, edited') })
  await submit('courses', courses.published_edits, 'changes')

  courses.published_edits_returned = await publishedCourse(uniq('Course returned'))
  await edit('courses', courses.published_edits_returned, {
    title: uniq('Course returned, edited'),
  })
  await submit('courses', courses.published_edits_returned, 'changes')
  await decide('courses', courses.published_edits_returned, 'changes_requested')

  courses.draft = await draftCourse(uniq('Course draft'))

  courses.rejected = await draftCourse(uniq('Course rejected'))
  await session(courses.rejected, 0, addDays(today, 30))
  await submit('courses', courses.rejected)
  await decide('courses', courses.rejected, 'rejected')

  courses.submittedWithSpace = await draftCourse(uniq('Course submitted with space'))
  await submit('courses', courses.submittedWithSpace)
  await withSpace(courses.submittedWithSpace)

  courses.rejectedWithSpace = await draftCourse(uniq('Course rejected with space'))
  await submit('courses', courses.rejectedWithSpace)
  await decide('courses', courses.rejectedWithSpace, 'rejected')
  await withSpace(courses.rejectedWithSpace)

  return {
    bulk,
    cover,
    titles,
    articles: Object.fromEntries(STATUS_KEYS.map((key) => [key, articles[key]])) as Record<
      StatusKey,
      number
    >,
    manyDrafts,
    unpublished,
    shared,
    added,
    courses,
    teacher,
    writer,
    writerDraft,
    writerManyDrafts,
    writerUnpublished,
  }
}
