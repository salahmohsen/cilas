import { cairoDay, cairoInstant } from '@/lib/cairo-day'
import type { CalendarMeeting } from '@/lib/calendar'

/**
 * The first meeting that starts at or after `now`, in the order given. A
 * meeting with a start time is next by that instant, so one earlier today is
 * not. A meeting with no start time lasts its whole Cairo day.
 */
export const upcoming = (meetings: CalendarMeeting[], now: Date): CalendarMeeting | undefined => {
  const today = cairoDay(now)
  return meetings.find(({ cancelled, date, start }) => {
    if (cancelled) return false
    const instant = start ? cairoInstant(date, start) : null
    return instant ? new Date(instant) >= now : today !== null && date >= today
  })
}
