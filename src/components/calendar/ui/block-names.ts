import type { CalendarItem } from '@/lib/calendar-items'

import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatTime } from './calendar-time'

type Context = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  /** Ids of the blocks that differ from what was loaded. */
  unsaved: Set<string>
  /** Ids of the items marked as changed. */
  marked: ReadonlySet<string>
}

export const longDay = (day: string, locale: string) =>
  formatDay(day, locale, { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * What a block is called, on screen and aloud: its title, day, time and what
 * it is now. An all-day bar across days is named by its first and last day.
 * The grid and the span editor's announcements share it, so a move is
 * announced by the name the block then has.
 */
export function blockNamer({ items, labels, locale, unsaved, marked }: Context) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const states = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
  /** `last`: the last block of an all-day bar that runs across days. */
  return (block: EditBlock, last?: EditBlock) => {
    const item = itemById.get(block.itemId)
    const title = item?.title ?? labels.newItem
    const day =
      last && last !== block
        ? labels.range(longDay(block.track, locale), longDay(last.track, locale))
        : longDay(block.track, locale)
    const time = block.allDay
      ? labels.allDay
      : labels.timeRange(formatTime(block.start, locale), formatTime(block.end, locale))
    if (block.deleted) return labels.restoreName({ title, day, time })
    const status = [
      item?.cancelled && labels.cancelled,
      marked.has(block.itemId) && labels.changed,
      unsaved.has(block.id) && labels.unsaved,
    ]
    return labels.blockName({
      title,
      day,
      time,
      kind: item?.edge ? labels.kind(item.kind) : '',
      status: states.format(status.filter((state): state is string => Boolean(state))),
    })
  }
}
