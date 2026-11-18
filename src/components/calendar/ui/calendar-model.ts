import type { Span } from '@ui-sdk/core'

import type { CalendarItem } from '@/lib/calendar-items'

import { nextMeeting } from '@/lib/meetings'

import { toMinutes } from './calendar-time'

export const DEFAULT_MINUTES = 60
const FALLBACK_HOURS = [9 * 60, 17 * 60] as const

/**
 * A block as the editor holds it. A timed block is a span: the day is the
 * track, minutes are the range. An all-day block has no times (`allDay`, with
 * `start` and `end` 0): it sits in the all-day row and never reaches the span
 * editor. `itemId` names an item the host loaded, or an item made on the page,
 * which does not exist until Save. `deleted` marks a block shown as a ghost
 * until Save.
 */
export type EditBlock = Span & {
  itemId: string
  blockId: string
  allDay?: true
  deleted?: boolean
  /** The block of an item that is `readOnly`: it shows and opens, and nothing changes it. */
  readOnly?: true
}

export const blockKey = (itemId: string, blockId: string) => `${itemId}/${blockId}`

let created = 0
/** A temporary id, for an item or block made on the page. It lives until Save, so a counter is enough. */
const temporaryId = () => `new-${Date.now().toString(36)}-${(created++).toString(36)}`

/** The id of an item made on the page. Its blocks all name it, and Save sends them as one new item. */
export const newItemId = temporaryId

/** A block made on the page, on an item that exists or on one made on the page. */
export const newBlock = (itemId: string, track: string, start: number, end: number): EditBlock => {
  const blockId = temporaryId()
  return { id: blockKey(itemId, blockId), track, start, end, itemId, blockId }
}

/** An all-day block made on the page. */
export const newAllDayBlock = (itemId: string, track: string): EditBlock => ({
  ...newBlock(itemId, track, 0, 0),
  allDay: true,
})

/** A new block like `block`, on `track`, for `itemId`: the same times, or all day. */
export const copyBlock = (block: EditBlock, itemId: string, track: string): EditBlock =>
  block.allDay ? newAllDayBlock(itemId, track) : newBlock(itemId, track, block.start, block.end)

/** Every block of the items as the editor holds them: timed ones as spans, all-day ones flagged. */
export const blocksOf = (items: CalendarItem[]): EditBlock[] =>
  items.flatMap((item) =>
    item.blocks.map((block): EditBlock => {
      const common = {
        id: blockKey(item.id, block.id),
        track: block.date,
        itemId: item.id,
        blockId: block.id,
        ...(item.readOnly ? { readOnly: true as const } : {}),
      }
      if (!block.start_time) return { ...common, start: 0, end: 0, allDay: true }
      const start = toMinutes(block.start_time)
      return {
        ...common,
        start,
        end: block.end_time ? toMinutes(block.end_time) : start + DEFAULT_MINUTES,
      }
    }),
  )

/** The timed blocks, which the span editor and the hours of the grid read. */
export const timedBlocks = (blocks: EditBlock[]): EditBlock[] =>
  blocks.filter((block) => !block.allDay)

/**
 * The working day an edit grid always shows, so a new meeting can go at any
 * usual time. The grid ends at midnight, so a meeting never grows it past 24:00.
 */
const WORKING_DAY = { min: 6 * 60, max: 24 * 60 } as const
/** Where an empty week opens, and where the first new meeting of a day goes. */
export const DEFAULT_START_MINUTES = 9 * 60

/**
 * The hours the grid shows, as one rule of the mode and the meetings. View mode
 * runs from the earliest start to the latest end, in whole hours. Edit mode
 * shows 06:00 to 24:00, and starts earlier only to hold an earlier meeting.
 */
export const hourRange = (mode: 'view' | 'edit', blocks: Span[]) => {
  const starts = blocks.map((block) => block.start)
  const ends = blocks.map((block) => block.end)
  const first = Math.floor(Math.min(...(starts.length ? starts : [FALLBACK_HOURS[0]])) / 60) * 60
  const last = Math.ceil(Math.max(...(ends.length ? ends : [FALLBACK_HOURS[1]])) / 60) * 60
  if (mode === 'view') return { min: first, max: last }
  return { min: Math.min(WORKING_DAY.min, first), max: WORKING_DAY.max }
}

