import { TYPE_ORDER, toneOf, type CalendarMeeting } from '@/lib/calendar'
import type { CalendarItem } from '@/lib/calendar-items'
import { focalPointStyle } from '@/lib/media-image'

/** What the legend toggles: one kind per course type and per event type. */
export const kindOf = (meeting: Pick<CalendarMeeting, 'kind' | 'type'>) =>
  `${meeting.kind}:${meeting.type}`

/** Courses, then events; each by `TYPE_ORDER`, an unknown type last. */
const rank = ({ kind, type }: Pick<CalendarMeeting, 'kind' | 'type'>) => {
  const at = TYPE_ORDER.indexOf(type)
  return (kind === 'event' ? TYPE_ORDER.length + 1 : 0) + (at === -1 ? TYPE_ORDER.length : at)
}

/**
 * The public calendar's meetings as the calendar's items: a session or an
 * event is one item, its meetings its blocks. Its held and cancelled meetings
 * are two items, since a whole item is cancelled or not. Paths gain the
 * locale. Items come in legend order, courses first, so the legend keeps one
 * order from month to month. View only.
 */
export const publicItems = (
  meetings: readonly CalendarMeeting[],
  { locale, session }: { locale: string; session: (number: number) => string },
): CalendarItem[] => {
  const items = new Map<string, CalendarItem>()
  const order = new Map<string, number>()
  for (const meeting of meetings) {
    const id = meeting.cancelled ? `${meeting.item}-cancelled` : meeting.item
    const block = {
      id: meeting.key,
      date: meeting.date,
      start_time: meeting.start ?? null,
      end_time: meeting.end ?? null,
    }
    const item = items.get(id)
    if (item) {
      item.blocks.push(block)
      continue
    }
    order.set(id, rank(meeting))
    items.set(id, {
      id,
      kind: kindOf(meeting),
      title: meeting.title,
      tone: toneOf(meeting),
      cancelled: Boolean(meeting.cancelled),
      readOnly: true,
      version: '',
      ...(meeting.session ? { caption: session(meeting.session) } : {}),
      ...(meeting.place ? { place: meeting.place } : {}),
      ...(meeting.href ? { href: `/${locale}${meeting.href}` } : {}),
      ...(meeting.cover
        ? {
            image: {
              url: meeting.cover.url,
              alt: meeting.cover.alt,
              position: focalPointStyle(meeting.cover).objectPosition,
            },
          }
        : {}),
      blocks: [block],
    })
  }
  return [...items.values()].toSorted((a, b) => order.get(a.id)! - order.get(b.id)!)
}
