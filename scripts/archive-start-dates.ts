/**
 * ADR 0011, before the fill: which start dates and lengths found on the old
 * site (`docs/research/2026-11-course-start-dates.json`) go into a course's
 * old `schedule`, so the fill gives its weekly times real meetings. Pure;
 * `apply-archive-start-dates.ts` loads, calls this and writes. Delete with
 * the old fields.
 */

/** One course of the research JSON, the fields this reads. */
export type ResearchEntry = {
  id: number
  cycle: string
  confidence: 'high' | 'medium' | 'low' | 'none'
  /** A slot weekday: for a week-only page, the first slot weekday in that week. */
  start_date: string | null
  weekday_matches_slot?: boolean | null
  slots: unknown[]
  length: { weeks?: number; meetings?: number; weeks_range?: [number, number] } | null
}

/** What the course's old schedule holds today. */
export type CurrentSchedule = { start_date: string | null; weeks: number | null }

export type Decision =
  | {
      id: number
      dated: true
      start_date: string
      weeks: number
      /** Only the fields the course is missing; a value a person typed stays. */
      writes: { start_date?: string; weeks?: number }
      /** Research values that differ from what the course holds (the course wins). */
      differs: string[]
    }
  | { id: number; dated: false; reason: string }

/**
 * Low-confidence cycles the user accepted anyway. Alexandria winter 2020: the
 * English and Arabic term texts disagree; the user chose the English one
 * (week of 30 January, 11 weeks), which the JSON holds as `start_date`.
 */
export const ACCEPTED_LOW_CYCLES: readonly string[] = ['winter-2020-alexandria']

const accepted = (e: ResearchEntry) =>
  e.confidence === 'high' ||
  e.confidence === 'medium' ||
  (e.confidence === 'low' && ACCEPTED_LOW_CYCLES.includes(e.cycle))

/**
 * Weeks, or a meeting count that fills whole weeks of slots. A range or
 * nothing is no length: guessing one would invent meetings.
 */
const weeksOf = (e: ResearchEntry): number | string => {
  const { weeks, meetings, weeks_range } = e.length ?? {}
  if (weeks) return weeks
  const perWeek = e.slots.length || 1
  if (meetings && meetings % perWeek === 0) return meetings / perWeek
  if (meetings) return `${meetings} meetings do not fill whole weeks of ${perWeek} slots`
  if (weeks_range) return `length is a range (${weeks_range.join(' to ')} weeks)`
  return 'no length found'
}

export const decideStartDate = (e: ResearchEntry, now: CurrentSchedule): Decision => {
  const skip = (reason: string): Decision => ({ id: e.id, dated: false, reason })
  if (!accepted(e)) return skip(`confidence ${e.confidence}`)
  if (!e.start_date) return skip('no start date found')
  if (e.weekday_matches_slot === false) return skip('start date is not a slot weekday')
  const weeks = weeksOf(e)
  if (typeof weeks === 'string') return skip(weeks)

  const differs = [
    now.start_date && now.start_date !== e.start_date
      ? `start ${now.start_date} kept (research ${e.start_date})`
      : null,
    now.weeks && now.weeks !== weeks ? `weeks ${now.weeks} kept (research ${weeks})` : null,
  ].filter((d): d is string => !!d)
  return {
    id: e.id,
    dated: true,
    start_date: now.start_date ?? e.start_date,
    weeks: now.weeks ?? weeks,
    writes: {
      ...(now.start_date ? {} : { start_date: e.start_date }),
      ...(now.weeks ? {} : { weeks }),
    },
    differs,
  }
}
