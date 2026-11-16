import { courseWeek, lastDay, nextMeeting } from './meetings'

/**
 * The contract between the calendar component and the code that loads and
 * saves what it shows. The component knows no domain: courses, events and
 * posts become items in `lib/calendar-sources.ts`, and a Save comes back as
 * changes that `actions/save-schedule-edits.ts` writes through the same
 * adapters. Days are Cairo `YYYY-MM-DD`; times are Cairo wall-clock `HH:MM`;
 * a block with no times is all day.
 */

/**
 * The colours an item can have. The component draws each from the
 * `--calendar-<tone>` tokens in `foundation.css`; a host picks a name and
 * never a colour.
 */
export const CALENDAR_TONES = ['yellow', 'blue', 'pink', 'green', 'neutral'] as const
export type CalendarTone = (typeof CALENDAR_TONES)[number]

export type CalendarBlock = {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
}

export type CalendarItem = {
  id: string
  kind: string
  title: string
  tone: CalendarTone
  /** This item is visible in edit mode but cannot be changed there. */
  readOnly?: true
  cancelled: boolean
  /** Where or how it meets, in words: "Online", "In person · Darb 1718". */
  place?: string
  /** A short line under the title, such as its number: "Session 3". */
  caption?: string
  /** The start of what it is about, in plain words, for a preview. */
  summary?: string
  /** The item's own page. Its blocks are links to it, so the page's HTML holds them. */
  href?: string
  /** A picture of the item, for its details. `position` is a CSS `object-position`. */
  image?: { url: string; alt: string; position?: string }
  /** The item's `updatedAt` when it was loaded; a save from an older one fails. */
  version: string
  blocks: CalendarBlock[]
}

type BlockTimes = Pick<CalendarBlock, 'date' | 'start_time' | 'end_time'>

/** A block made on the page. `blockId` is temporary: the item gives the block its own id when saved. */
export type NewBlock = BlockTimes & { blockId: string }

/** One edit made on the page. A Save sends every change at once. */
export type CalendarChange =
  /** A new item with its blocks: a block drawn on an empty slot, or a copy of an item moved in time. */
  | { op: 'create-item'; kind: string; itemId?: string; blocks: [NewBlock, ...NewBlock[]] }
  /** A new block on an existing item: an Unscheduled item placed on the grid. */
  | ({ op: 'add-block'; itemId: string; version: string; blockId: string } & BlockTimes)
  | ({ op: 'move-block'; itemId: string; version: string; blockId: string } & BlockTimes)
  | { op: 'delete-block'; itemId: string; version: string; blockId: string }

/** What the host passes to its save: the changes, and the parent a new item belongs to. */
export type CalendarSave = {
  parent: { kind: string; id: string }
  changes: CalendarChange[]
}

const meetingsOf = (items: readonly CalendarItem[]) =>
  items.flatMap((item) =>
    item.blocks.map((block) => ({
      date: block.date,
      ...(item.cancelled ? { cancelled: true as const } : {}),
    })),
  )

/** The next meeting's day, or the last held meeting's day after the course ends. */
export const openingDay = (items: readonly CalendarItem[], today: string): string | undefined => {
  const meetings = meetingsOf(items)
  return nextMeeting(meetings, today)?.date ?? lastDay(meetings) ?? undefined
}

/** The course week the days show, counted over the items' meetings (`courseWeek`). */
export const courseWeekOf = (items: readonly CalendarItem[], days: readonly string[]) =>
  courseWeek(meetingsOf(items), days)
