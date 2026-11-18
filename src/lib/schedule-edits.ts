import * as z from 'zod'
import type { CalendarChange, CalendarSave } from '@/lib/calendar-items'
import { editSchema, type SessionDetailChange } from '@/lib/session-edit'

const times = {
  date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
}

const newBlockSchema = z.object({ blockId: z.string(), ...times })

// The page is not trusted: the types say what a change is, and this checks it.
const changeSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create-item'),
    kind: z.string(),
    itemId: z.string().optional(),
    blocks: z.tuple([newBlockSchema], newBlockSchema),
  }),
  z.object({
    op: z.literal('add-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
    ...times,
  }),
  z.object({
    op: z.literal('move-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
    ...times,
  }),
  z.object({
    op: z.literal('delete-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
  }),
]) satisfies z.ZodType<CalendarChange>

export const calendarSaveSchema = z.object({
  parent: z.object({ kind: z.string(), id: z.string() }),
  changes: z.array(changeSchema),
}) satisfies z.ZodType<CalendarSave>

export const scheduleEditsSchema = z.object({
  calendar: calendarSaveSchema.optional(),
  details: z.array(
    z.discriminatedUnion('op', [
      z.object({
        op: z.literal('edit'),
        id: z.string(),
        version: z.string(),
        values: editSchema.omit({ meetings: true }),
        meetings: editSchema.shape.meetings.optional(),
      }),
      z.object({ op: z.literal('delete'), id: z.string(), version: z.string() }),
    ]),
  ),
})
export type ScheduleEdits = { calendar?: CalendarSave; details: SessionDetailChange[] }
