import type { Payload } from 'payload'

import type { ReviewedCollection } from '../src/lib/reviewed-fields'
import { relId } from '../src/lib/relation'
import { STATUS_KEYS, type StatusKey } from '../src/lib/review-status'
import { type createTracker, uniq } from './payload.fixture'
import { listWorld, trustedWrites, writePublishedArticle } from './portal-lists.fixture'
import { courseRoom, type PortalWorld } from './portal.fixture'

type Track = ReturnType<typeof createTracker>['track']

type Row = { _status?: string | null; review?: { status?: string | null } | null }

let counter = 0
const slugOf = (base: string) => uniq(`${base}-${++counter}`)

export const adminWaitingOf = async (
  payload: Payload,
  collection: ReviewedCollection,
  ids: number[],
) => {
  if (ids.length === 0) return []
  const mains = await payload.find({
    collection,
    where: { id: { in: ids } },
    draft: false,
    select: { _status: true, review: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const versions = await payload.findVersions({
    collection,
    where: { parent: { in: ids }, latest: { equals: true } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const latestOf = new Map<number, { row: Row; updatedAt: string }>()
  for (const v of versions.docs) {
    const parent = relId(v.parent as never) as number
    const seen = latestOf.get(parent)
    if (!seen || v.updatedAt > seen.updatedAt)
      latestOf.set(parent, { row: v.version as Row, updatedAt: v.updatedAt })
  }
  return (mains.docs as unknown as Array<Row & { id: number }>)
    .filter((main) => {
      const latest = latestOf.get(main.id)?.row ?? null
      if (main._status === 'published')
        return latest?._status === 'draft' && latest.review?.status === 'submitted'
      const row = latest ?? main
      return (
        ['submitted', 'changes_requested'].includes(main.review?.status ?? '') &&
        row._status !== 'published' &&
        row.review?.status === 'submitted'
      )
    })
    .map((main) => main.id)
}

export const needsWorld = async (payload: Payload, track: Track, world: PortalWorld) => {
  const lists = await listWorld(payload, track, world, { bulk: 0 })
  const { create, submit, decide, unpublish } = trustedWrites(payload, track)
  const student = world.accounts.student.person
  const fellowPerson = world.accounts.fellow.person
  if (student == null) throw new Error('the world student has no person')
  if (fellowPerson == null) throw new Error('the world fellow has no person')

  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Needs place', slug: uniq('needs-place'), city: uniq('Needsville') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
      overrideAccess: true,
    }),
  ).id

  const fellowCourse = (title: string) =>
    create('courses', {
      title,
      slug: slugOf('needs-course'),
      course_type: 'THEMATIC',
      tier: 'owner',
      cycle,
      fellows: [fellowPerson],
      review: { status: 'draft' },
    })

  const fellowCourses = {} as Record<'changes_requested' | 'published_removal', number>

  fellowCourses.changes_requested = await fellowCourse(uniq('Needs course returned'))
  await submit('courses', fellowCourses.changes_requested)
  await decide('courses', fellowCourses.changes_requested, 'changes_requested')

  fellowCourses.published_removal = await create('courses', {
    title: uniq('Needs course removal'),
    slug: slugOf('needs-course'),
    course_type: 'THEMATIC',
    tier: 'public',
    cycle,
    fellows: [fellowPerson],
    registration: { mode: 'closed' },
    review: { status: 'approved' },
    _status: 'published',
  })
  await courseRoom(payload, track, fellowCourses.published_removal)
  await submit('courses', fellowCourses.published_removal, 'removal')

  const hiddenPerson = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: uniq('Hidden Owner'), slug: slugOf('needs-hidden'), visible: false },
      overrideAccess: true,
    }),
  ).id
  const hiddenOwnerArticle = await create('articles', {
    title: uniq('Needs hidden owner'),
    slug: slugOf('needs-article'),
    authors: [hiddenPerson],
    tier: 'owner',
    review: { status: 'draft' },
  })
  await submit('articles', hiddenOwnerArticle)

  const publication = track(
    'publications',
    await payload.create({
      collection: 'publications',
      data: {
        title: uniq('Needs publication'),
        slug: slugOf('needs-publication'),
        kind: 'other',
        review: { status: 'draft' },
      },
      overrideAccess: true,
    }),
  ).id
  await payload.update({
    collection: 'publications',
    id: publication,
    data: { _status: 'draft', review: { status: 'submitted' } } as never,
    overrideAccess: true,
  })

  const takenDownSubmitted = async (title: string) => {
    const id = await writePublishedArticle(create, student, title)
    await unpublish('articles', id)
    await submit('articles', id)
    return id
  }

  const latestVersionId = async (id: number) => {
    const { docs } = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return docs[0]?.id
  }

  const belowTheHooks = async (
    id: number,
    status: 'changes_requested' | 'rejected' | 'approved',
  ) => {
    const versionBefore = await latestVersionId(id)
    await payload.db.updateOne({ collection: 'articles', id, data: { review: { status } } })
    const main = (await payload.findByID({
      collection: 'articles',
      id,
      draft: false,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Row
    const latest = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const version = latest.docs[0]
    const copy = version?.version as unknown as Row | undefined
    if (
      main._status !== 'draft' ||
      main.review?.status !== status ||
      copy?._status !== 'draft' ||
      copy.review?.status !== 'submitted' ||
      version?.id !== versionBefore
    )
      throw new Error(`article ${id}: payload.db.updateOne changed more than the main status`)
  }

  const notLive = {
    takenDownResubmitted: await takenDownSubmitted(uniq('Needs taken down resubmitted')),
    changesRequestedCopySubmitted: await takenDownSubmitted(uniq('Needs changes copy submitted')),
    rejectedCopySubmitted: await takenDownSubmitted(uniq('Needs rejected copy submitted')),
    takenDownCopySubmitted: await takenDownSubmitted(uniq('Needs approved copy submitted')),
  }
  await belowTheHooks(notLive.changesRequestedCopySubmitted, 'changes_requested')
  await belowTheHooks(notLive.rejectedCopySubmitted, 'rejected')
  await belowTheHooks(notLive.takenDownCopySubmitted, 'approved')

  const form = track(
    'forms',
    await payload.create({
      collection: 'forms',
      data: {
        title: uniq('Needs form'),
        confirmationType: 'redirect',
        redirect: { url: 'https://example.org/thanks' },
        fields: [
          { blockType: 'text', name: 'name', label: 'Name', required: true },
          { blockType: 'email', name: 'email', label: 'Email', required: true },
        ],
      },
      overrideAccess: true,
    }),
  ).id
  const programme = track(
    'programmes',
    await payload.create({
      collection: 'programmes',
      data: { title: uniq('Needs programme'), slug: slugOf('needs-programme'), kind: 'residency' },
      overrideAccess: true,
    }),
  ).id
  const identity = [
    { field: 'name', value: 'Needs applicant' },
    { field: 'email', value: 'needs-applicant@cilas.test' },
  ]
  const application = async (data: Record<string, unknown>) => {
    const id = track(
      'form-submissions',
      await payload.create({
        collection: 'form-submissions',
        data: { form, submissionData: identity, ...data } as never,
        overrideAccess: true,
      }),
    ).id
    await payload.delete({
      collection: 'notifications',
      where: { link: { equals: `/admin/applicants?application=${id}` } },
      overrideAccess: true,
    })
    return id
  }
  const applications = {
    course: await application({
      target: { relationTo: 'cycles', value: cycle },
      choices: [
        { course: fellowCourses.changes_requested, decision: null },
        { course: fellowCourses.published_removal, decision: 'pending' },
      ],
    }),
    programme: await application({ target: { relationTo: 'programmes', value: programme } }),
    accepted: await application({
      target: { relationTo: 'cycles', value: cycle },
      choices: [{ course: fellowCourses.changes_requested, decision: 'accepted' }],
    }),
  }

  const articles = {
    ...lists.articles,
    hiddenOwnerArticle,
    ...notLive,
  }
  const ids: Record<ReviewedCollection, number[]> = {
    articles: [
      ...STATUS_KEYS.map((key: StatusKey) => lists.articles[key]),
      ...lists.manyDrafts,
      lists.unpublished,
      lists.shared,
      lists.added,
      lists.writerDraft,
      ...lists.writerManyDrafts,
      lists.writerUnpublished,
      hiddenOwnerArticle,
      ...Object.values(notLive),
    ],
    courses: [...Object.values(lists.courses), ...Object.values(fellowCourses)],
    publications: [publication],
  }
  const adminWaiting = {
    articles: await adminWaitingOf(payload, 'articles', ids.articles),
    courses: await adminWaitingOf(payload, 'courses', ids.courses),
    publications: await adminWaitingOf(payload, 'publications', ids.publications),
  } satisfies Record<ReviewedCollection, number[]>

  return {
    lists,
    place,
    cycle,
    articles,
    courses: { ...lists.courses, ...fellowCourses },
    fellowCourses,
    hiddenOwnerArticle,
    publication,
    notLive,
    applications,
    ids,
    adminWaiting,
  }
}

export type NeedsWorld = Awaited<ReturnType<typeof needsWorld>>

export type PayloadCall = { method: string; args: Record<string, unknown>; result?: unknown }

export const recordingPayload = (
  payload: Payload,
  refuse: (call: PayloadCall) => boolean = () => false,
) => {
  const calls: PayloadCall[] = []
  const recording = new Proxy(payload, {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || typeof prop !== 'string') return value
      return (...args: unknown[]) => {
        const call: PayloadCall = { method: prop, args: (args[0] ?? {}) as Record<string, unknown> }
        calls.push(call)
        if (refuse(call)) return Promise.reject(new Error(`${prop} refused by the fixture`))
        const result = value.apply(target, args)
        return result instanceof Promise
          ? result.then((found: unknown) => {
              call.result = found
              return found
            })
          : result
      }
    },
  })
  return { payload: recording, calls }
}
