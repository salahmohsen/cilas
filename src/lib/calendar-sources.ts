import type { PayloadRequest } from 'payload'

import { createSession } from '@/collections/Sessions'
import { meetingProblem } from '@/fields/meetings'
import type { CalendarBlock, CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { cairoDay, cairoTime } from '@/lib/cairo-day'
import { relId } from '@/lib/relation'
import { eventParts } from '@/lib/space-event'
import { toneOf } from '@/lib/calendar'
import { byWhen, numberedSessions, type Meeting } from '@/lib/meetings'
import type { Course, Session, SpacePost, User } from '@/payload-types'

/**
 * One adapter per kind of calendar parent (ADR 0011): how its documents
 * become `CalendarItem`s, and how a `CalendarChange` writes back. The save
 * action and the hosts know no kind; they ask `calendarSourceOf`.
 */

/** Why a save did not happen. Data, so the page can word it in its own language. */
export type CalendarSaveError =
  | { code: 'unauthenticated' }
  | { code: 'forbidden' }
  /** An item or block is gone, or is not in the parent the save names. */
  | { code: 'not-found'; itemId: string; blockId?: string }
  /** Someone saved the item after the page loaded it. `name` is what it is called now, when it is still there. */
  | { code: 'stale'; itemId: string; name?: string }
  /** A change is not a valid meeting, or not a change this parent takes. */
  | { code: 'invalid'; message: string; change?: number }
  | { code: 'failed' }

/** Thrown by an adapter to fail the whole save with a typed error. */
export class CalendarSaveFailure extends Error {
  constructor(readonly error: CalendarSaveError) {
    super(error.code)
  }
}

/** What an adapter needs: the request that carries the transaction, and who acts. */
export type CalendarContext = {
  req: PayloadRequest
  user: User
  /** What an untitled session is called: "Session 3". */
  untitled: (number: number) => string
}

export type CalendarSource = {
  /** The items the parent holds now. */
  load: (ctx: CalendarContext, parentId: string) => Promise<CalendarItem[]>
  /**
   * Whether the user may add and change this parent's items: the collections'
   * own access, asked once so the page can offer Edit. A save still checks.
   */
  canEdit: (ctx: CalendarContext, parentId: string) => Promise<boolean>
  /** What each item is called in words, in the context's language, by item id. */
  names: (ctx: CalendarContext, parentId: string) => Promise<Map<string, string>>
  /**
   * Writes the changes with the user's own access, on `ctx.req`, so the
   * caller's transaction covers them. Throws `CalendarSaveFailure` or a
   * Payload error; the caller rolls back.
   */
  apply: (ctx: CalendarContext, parentId: string, changes: CalendarChange[]) => Promise<void>
}

type Entry = { change: CalendarChange; index: number }
type StoredMeeting = Meeting & { id?: string | null }

const invalid = (message: string, change?: number) =>
  new CalendarSaveFailure({ code: 'invalid', message, change })

const numericId = (value: string, change?: number): number => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw invalid(`“${value}” is not an id.`, change)
  return id
}

/** The one check a meeting passes on save, run early so the error names the change. */
const checkMeeting = (
  meeting: Pick<Meeting, 'date' | 'start_time' | 'end_time'>,
  index: number,
): void => {
  for (const field of ['date', 'start_time', 'end_time'] as const) {
    const problem = meetingProblem(field, meeting)
    if (problem !== true) throw invalid(problem, index)
  }
}

const stored = ({ date, start_time, end_time }: Meeting): Meeting => ({
  date,
  start_time: start_time || null,
  end_time: end_time || null,
})

/**
 * The meetings of one session after its changes, in order. A block's id is
 * its meeting row's id. A block made in this save has only the page's
 * temporary id: it is kept here so a later change in the same save can name
 * it, and is dropped when written, so the database gives the row its own id.
 */
export const meetingsAfter = (
  itemId: string,
  current: readonly StoredMeeting[],
  entries: readonly Entry[],
): StoredMeeting[] => {
  const rows = current.map((m) => ({ key: m.id ?? '', meeting: m }))
  for (const { change, index } of entries) {
    if (change.op === 'create-item') continue
    const at = rows.findIndex((r) => r.key === change.blockId)
    if (change.op === 'add-block') {
      if (at !== -1) throw invalid('That block id is already used.', index)
      rows.push({ key: change.blockId, meeting: stored(change) })
    } else if (at === -1) {
      throw new CalendarSaveFailure({ code: 'not-found', itemId, blockId: change.blockId })
    } else if (change.op === 'move-block') {
      const row = rows[at]!
      // A moved meeting keeps its row, so its id stays.
      rows[at] = {
        ...row,
        meeting: { ...stored(change), ...(row.meeting.id ? { id: row.meeting.id } : {}) },
      }
    } else {
      rows.splice(at, 1)
    }
  }
  return rows.map((row) => row.meeting)
}

