import type { CalendarItem } from '@/lib/calendar-items'

import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatMinutes } from './calendar-time'

type Context = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  hour12: boolean
  /** Ids of the blocks that differ from what was loaded. */
  unsaved: Set<string>
}

export const longDay = (day: string, locale: string) =>
  formatDay(day, locale, { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * What a block is called, on screen and aloud: its title, day, time and what
 * it is now. The grid and the span editor's announcements share it, so a move
 * is announced by the name the block then has.
 */
export function blockNamer({ items, labels, locale, hour12, unsaved }: Context) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const states = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
  return (block: EditBlock) => {
    const item = itemById.get(block.itemId)
    const title = item?.title ?? labels.newItem
    const day = longDay(block.track, locale)
    const time = block.allDay
      ? labels.allDay
      : labels.timeRange(
          formatMinutes(block.start, locale, hour12),
          formatMinutes(block.end, locale, hour12),
        )
    if (block.deleted) return labels.restoreName({ title, day, time })
    const status = [item?.cancelled && labels.cancelled, unsaved.has(block.id) && labels.unsaved]
    return labels.blockName({
      title,
      day,
      time,
      status: states.format(status.filter((state): state is string => Boolean(state))),
    })
  }
}
