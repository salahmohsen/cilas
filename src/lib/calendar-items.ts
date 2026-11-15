/**
 * The contract between the calendar component and the code that loads and
 * saves what it shows. The component knows no domain: courses, events and
 * posts become items in `lib/calendar-sources.ts`, and a Save comes back as
 * changes that `actions/save-calendar-changes.ts` writes through the same
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
  | { op: 'create-item'; kind: string; blocks: [NewBlock, ...NewBlock[]] }
  /** A new block on an existing item: an Unscheduled item placed on the grid. */
  | ({ op: 'add-block'; itemId: string; version: string; blockId: string } & BlockTimes)
  | ({ op: 'move-block'; itemId: string; version: string; blockId: string } & BlockTimes)
  | { op: 'delete-block'; itemId: string; version: string; blockId: string }

/** What the host passes to its save: the changes, and the parent a new item belongs to. */
export type CalendarSave = {
  parent: { kind: string; id: string }
  changes: CalendarChange[]
}
