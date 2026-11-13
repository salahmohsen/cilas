import type { Span } from '@ui-sdk/core'

import type { CalendarItem } from '@/lib/calendar-items'

import { toMinutes } from './calendar-time'

export const DEFAULT_MINUTES = 60
const FALLBACK_HOURS = [9 * 60, 17 * 60] as const

/**
 * A timed block as the span editor sees it: the day is the track, minutes are
 * the range. `itemId` names an item the host loaded, or an item made on the
 * page, which does not exist until Save. `deleted` marks a block shown as a
 * ghost until Save.
 */
export type TimedBlock = Span & {
  itemId: string
  blockId: string
  deleted?: boolean
}

export const blockKey = (itemId: string, blockId: string) => `${itemId}/${blockId}`

let created = 0
/** A temporary id, for an item or block made on the page. It lives until Save, so a counter is enough. */
const temporaryId = () => `new-${Date.now().toString(36)}-${(created++).toString(36)}`

/** The id of an item made on the page. Its blocks all name it, and Save sends them as one new item. */
export const newItemId = temporaryId

/** A block made on the page, on an item that exists or on one made on the page. */
export const newBlock = (itemId: string, track: string, start: number, end: number): TimedBlock => {
  const blockId = temporaryId()
  return { id: blockKey(itemId, blockId), track, start, end, itemId, blockId }
}

export const timedBlocks = (items: CalendarItem[]): TimedBlock[] =>
  items.flatMap((item) =>
    item.blocks.flatMap((block) => {
      if (!block.start_time) return []
      const start = toMinutes(block.start_time)
      return [
        {
          id: blockKey(item.id, block.id),
          track: block.date,
          start,
          end: block.end_time ? toMinutes(block.end_time) : start + DEFAULT_MINUTES,
          itemId: item.id,
          blockId: block.id,
        },
      ]
    }),
  )

export type AllDayBlock = { item: CalendarItem; blockId: string; date: string }

export const allDayBlocks = (items: CalendarItem[], days: string[]): AllDayBlock[] =>
  items.flatMap((item) =>
    item.blocks
      .filter((block) => !block.start_time && days.includes(block.date))
      .map((block) => ({ item, blockId: block.id, date: block.date })),
  )

/** Whole hours from the earliest start to the latest end of `blocks`, padded by `padHours` each side. */
export const hourRange = (blocks: Span[], padHours = 0) => {
  const starts = blocks.map((block) => block.start)
  const ends = blocks.map((block) => block.end)
  const first = Math.floor(Math.min(...(starts.length ? starts : [FALLBACK_HOURS[0]])) / 60)
  const last = Math.ceil(Math.max(...(ends.length ? ends : [FALLBACK_HOURS[1]])) / 60)
  return {
    min: Math.max(0, first - padHours) * 60,
    max: Math.min(24, last + padHours) * 60,
  }
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
