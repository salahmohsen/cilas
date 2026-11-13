import type { PayloadRequest } from 'payload'

import { createSession } from '@/collections/Sessions'
import { meetingProblem } from '@/fields/meetings'
import type { CalendarBlock, CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { toneOf } from '@/lib/calendar'
import { byWhen, numberedSessions, type Meeting, type SessionUnit } from '@/lib/meetings'
import type { Course, Session, User } from '@/payload-types'

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
  /** Someone saved the item after the page loaded it. Reload and redo. */
  | { code: 'stale'; itemId: string }
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
  /** What an untitled session is called: "Session 3" or "Week 3". */
  untitled: (unit: SessionUnit, number: number) => string
}

export type CalendarSource = {
  /** The items the parent holds now. */
  load: (ctx: CalendarContext, parentId: string) => Promise<CalendarItem[]>
  /**
   * Whether the user may add and change this parent's items: the collections'
   * own access, asked once so the page can offer Edit. A save still checks.
   */
  canEdit: (ctx: CalendarContext, parentId: string) => Promise<boolean>
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

/** A course's sessions as calendar items: a session is an item, a meeting its block. */
export const sessionItems = (
  sessions: readonly Pick<
    Session,
    'id' | 'title' | 'cancelled' | 'meetings' | 'position' | 'updatedAt'
  >[],
  course: Pick<Course, 'course_type' | 'session_unit'>,
  untitled: CalendarContext['untitled'],
): CalendarItem[] => {
  const tone = toneOf({ type: course.course_type.toLowerCase() })
  return numberedSessions(sessions, course.session_unit).map(
    ({ session, number, unit }): CalendarItem => ({
      id: String(session.id),
      kind: 'session',
      title: session.title || untitled(unit, number),
      tone,
      cancelled: Boolean(session.cancelled),
      version: session.updatedAt,
      blocks: [...(session.meetings ?? [])].sort(byWhen).map((m): CalendarBlock => ({
        id: m.id ?? '',
        date: m.date,
        start_time: m.start_time || null,
        end_time: m.end_time || null,
      })),
    }),
  )
}

const sessionSource: CalendarSource = {
  async load({ req, user, untitled }, parentId) {
    const id = numericId(parentId)
    const { payload } = req
    const course = await payload.findByID({
      collection: 'courses',
      id,
      depth: 0,
      // As the admin shows the course: its latest draft, if it has one.
      draft: true,
      select: { course_type: true, session_unit: true },
      user,
      overrideAccess: false,
      req,
    })
    const { docs } = await payload.find({
      collection: 'sessions',
      where: { course: { equals: id } },
      depth: 0,
      pagination: false,
      select: { title: true, cancelled: true, meetings: true, position: true, updatedAt: true },
      user,
      overrideAccess: false,
      req,
    })
    return sessionItems(docs, course, untitled)
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
      if (change.op !== 'delete-block') checkMeeting(change, index)
    })

    for (const change of changes) {
      if (change.op !== 'create-item') continue
      await payload.create({
        collection: 'sessions',
        data: { course, meetings: [stored(change)] },
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

const sources: Record<string, CalendarSource> = { course: sessionSource }

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
