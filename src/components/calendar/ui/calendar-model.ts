import type { Span } from '@ui-sdk/core'

import type { CalendarItem } from '@/lib/calendar-items'

import { toMinutes } from './calendar-time'

export const DEFAULT_MINUTES = 60
const FALLBACK_HOURS = [9 * 60, 17 * 60] as const

/** A timed block as the span editor sees it: the day is the track, minutes are the range. */
export type TimedBlock = Span & { itemId: string; blockId: string }

export const blockKey = (itemId: string, blockId: string) => `${itemId}/${blockId}`

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

/** Whole hours from the earliest start to the latest end of the week's timed blocks. */
export const hourRange = (blocks: Span[], days: string[], padHours = 0) => {
  const inWeek = blocks.filter((block) => days.includes(block.track))
  const starts = inWeek.map((block) => block.start)
  const ends = inWeek.map((block) => block.end)
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