/** A session in words: "Session 3: Title", or "Session 3" with no title. */
export const sessionName = (
  number: number,
  title: string | null | undefined,
  untitled: CalendarContext['untitled'],
): string => (title ? `${untitled(number)}: ${title}` : untitled(number))

/** A course's sessions as calendar items: a session is an item, a meeting its block. */
export const sessionItems = (
  sessions: readonly Pick<
    Session,
    'id' | 'title' | 'cancelled' | 'meetings' | 'position' | 'updatedAt'
  >[],
  // The admin reads the draft, and a draft may not have its type yet.
  course: { course_type?: Course['course_type'] | null },
  untitled: CalendarContext['untitled'],
): CalendarItem[] => {
  const tone = toneOf({ type: course.course_type?.toLowerCase() ?? '' })
  return numberedSessions(sessions).map(({ session, number }): CalendarItem => ({
    id: String(session.id),
    kind: 'session',
    title: session.title || untitled(number),
    tone,
    cancelled: Boolean(session.cancelled),
    version: session.updatedAt,
    blocks: [...(session.meetings ?? [])].sort(byWhen).map((m): CalendarBlock => ({
      id: m.id ?? '',
      date: m.date,
      start_time: m.start_time || null,
      end_time: m.end_time || null,
    })),
  }))
}

const courseSessions = async (
  { req, user }: CalendarContext,
  id: number,
): Promise<Pick<Session, 'id' | 'title' | 'cancelled' | 'meetings' | 'position' | 'updatedAt'>[]> =>
  (
    await req.payload.find({
      collection: 'sessions',
      where: { course: { equals: id } },
      depth: 0,
      pagination: false,
      select: { title: true, cancelled: true, meetings: true, position: true, updatedAt: true },
      user,
      overrideAccess: false,
      req,
    })
  ).docs

/** The fields of a course that its calendar and its session drawer read. */
export type ShownCourse = Pick<
  Course,
  'id' | 'slug' | 'title' | 'subtitle' | 'description' | 'syllabus_tentative' | 'course_type'
>

/**
 * A course as this user may see it, and whether they may edit its sessions.
 * Only editors read a pending draft; readers see the published course. Every
 * reader of a course's sessions goes through here, so the rule is written once.
 */
export const shownCourse = async (
  ctx: CalendarContext,
  courseId: string,
): Promise<{ course: ShownCourse; canEdit: boolean }> => {
  const { req, user } = ctx
  const canEdit = await sessionSource.canEdit(ctx, courseId)
  const course = await req.payload.findByID({
    collection: 'courses',
    id: numericId(courseId),
    depth: 0,
    draft: canEdit,
    select: {
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      syllabus_tentative: true,
      course_type: true,
    },
    user,
    overrideAccess: false,
    req,
  })
  return { course, canEdit }
}

const sessionSource: CalendarSource = {
  async load(ctx, parentId) {
    const { course } = await shownCourse(ctx, parentId)
    return sessionItems(await courseSessions(ctx, numericId(parentId)), course, ctx.untitled)
  },

  async names(ctx, parentId) {
    const sessions = numberedSessions(await courseSessions(ctx, numericId(parentId)))
    return new Map(
      sessions.map(({ session, number }) => [
        String(session.id),
        sessionName(number, session.title, ctx.untitled),
      ]),
    )
  },

  async canEdit({ req }, parentId) {
    return (await createSession({ req, data: { course: numericId(parentId) } })) === true
  },

  async apply({ req, user }, parentId, changes) {
    const course = numericId(parentId)
    const { payload } = req
    const access = { user, overrideAccess: false, req } as const

    const byItem = new Map<string, Entry[]>()
    changes.forEach((change, index) => {
      if (change.op === 'create-item') {
        if (change.kind !== 'session') throw invalid(`A course has no “${change.kind}”.`, index)
        return
      }
      numericId(change.itemId, index)
      byItem.set(change.itemId, [...(byItem.get(change.itemId) ?? []), { change, index }])
    })
    changes.forEach((change, index) => {
      if (change.op === 'create-item') change.blocks.forEach((block) => checkMeeting(block, index))
      else if (change.op !== 'delete-block') checkMeeting(change, index)
    })

    for (const change of changes) {
      if (change.op !== 'create-item') continue
      await payload.create({
        collection: 'sessions',
        data: { course, meetings: change.blocks.map(stored) },
        ...access,
      })
    }

    if (byItem.size === 0) return
    const { docs } = await payload.find({
      collection: 'sessions',
      where: {
        and: [{ id: { in: [...byItem.keys()].map(Number) } }, { course: { equals: course } }],
      },
      depth: 0,
      pagination: false,
      select: { meetings: true, updatedAt: true },
      ...access,
    })
    const sessions = new Map<string, Pick<Session, 'id' | 'meetings' | 'updatedAt'>>(
      docs.map((doc) => [String(doc.id), doc]),
    )

    for (const [itemId, entries] of byItem) {
      const session = sessions.get(itemId)
      if (!session) throw new CalendarSaveFailure({ code: 'not-found', itemId })
      for (const { change } of entries) {
        if (change.op !== 'create-item' && change.version !== session.updatedAt)
          throw new CalendarSaveFailure({ code: 'stale', itemId })
      }
      // One update for all of a session's changes: one version, one set of hooks.
      await payload.update({
        collection: 'sessions',
        id: session.id,
        data: { meetings: meetingsAfter(itemId, session.meetings ?? [], entries) },
        ...access,
      })
    }
  },
}

