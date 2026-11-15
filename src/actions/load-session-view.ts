'use server'

import * as z from 'zod'

import { getCourseSessions } from '@/api/sessions.api'
import { localeOf } from '@/i18n/routing'
import { calendarContext } from '@/lib/calendar-context'
import { shownCourse, type ShownCourse } from '@/lib/calendar-sources'
import { numberedSessions, type NumberedSession } from '@/lib/meetings'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import { spaceHref } from '@/lib/space-ref'
import type { Session } from '@/payload-types'

export type SessionViewResult =
  | {
      ok: true
      course: ShownCourse
      /** The session, numbered and dated among all of its course's sessions. */
      session: NumberedSession<Session>
      /** The course space's page, where the posts about the session are listed; null when the reader may not read it. */
      spaceHref: string | null
      /** Whether the reader may edit the session: the sessions collection's own access. */
      canEdit: boolean
    }
  /** No such session, or not one the reader may read. */
  | { ok: false; error: 'unauthenticated' | 'not-found' | 'failed' }

const idSchema = z.string().regex(/^\d{1,12}$/)

/**
 * One course session for the session drawer, read with the signed-in
 * reader's own access: a reader gets the published course, an editor the
 * pending draft (`shownCourse`), as the calendar shows them.
 */
export async function loadSessionView(id: string, locale = 'en'): Promise<SessionViewResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: 'unauthenticated' }
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'not-found' }
  try {
    const ctx = await calendarContext(user, locale)
    const { req } = ctx
    const access = { user, overrideAccess: false, req } as const
    const row = await req.payload.findByID({
      collection: 'sessions',
      id: Number(id),
      depth: 0,
      select: { course: true },
      ...access,
    })
    const courseId = relId(row.course)
    if (courseId == null) return { ok: false, error: 'not-found' }
    const [{ course, canEdit }, sessions, spaces] = await Promise.all([
      shownCourse(ctx, String(courseId)),
      getCourseSessions(req.payload, [courseId], { locale: localeOf(locale), reader: user }),
      req.payload.find({
        collection: 'spaces',
        where: { course: { equals: courseId } },
        depth: 0,
        limit: 1,
        select: { kind: true, course: true },
        ...access,
      }),
    ])
    const session = numberedSessions(sessions.get(courseId) ?? []).find(
      (n) => String(n.session.id) === id,
    )
    if (!session) return { ok: false, error: 'not-found' }
    const space = spaces.docs[0]
    return {
      ok: true,
      course,
      session,
      spaceHref: space ? spaceHref(space, course, { locale: localeOf(locale) }) : null,
      canEdit,
    }
  } catch (error) {
    const status = (error as { status?: number } | null)?.status
    if (status === 403 || status === 404) return { ok: false, error: 'not-found' }
    console.error('session view failed', error)
    return { ok: false, error: 'failed' }
  }
}
