import * as z from 'zod'
import type { PayloadRequest } from 'payload'
import { ACTIVITY_KINDS } from '@/fields/activities'
import { MATERIAL_TYPES } from '@/fields/bibliography'
import { localeOf } from '@/i18n/routing'
import type { User } from '@/payload-types'

/** A stored array row keeps its id, so its other language and its meeting's identity stay. */
const rowId = z.string().min(1).optional()

export const editSchema = z.object({
  title: z.string(),
  /** Markdown. */
  description: z.string(),
  cancelled: z.boolean(),
  /** Cairo day and wall-clock times; both times empty is all day. */
  meetings: z.array(
    z.object({ id: rowId, date: z.string(), start_time: z.string(), end_time: z.string() }),
  ),
  bibliography: z.array(
    z.object({
      id: rowId,
      type: z.enum(MATERIAL_TYPES),
      title: z.string(),
      href: z.string(),
      note: z.string(),
    }),
  ),
  activities: z.array(
    z.object({ id: rowId, kind: z.enum(ACTIVITY_KINDS), description: z.string() }),
  ),
})

/** What the session drawer's Edit form holds: a session's own fields, its text in one language. */
export type SessionEdit = z.infer<typeof editSchema>

export type SessionDetailChange =
  | {
      op: 'edit'
      id: string
      version: string
      values: Omit<SessionEdit, 'meetings'>
      meetings?: SessionEdit['meetings']
    }
  | { op: 'delete'; id: string; version: string }

const orNull = (value: string) => value.trim() || null

export const sessionEditData = (values: Partial<SessionEdit>) => ({
  ...(values.title !== undefined ? { title: orNull(values.title) } : {}),
  ...(values.description !== undefined ? { description: orNull(values.description) } : {}),
  ...(values.cancelled !== undefined ? { cancelled: values.cancelled } : {}),
  ...(values.meetings
    ? {
        meetings: values.meetings.map(({ start_time, end_time, ...m }) => ({
          ...m,
          start_time: start_time || null,
          end_time: end_time || null,
        })),
      }
    : {}),
  ...(values.bibliography
    ? {
        bibliography: values.bibliography.map(({ title, href, note, ...m }) => ({
          ...m,
          title: orNull(title),
          href: orNull(href),
          note: orNull(note),
        })),
      }
    : {}),
  ...(values.activities
    ? {
        activities: values.activities.map(({ description, ...a }) => ({
          ...a,
          description: orNull(description),
        })),
      }
    : {}),
})

export const writeSessionEdit = (
  req: PayloadRequest,
  user: User,
  id: number,
  values: Partial<SessionEdit>,
) =>
  req.payload.update({
    collection: 'sessions',
    id,
    locale: localeOf(req.locale),
    data: sessionEditData(values),
    req,
    user,
    overrideAccess: false,
  })
