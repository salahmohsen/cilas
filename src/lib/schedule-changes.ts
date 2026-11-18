import { createTranslator } from 'next-intl'

import { addDays } from '@/lib/cairo-day'
import { weekStart } from '@/lib/calendar'
import type { CalendarBlock, CalendarItem } from '@/lib/calendar-items'
import { formatTime, toMinutes } from '@/components/calendar/ui/calendar-time'
import { dayLabel } from '@/lib/meeting-text'
import { byWhen } from '@/lib/meetings'
import { scheduleToken } from '@/lib/session-refs'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

/**
 * What a save of the calendar changed, as far as the people of a course need
 * to hear it (ADR 0011, "Saving and telling people"). Pure: the caller loads
 * the items before and after, and decides what to do with the result. An
 * empty result means: offer no announcement.
 */

/**
 * One change that counts. `title` is the item's title after the change, or
 * before it for a removed item. `blocks` are the item's meetings from today
 * on: the ones an added, removed, cancelled or restored item touches.
 */
export type ScheduleChange =
  | { kind: 'moved'; itemId: string; title: string; from: CalendarBlock; to: CalendarBlock }
  | { kind: 'meeting-added'; itemId: string; title: string; block: CalendarBlock }
  | { kind: 'meeting-removed'; itemId: string; title: string; block: CalendarBlock }
  | { kind: 'item-added'; itemId: string; title: string; blocks: CalendarBlock[] }
  | { kind: 'item-removed'; itemId: string; title: string; blocks: CalendarBlock[] }
  | { kind: 'cancelled'; itemId: string; title: string; blocks: CalendarBlock[] }
  | { kind: 'restored'; itemId: string; title: string; blocks: CalendarBlock[] }

const times = (b: CalendarBlock) => `${b.date} ${b.start_time ?? ''} ${b.end_time ?? ''}`

/** A day is a Cairo `YYYY-MM-DD`, so `>=` is the order of days. */
const live = (blocks: readonly CalendarBlock[], today: string): boolean =>
  blocks.some((b) => b.date >= today)

const itemChanges = (
  before: CalendarItem | undefined,
  after: CalendarItem | undefined,
  today: string,
): ScheduleChange[] => {
  const item = after ?? before
  if (!item) return []
  const { id: itemId, title } = item
  const blocks = item.blocks.filter((b) => b.date >= today).sort(byWhen)
  if (!before || !after) {
    return [{ kind: after ? 'item-added' : 'item-removed', itemId, title, blocks }]
  }

  const changes: ScheduleChange[] = []
  if (before.cancelled !== after.cancelled) {
    changes.push({ kind: after.cancelled ? 'cancelled' : 'restored', itemId, title, blocks })
  }
  const was = new Map(before.blocks.map((b) => [b.id, b]))
  const now = new Map(after.blocks.map((b) => [b.id, b]))
  for (const block of [...after.blocks].sort(byWhen)) {
    const from = was.get(block.id)
    if (!from) changes.push({ kind: 'meeting-added', itemId, title, block })
    else if (times(from) !== times(block)) {
      changes.push({ kind: 'moved', itemId, title, from, to: block })
    }
  }
  for (const block of [...before.blocks].sort(byWhen)) {
    if (!now.has(block.id)) changes.push({ kind: 'meeting-removed', itemId, title, block })
  }
  return changes
}

/** The meetings a change touches, before and after. */
const touched = (change: ScheduleChange): CalendarBlock[] => {
  switch (change.kind) {
    case 'moved':
      return [change.from, change.to]
    case 'meeting-added':
    case 'meeting-removed':
      return [change.block]
    case 'item-added':
    case 'item-removed':
    case 'cancelled':
    case 'restored':
      return change.blocks
  }
}

