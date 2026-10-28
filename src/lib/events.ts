import { cairoDay, cairoInstant } from '@/lib/cairo-day'
import { expandSchedule, type Meeting } from '@/lib/schedule'
import type { Event } from '@/payload-types'

export type EventTiming = {
  status: 'upcoming' | 'past' | 'undated'
  meeting?: Meeting
  day?: string
}

export const eventTiming = (
  event: Pick<Event, 'schedule' | 'agenda'>,
  now = new Date(),
): EventTiming => {
  const schedule = event.schedule
  if (schedule?.start_precision === 'week') return { status: 'undated' }
  const meetings = expandSchedule(schedule)
  if (meetings.length) {
    const next = meetings.find((m) => {
      const end = cairoInstant(m.date, m.end_time)
      return end !== null && new Date(end) > now
    })
    const meeting = next ?? meetings.at(-1)!
    return { status: next ? 'upcoming' : 'past', meeting, day: meeting.date }
  }
  const day = schedule?.start_date ? cairoDay(schedule.start_date) : null
  if (!day) return { status: 'undated' }
  const agendaEnd = event.agenda
    ?.map((item) => item.end_time)
    .sort()
    .at(-1)
  const end = agendaEnd ? cairoInstant(day, agendaEnd) : null
  return { status: (end ? new Date(end) > now : day >= cairoDay(now)!) ? 'upcoming' : 'past', day }
}

export const orderEvents = (events: Event[], now = new Date()) => {
  const groups: Record<EventTiming['status'], Event[]> = { upcoming: [], past: [], undated: [] }
  for (const event of events) groups[eventTiming(event, now).status].push(event)
  const when = (event: Event) => {
    const timing = eventTiming(event, now)
    return `${timing.day ?? ''}T${timing.meeting?.start_time ?? '00:00'}`
  }
  groups.upcoming.sort((a, b) => when(a).localeCompare(when(b)))
  groups.past.sort((a, b) => when(b).localeCompare(when(a)))
  return groups
}