/** Where the hours scroll to: the first meeting of the days, or 09:00 when they have none. */
export const scrollTargetOf = (blocks: Span[], days: string[]) => {
  const starts = blocks.filter((block) => days.includes(block.track)).map((block) => block.start)
  return starts.length ? Math.min(...starts) : DEFAULT_START_MINUTES
}

/** One legend entry per kind, in the tone of the first item of that kind. */
export const legendOf = (items: CalendarItem[]) => [
  ...new Map(items.map((item) => [item.kind, { kind: item.kind, tone: item.tone }])).values(),
]

/** The first start, in half hours from `min`, where a block of `size` minutes overlaps nothing on `track`; `min` when the day is full. */
export const firstFreeStart = (
  blocks: Span[],
  track: string,
  min: number,
  max: number,
  size = DEFAULT_MINUTES,
) => {
  const taken = blocks.filter((block) => block.track === track)
  for (let start = min; start + size <= max; start += 30) {
    if (!taken.some((block) => block.start < start + size && start < block.end)) return start
  }
  return min
}

/** A block's state, which splits an all-day bar where it changes. */
export const editState =
  (unsaved: ReadonlySet<string>) =>
  (block: EditBlock): 'saved' | 'unsaved' | 'deleted' =>
    block.deleted ? 'deleted' : unsaved.has(block.id) ? 'unsaved' : 'saved'

/**
 * A bar in the all-day row: one block, or the blocks of one item on
 * consecutive days, which show as one bar across them. `from` is the index
 * of its first day in `days`, `span` how many days it covers, `lane` its
 * row, the first free one from the top.
 */
export type AllDayBar = {
  blocks: [EditBlock, ...EditBlock[]]
  from: number
  span: number
  lane: number
}

/**
 * The all-day row of `days`. Blocks of one item on days in a row join into
 * one bar when `stateOf` gives them the same state (saved, unsaved, deleted),
 * so a bar is one thing to press, delete or restore, and a change splits it
 * where the state changes.
 */
export const allDayBars = (
  blocks: EditBlock[],
  days: string[],
  stateOf: (block: EditBlock) => string,
): AllDayBar[] => {
  const runs: { blocks: [EditBlock, ...EditBlock[]]; from: number; span: number }[] = []
  const sorted = blocks
    .filter((block) => block.allDay && days.includes(block.track))
    .toSorted((a, b) => a.track.localeCompare(b.track) || a.id.localeCompare(b.id))
  for (const block of sorted) {
    const at = days.indexOf(block.track)
    const run = runs.find(
      (candidate) =>
        candidate.from + candidate.span === at &&
        candidate.blocks[0].itemId === block.itemId &&
        stateOf(candidate.blocks[0]) === stateOf(block),
    )
    if (run) {
      run.blocks.push(block)
      run.span += 1
    } else runs.push({ blocks: [block], from: at, span: 1 })
  }
  const lanes: number[] = []
  return runs.map((run) => {
    let lane = lanes.findIndex((end) => end <= run.from)
    if (lane === -1) lane = lanes.length
    lanes[lane] = run.from + run.span
    return { ...run, lane }
  })
}

/**
 * The next meeting from `now`: the first held block that has not ended, with
 * its item. The rule is `nextMeeting`'s; this only drops today's ended blocks.
 */
export const upNext = (items: CalendarItem[], now: { date: string; minutes: number }) =>
  nextMeeting(
    items.flatMap((item) =>
      item.blocks
        .filter(
          (block) =>
            block.date !== now.date || !block.end_time || toMinutes(block.end_time) > now.minutes,
        )
        .map((block) => ({
          ...block,
          item,
          ...(item.cancelled ? { cancelled: true as const } : {}),
        })),
    ),
    now.date,
  )
