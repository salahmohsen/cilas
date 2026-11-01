import { WEEKDAYS, addDays, cairoDay, weekdayOf } from '@/lib/cairo-day'

/** One bar or point on a dashboard chart: a Cairo day, or the week that starts on it. */
export type TimePoint = {
  /** `YYYY-MM-DD`; for a week, its first day. */
  key: string
  /** The full label, for screen readers and tooltips. */
  label: string
  /** The short label under the point; left out to keep the axis quiet. */
  axisLabel?: string
  value: number
}

type Stamp = string | Date | null | undefined

const full = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const short = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

const at = (day: string) => new Date(`${day}T00:00:00Z`)

/** The Cairo days ending today, oldest first. */
const daysEnding = (count: number, now: Date): string[] => {
  const today = cairoDay(now) as string
  return Array.from({ length: count }, (_, i) => addDays(today, i + 1 - count))
}

/** Egypt's week starts on Saturday. */
const weekStart = (day: string) => addDays(day, -WEEKDAYS.indexOf(weekdayOf(day)))

const tally = (stamps: Stamp[], keyOf: (day: string) => string) => {
  const counts = new Map<string, number>()
  for (const stamp of stamps) {
    const day = stamp ? cairoDay(stamp) : null
    if (day) counts.set(keyOf(day), (counts.get(keyOf(day)) ?? 0) + 1)
  }
  return counts
}

/** Timestamps counted per Cairo day over the last `days` days. Empty days stay as zeros. */
export const bucketByDay = (stamps: Stamp[], days: number, now = new Date()): TimePoint[] => {
  const counts = tally(stamps, (day) => day)
  return daysEnding(days, now).map((key) => ({
    key,
    label: full.format(at(key)),
    axisLabel: short.format(at(key)),
    value: counts.get(key) ?? 0,
  }))
}

/** Timestamps counted per week (Saturday to Friday) over the last `weeks` weeks. */
export const bucketByWeek = (stamps: Stamp[], weeks: number, now = new Date()): TimePoint[] => {
  const counts = tally(stamps, weekStart)
  const current = weekStart(cairoDay(now) as string)
  return Array.from({ length: weeks }, (_, i) => addDays(current, (i + 1 - weeks) * 7)).map(
    (key) => ({
      key,
      label: `Week of ${short.format(at(key))}`,
      axisLabel: short.format(at(key)),
      value: counts.get(key) ?? 0,
    }),
  )
}

export const totalOf = (points: Pick<TimePoint, 'value'>[]) =>
  points.reduce((sum, point) => sum + point.value, 0)

/** "+20%" or "-8%". Null when there is no earlier figure to compare with. */
export const percentChange = (current: number, previous: number): string | null => {
  if (previous <= 0) return null
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change > 0 ? '+' : ''}${change}%`
}

/** The last `days` days against the `days` before them. */
export const periodChange = (stamps: Stamp[], days: number, now = new Date()): string | null => {
  const points = bucketByDay(stamps, days * 2, now)
  return percentChange(totalOf(points.slice(days)), totalOf(points.slice(0, days)))
}

/** How many items share each key. Items without a key are skipped. */
export const countBy = <T>(items: T[], keyOf: (item: T) => string | null | undefined) => {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = keyOf(item)
    if (key) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/** Keeps an axis label on every `every`th point, counted back from the newest. */
export const thinAxis = (points: TimePoint[], every: number): TimePoint[] =>
  points.map((point, i) =>
    (points.length - 1 - i) % every === 0 ? point : { ...point, axisLabel: undefined },
  )