/**
 * The changes from `before` to `after` that count: those with a meeting, old
 * or new, on `today` (a Cairo day) or later. Corrections to the past count
 * for nothing, and an added, removed, cancelled or restored session lists
 * only its meetings from `today` on, so it counts when it has one. A session
 * cancelled in the save has that change only, since its moved or added
 * meetings will not happen. Items and blocks
 * are matched by id; an item or block made in the save has an id the other
 * side lacks. Order: items as `after` lists them, then removed items as
 * `before` listed them.
 */
export const scheduleChanges = (
  before: readonly CalendarItem[],
  after: readonly CalendarItem[],
  today: string,
): ScheduleChange[] => {
  const was = new Map(before.map((i) => [i.id, i]))
  const now = new Set(after.map((i) => i.id))
  const ids = [...after.map((i) => i.id), ...before.map((i) => i.id).filter((id) => !now.has(id))]
  const items = new Map(after.map((i) => [i.id, i]))
  return ids.flatMap((id) => {
    const changes = itemChanges(was.get(id), items.get(id), today).filter((change) =>
      live(touched(change), today),
    )
    const cancelled = changes.find((change) => change.kind === 'cancelled')
    return cancelled ? [cancelled] : changes
  })
}

/**
 * The announcement's schedule block: the weeks from the first meeting the
 * changes touch on `today` or later to the last, with the changed sessions
 * marked. A removed session is gone, so it is not marked, but its meetings
 * still set the weeks. Null when no session is left to mark.
 */
export const scheduleBlock = (changes: readonly ScheduleChange[], today: string): string | null => {
  const ids = [...new Set(changes.flatMap((c) => (c.kind === 'item-removed' ? [] : [c.itemId])))]
  const days = changes
    .flatMap(touched)
    .map((b) => b.date)
    .filter((day) => day >= today)
    .sort()
  const [first, last] = [days[0], days.at(-1)]
  if (!ids.length || !first || !last) return null
  let weeks = 1
  for (let day = addDays(weekStart(first), 7); day <= last; day = addDays(day, 7)) weeks++
  return scheduleToken({ from: first, weeks, ids })
}

export type ScheduleChangeLocale = 'en' | 'ar'

/**
 * The changes as a short Markdown list for an announcement, one bullet per
 * change, in the language of the course page. `names` holds each session's
 * name in that language ("Session 3: Title", `sessionName`); a session
 * deleted in the save is no longer there to name, so it keeps the title the
 * page showed. Words come from `messages/*.json` (`ScheduleChanges`) through
 * next-intl's server-safe translator; days and times are written as the
 * course page writes them (`meeting-text.ts`, `digits.ts`). An all-day
 * meeting shows its day only.
 */
export const scheduleChangeText = (
  changes: readonly ScheduleChange[],
  locale: ScheduleChangeLocale,
  names: ReadonlyMap<string, string>,
): string => {
  const t = createTranslator({
    locale,
    messages: locale === 'ar' ? ar : en,
    namespace: 'ScheduleChanges',
  })
  const list = new Intl.ListFormat(locale, { type: 'conjunction' })
  const when = (b: CalendarBlock): string => {
    const day = dayLabel(b.date, locale)
    return b.start_time ? t('at', { day, time: formatTime(toMinutes(b.start_time), locale) }) : day
  }
  const line = (c: ScheduleChange): string => {
    const session = names.get(c.itemId) ?? c.title
    switch (c.kind) {
      case 'moved':
        return t('moved', { session, from: when(c.from), to: when(c.to) })
      case 'meeting-added':
        return t('meetingAdded', { session, when: when(c.block) })
      case 'meeting-removed':
        return t('meetingRemoved', { session, when: when(c.block) })
      case 'item-added':
        return t('itemAdded', { session, when: list.format(c.blocks.map(when)) })
      case 'item-removed':
        return t('itemRemoved', { session, when: list.format(c.blocks.map(when)) })
      case 'cancelled':
        return t('cancelled', { session })
      case 'restored':
        return t('restored', { session })
    }
  }
  return changes.map((c) => `- ${line(c)}`).join('\n')
}
