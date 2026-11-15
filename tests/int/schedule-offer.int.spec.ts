// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { personOf } from '@/access'
import { calendarContext } from '@/lib/calendar-context'
import { calendarSourceOf } from '@/lib/calendar-sources'
import type { CalendarItem } from '@/lib/calendar-items'
import { scheduleOffers } from '@/lib/schedule-offer'
import { scheduleLineRef, withSchedule } from '@/lib/session-refs'
import { commentCreate, consentAccept, postCreate } from '@/lib/spaces-write'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { RUN, createTracker, lockSpacesMode, uniq, uniqEmail } from './fixtures'

/**
 * The offer after a schedule save (ADR 0011, step 3): what `scheduleOffers`
 * gives for a course with a space, and that publishing it through the post
 * write path makes a pinned announcement that notifies the space's members.
 */
const TODAY = '2031-03-01'
const { track, cleanup } = createTracker()

let payload: Payload
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let fellow: User
let student: User
let course: number
let space: number
let session: number
let intro: number | null = null

const items = async (): Promise<CalendarItem[]> =>
  calendarSourceOf('course')!.load(await calendarContext(fellow, 'en'), String(course))

describe('schedule offer', () => {
  let unlockSpacesMode: () => Promise<void>
  beforeAll(async () => {
    unlockSpacesMode = await lockSpacesMode()
  }, 600_000)

  beforeAll(async () => {
    payload = await getPayload({ config: await (config as never as Promise<typeof config>) })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'
    const mk = async (name: string) => {
      const person = track(
        'people',
        await payload.create({
          collection: 'people',
          data: { name, slug: uniq(name.toLowerCase().replace(/\s+/g, '-')) },
          overrideAccess: true,
        }),
      )
      return track(
        'users',
        await payload.create({
          collection: 'users',
          data: {
            email: uniqEmail(name.toLowerCase().replace(/\s+/g, '-')),
            password: 'probe-probe',
            roles: ['member'],
            person: person.id,
          },
          overrideAccess: true,
        }),
      ) as unknown as User
    }
    fellow = await mk('Offer Fellow')
    student = await mk('Offer Student')

    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Offer Place', slug: uniq('offer-place'), city: `Offerville ${RUN}` },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
        overrideAccess: true,
      }),
    )
    course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Offer Course',
          slug: uniq('offer-course'),
          course_type: 'THEMATIC',
          tier: 'owner',
          cycle: cycle.id,
          fellows: [personOf(fellow)!],
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    track(
      'enrollments',
      (await payload.create({
        collection: 'enrollments',
        data: { course, person: personOf(student)!, status: 'confirmed' } as never,
        overrideAccess: true,
      })) as { id: number },
    )
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course } },
      overrideAccess: true,
      depth: 0,
    })
    space = track('spaces', docs[0]!.id)
    intro = (docs[0] as { introduction_post?: number | null }).introduction_post ?? null
    if (intro) track('space-posts', intro)
    session = track(
      'sessions',
      await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: 'Reading Fanon',
          meetings: [{ date: '2031-03-06', start_time: '19:00', end_time: '21:00' }],
        },
        overrideAccess: true,
      }),
    ).id

    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
    for (const user of [fellow, student]) {
      expect((await consentAccept({ payload, user })).ok).toBe(true)
      const { docs: rows } = await payload.find({
        collection: 'space-consents',
        where: { account: { equals: user.id } },
        overrideAccess: true,
      })
      for (const row of rows) track('space-consents', row.id)
    }
    // The student is past the space's introduction gate, so a refusal is about the announcement.
    const said = await commentCreate({ payload, user: student, post: intro!, body: 'Hello' })
    expect(said.ok).toBe(true)
    if (said.ok) track('space-comments', said.data.id)
  }, 120_000)

  afterAll(async () => {
    if (!space) {
      await cleanup(payload)
      await unlockSpacesMode()
      return
    }
    const { docs } = await payload.find({
      collection: 'notifications',
      where: { recipient: { in: [fellow.id, student.id] } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    for (const row of docs) track('notifications', row.id)
    const { docs: posts } = await payload.find({
      collection: 'space-posts',
      where: { space: { equals: space } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    for (const post of posts) track('space-posts', post.id)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    await cleanup(payload)
    await payload.destroy()
    await unlockSpacesMode()
  })

  /** The items with the session's one meeting moved two days on. */
  const moved = (before: CalendarItem[]): CalendarItem[] =>
    before.map((item) =>
      item.id === String(session)
        ? { ...item, blocks: item.blocks.map((b) => ({ ...b, date: '2031-03-08' })) }
        : item,
    )

  it('offers one prefilled announcement for the course space, named and with the block', async () => {
    const before = await items()
    const offers = await scheduleOffers({
      payload,
      user: fellow,
      courseId: course,
      before,
      after: moved(before),
      today: TODAY,
      locale: 'en',
    })
    expect(offers).toHaveLength(1)
    const [offer] = offers
    expect(offer!.space).toEqual({ id: space, name: 'Offer Course' })
    expect(offer!.language).toBe('en')
    expect(offer!.text).toBe(
      '- Session 1: Reading Fanon moves from Thu 6 Mar 19:00 to Sat 8 Mar 19:00',
    )
    expect(scheduleLineRef(offer!.block!)).toEqual({
      from: '2031-03-01',
      weeks: 2,
      ids: [String(session)],
    })
    expect(offer!.preview?.marked).toEqual([String(session)])
    // The preview reads the data as saved now: the meeting is still on the 6th.
    expect(offer!.preview?.day).toBe('2031-03-06')
  })

  it('offers nothing when nothing counts, or to a member who may not announce', async () => {
    const before = await items()
    const base = { payload, courseId: course, before, today: TODAY, locale: 'en' }
    expect(await scheduleOffers({ ...base, user: fellow, after: before })).toEqual([])
    // Every touched meeting is in the past.
    expect(
      await scheduleOffers({ ...base, user: fellow, after: moved(before), today: '2031-04-01' }),
    ).toEqual([])
    expect(await scheduleOffers({ ...base, user: student, after: moved(before) })).toEqual([])
  })

  it('offers nothing for a course with no space', async () => {
    const draft = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: 'Offer Draft', slug: uniq('offer-draft'), _status: 'draft' } as never,
        overrideAccess: true,
        draft: true,
      }),
    ).id
    const { totalDocs } = await payload.count({
      collection: 'spaces',
      where: { course: { equals: draft } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
    const before = await items()
    expect(
      await scheduleOffers({
        payload,
        user: fellow,
        courseId: draft,
        before,
        after: moved(before),
        today: TODAY,
        locale: 'en',
      }),
    ).toEqual([])
  })

  it('publishes as a pinned announcement by the fellow, with the block, and notifies members', async () => {
    const before = await items()
    const [offer] = await scheduleOffers({
      payload,
      user: fellow,
      courseId: course,
      before,
      after: moved(before),
      today: TODAY,
      locale: 'en',
    })
    const body = withSchedule(offer!.text, offer!.block)
    const result = await postCreate({
      payload,
      user: fellow,
      space,
      kind: 'announcement',
      body,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    track('space-posts', result.data.id)
    await result.notify?.()
    const post = await payload.findByID({
      collection: 'space-posts',
      id: result.data.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(post).toMatchObject({ kind: 'announcement', pinned: true, body })
    expect(post.author).toBe(personOf(fellow))
    const { docs } = await payload.find({
      collection: 'notifications',
      where: { and: [{ recipient: { equals: student.id } }, { kind: { equals: 'announcement' } }] },
      overrideAccess: true,
      depth: 0,
    })
    expect(docs).toHaveLength(1)
  })

  it('refuses the announcement to a member who is not a moderator', async () => {
    const result = await postCreate({
      payload,
      user: student,
      space,
      kind: 'announcement',
      body: '- Session 1: Reading Fanon is cancelled',
    })
    expect(result).toEqual({ ok: false, error: 'announcement' })
  })
})
