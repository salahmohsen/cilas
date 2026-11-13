/**
 * Every word the calendar shows. The host supplies them: the site from
 * `messages/*.json` through `useCalendarLabels`, the admin from its own
 * translations. The component holds no copy of its own.
 */
export type CalendarLabels = {
  /** Names the whole calendar for screen readers. */
  name: string
  cairoTime: string
  today: string
  previousWeek: string
  nextWeek: string
  daySwitcher: string
  allDay: string
  legend: string
  timeFormat: string
  hours24: string
  hours12: string
  cancelled: string
  unscheduled: string
  /** What the legend calls an item kind. */
  kind: (kind: string) => string
  /** "14 Nov to 20 Nov 2026" */
  range: (from: string, to: string) => string
  /** "19:00 to 21:00" */
  timeRange: (start: string, end: string) => string
  /** A block's spoken name: title, day, time, and "Cancelled" when it is. */
  blockName: (parts: { title: string; day: string; time: string; cancelled: boolean }) => string
}
