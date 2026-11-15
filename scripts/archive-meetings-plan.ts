import { addDays, cairoDay, weekdayOf, type Weekday } from '../src/lib/cairo-day'
import { isApproximate, sameWhen, type Meeting, type WeeklyTime } from '../src/lib/meetings'
import { expandSchedule } from '../src/lib/schedule'

/**
 * ADR 0011, "Archive courses get approximate meetings": what meetings one old
 * course with no meeting gets, from the timing the old site held in the
 * frozen `schedule` group (start date, weeks, weekly slots). Pure; `make-archive-meetings.ts` loads, calls this and writes.
 * Delete with the old fields.
 *
 * The dates are approximate. They tell the calendar and the lists when a
 * course ran, to the week, and they use the old site's real times when the
 * course had weekly times. A meeting is all day when no time is known.
 */

export type ArchiveGroup =
  /** A session already holds a meeting: nothing to do. */
  | 'has-meetings'
  /** A start day and a length, no weekly times: one all-day meeting a week. */
  | 'start-and-weeks'
  /** A start day only: one all-day meeting. */
  | 'start-only'
  /** Weekly times and a day to start from: weekly meetings at those times. */
  | 'weekly-times'
  /** Weekly times, but no start day anywhere: no meeting, the times go. */
  | 'times-lost'
  /** A length only: no meeting, the length goes. */
  | 'weeks-lost'
  /** Nothing about time. */
  | 'nothing'

/** Where the day a course starts from came from, most trusted first. */
export type StartSource = 'schedule' | 'research' | 'cycle'

export type ArchiveCourse = {
  /** True when any session of the course holds a meeting. */
  hasMeetings: boolean
  /** The start day in the frozen `schedule` group. */
  startDay: string | null
  /** How many weeks it runs (`schedule.weeks`). */
  weeks: number | null
  /** The old `schedule` group's weekly times. */
  slots: readonly WeeklyTime[]
  /**
   * Other days the course may have started from: the old site's term start
   * for it (the research file), then its cycle's start date.
   */
  term: { research: string | null; cycle: string | null }
  /** The course's sessions, in order, as ids. None holds a meeting. */
  sessions: readonly number[]
}

export type ArchivePlan = {
  group: ArchiveGroup
  /** The day weekly times start from, when a plan was made from one. */
  startedFrom: { day: string; source: StartSource } | null
  /** Meetings for sessions the course has, in their order. */
  onSessions: { session: number; meetings: Meeting[] }[]
  /** New untitled sessions, one for each meeting group the course's own sessions do not take. */
  newSessions: Meeting[][]
}

const allDay = (date: string): Meeting => ({ date, start_time: null, end_time: null })

/** The first day on or after `from` that falls on `weekday`. */
const onOrAfter = (from: string, weekday: Weekday): string => {
  for (let n = 0; n < 7; n++) if (weekdayOf(addDays(from, n)) === weekday) return addDays(from, n)
  throw new Error(`No ${weekday} within a week of ${from}.`)
}

const startOf = (a: ArchiveCourse): { day: string; source: StartSource } | null => {
  const candidates: [StartSource, string | null][] = [
    ['schedule', a.startDay],
    ['research', a.term.research],
    ['cycle', a.term.cycle],
  ]
  const found = candidates.find(([, day]) => day)
  if (!found) return null
  const [source, day] = found
  if (!cairoDay(day!)) throw new Error(`Not a real day (${source}): ${day}`)
  return { day: day!, source }
}

/**
 * The meetings of weekly times, a group for each week: each slot on its
 * weekday, from the first one on or after `from`, at its own times. Without
 * a length, only the first meeting.
 */