/** Instants enter the wall-clock calendar through the shared Cairo conversion. */
export const spaceEventItems = (
  posts: readonly Pick<
    SpacePost,
    'id' | 'body' | 'event_title' | 'event_starts_at' | 'event_ends_at' | 'updatedAt'
  >[],
): CalendarItem[] =>
  posts.flatMap((post) => {
    if (!post.event_starts_at) return []
    const date = cairoDay(post.event_starts_at)
    if (!date) return []
    return [
      {
        id: `space-event:${post.id}`,
        kind: 'space-event',
        title: eventParts(post).title,
        tone: 'neutral',
        readOnly: true,
        cancelled: false,
        version: post.updatedAt,
        blocks: [
          {
            id: String(post.id),
            date,
            start_time: cairoTime(post.event_starts_at),
            end_time: post.event_ends_at ? cairoTime(post.event_ends_at) : null,
          },
        ],
      },
    ]
  })

/** Resolve with the reader's access before composing or saving anything. */
const spaceCourse = async ({ req, user }: CalendarContext, parentId: string): Promise<string> => {
  const space = await req.payload.findByID({
    collection: 'spaces',
    id: numericId(parentId),
    depth: 0,
    user,
    overrideAccess: false,
    req,
  })
  const course = relId(space.course)
  if (space.kind !== 'course' || course == null)
    throw new CalendarSaveFailure({
      code: 'invalid',
      message: 'This space has no calendar.',
    })
  return String(course)
}

const spaceSource: CalendarSource = {
  async load(ctx, parentId) {
    const course = await spaceCourse(ctx, parentId)
    const sessions = await sessionSource.load(ctx, course)
    const { docs } = await ctx.req.payload.find({
      collection: 'space-posts',
      where: {
        and: [
          { space: { equals: numericId(parentId) } },
          { event_starts_at: { exists: true } },
          { deleted_at: { exists: false } },
        ],
      },
      depth: 0,
      pagination: false,
      user: ctx.user,
      overrideAccess: false,
      req: ctx.req,
    })
    return [...sessions, ...spaceEventItems(docs)]
  },
  async canEdit(ctx, parentId) {
    return sessionSource.canEdit(ctx, await spaceCourse(ctx, parentId))
  },
  async names(ctx, parentId) {
    return sessionSource.names(ctx, await spaceCourse(ctx, parentId))
  },
  async apply(ctx, parentId, changes) {
    const course = await spaceCourse(ctx, parentId)
    // Validate the entire batch before delegating any session writes.
    changes.forEach((change, index) => {
      if (
        change.op === 'create-item'
          ? change.kind !== 'session'
          : change.itemId.startsWith('space-event:')
      )
        throw invalid('Space events are edited from their post.', index)
    })
    return sessionSource.apply(ctx, course, changes)
  },
}

const sources: Record<string, CalendarSource> = { course: sessionSource, space: spaceSource }

/** The adapter for a parent kind, or null when no adapter takes it. */
export const calendarSourceOf = (parentKind: string): CalendarSource | null =>
  Object.hasOwn(sources, parentKind) ? sources[parentKind]! : null

/** Payload's own refusals, and anything else a save threw, as the typed error the page shows. */
export const calendarErrorOf = (error: unknown): CalendarSaveError => {
  if (error instanceof CalendarSaveFailure) return error.error
  const { status, data } = (error ?? {}) as {
    status?: number
    data?: { errors?: { message?: string }[] }
  }
  if (status === 403) return { code: 'forbidden' }
  if (status === 400)
    return { code: 'invalid', message: data?.errors?.[0]?.message ?? 'The change is not valid.' }
  console.error('calendar request failed', error)
  return { code: 'failed' }
}
