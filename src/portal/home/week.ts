import { addDays } from '@/lib/cairo-day'
import { byTime, weekStart, type CalendarMeeting } from '@/lib/calendar'

/** The card's heading, which also names the strip of days. */
export const WEEK_HEADING_ID = 'home-week'

export type WeekDay = { date: string; meetings: CalendarMeeting[] }

/** The seven Cairo days of the week of `today`, from Saturday, each with the reader's own meetings and the public events that are not cancelled. */
export const weekAgenda = (
  own: readonly CalendarMeeting[],
  publicList: readonly CalendarMeeting[],
  today: string,
): WeekDay[] => {
  const first = weekStart(today)
  const meetings = [...own, ...publicList.filter(({ kind }) => kind === 'event')]
    .filter(({ cancelled }) => !cancelled)
    .sort(byTime)
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(first, offset)
    return { date, meetings: meetings.filter((meeting) => meeting.date === date) }
  })
}