const weeklyGroups = (
  slots: readonly WeeklyTime[],
  from: string,
  weeks: number | null,
): Meeting[][] => {
  const first = slots.map((slot) => ({ slot, day: onOrAfter(from, slot.weekday) }))
  const week = (n: number): Meeting[] =>
    first
      .map(({ slot, day }) => ({
        date: addDays(day, 7 * n),
        start_time: slot.start_time,
        end_time: slot.end_time,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  if (!weeks) return [week(0).slice(0, 1)]
  return Array.from({ length: weeks }, (_, n) => week(n))
}

/** The groups go onto the course's own sessions in order; the rest become new sessions. */
const place = (
  groups: Meeting[][],
  sessions: readonly number[],
): Pick<ArchivePlan, 'onSessions' | 'newSessions'> => ({
  onSessions: groups.slice(0, sessions.length).map((meetings, i) => ({
    session: sessions[i]!,
    meetings,
  })),
  newSessions: groups.slice(sessions.length),
})

const none = (group: ArchiveGroup): ArchivePlan => ({
  group,
  startedFrom: null,
  onSessions: [],
  newSessions: [],
})

/**
 * Weekly times come first, since they say the most: they run from the day
 * in its `schedule`, else the old site's term start, else its cycle's
 * start, on each slot's weekday, for `weeks` weeks (the first meeting alone
 * when no length is known). With no such day the times have no place.
 * Without weekly times, an start day makes one all-day meeting a
 * week on its weekday for its weeks, or one meeting without a
 * length. Each meeting group goes on one of the course's sessions, in
 * order (a week with two slots is one session with two meetings, as the
 * model has it); groups left over become new untitled sessions.
 */
export const planArchiveMeetings = (course: ArchiveCourse): ArchivePlan => {
  if (course.hasMeetings) return none('has-meetings')

  if (course.slots.length) {
    const start = startOf(course)
    if (!start) return none('times-lost')
    return {
      group: 'weekly-times',
      startedFrom: start,
      ...place(weeklyGroups(course.slots, start.day, course.weeks), course.sessions),
    }
  }

  const { startDay: start, weeks } = course
  if (start) {
    if (!cairoDay(start)) throw new Error(`Not a real day (schedule): ${start}`)
    const groups = Array.from({ length: weeks || 1 }, (_, n) => [allDay(addDays(start, 7 * n))])
    return {
      group: weeks ? 'start-and-weeks' : 'start-only',
      startedFrom: null,
      ...place(groups, course.sessions),
    }
  }
  return none(weeks ? 'weeks-lost' : 'nothing')
}

/**
 * Whether the old weekly pattern gave the course meetings: the fill
 * (`migrate-course-sessions.ts`) dated it, so `make-archive-meetings.ts` did
 * not. The one test of which courses the archive script wrote.
 */
export const patternDated = (...old: Parameters<typeof expandSchedule>): boolean =>
  expandSchedule(...old).length > 0

/** A session as stored now: its id and its meeting rows. */
export type StoredSession = {
  id: number
  meetings: readonly (Meeting & { id: string })[]
}

export type ApproximateMatch = {
  /** Rows the plan made and nobody changed since, not yet marked. */
  mark: string[]
  /** Rows the plan made that are marked already. */
  marked: number
  /** Planned meetings with no stored row on that session, day and times. */
  missing: { session: number | null; meeting: Meeting }[]
  /** Stored rows the plan did not make, or that a person has moved since. */
  other: { session: number; meeting: Meeting }[]
}

/**
 * Which stored meetings of one course `make-archive-meetings.ts` made, so
 * they can be marked approximate. `plan` is the course's plan made again,
 * with its sessions in the order the script read them (by `position`: none
 * had a meeting then). A planned meeting matches a stored row on the same
 * session, day and times. A row a person moved since does not match and
 * stays unmarked. Nothing is guessed: the rest is reported.
 */
export const matchArchiveMeetings = (
  plan: ArchivePlan,
  stored: readonly StoredSession[],
): ApproximateMatch => {
  const used = new Set<string>()
  const result: ApproximateMatch = { mark: [], marked: 0, missing: [], other: [] }
  for (const { session, meetings } of plan.onSessions) {
    const rows = stored.find((s) => s.id === session)?.meetings ?? []
    for (const meeting of meetings) {
      const row = rows.find((r) => !used.has(r.id) && sameWhen(r, meeting))
      if (!row) {
        result.missing.push({ session, meeting })
        continue
      }
      used.add(row.id)
      if (isApproximate(row)) result.marked++
      else result.mark.push(row.id)
    }
  }
  for (const meetings of plan.newSessions)
    for (const meeting of meetings) result.missing.push({ session: null, meeting })
  for (const s of stored)
    for (const row of s.meetings)
      if (!used.has(row.id)) result.other.push({ session: s.id, meeting: row })
  return result
}
