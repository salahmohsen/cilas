import { cairoDay } from '@/lib/cairo-day'

export const SEASONS = ['fall', 'winter', 'spring', 'summer'] as const
export type Season = (typeof SEASONS)[number]

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** "Spring 2026, Cairo": a cycle is one intake per season, year and place (ADR 0003). */
export const cycleTitle = ({
  season,
  start_year,
  place,
}: {
  season: Season
  start_year: number
  place?: string | null
}): string => [`${capitalise(season)} ${start_year}`, place].filter(Boolean).join(', ')

/**
 * The September-to-August year a cycle belongs to, e.g. "2025–2026". The start
 * date decides when it is set; otherwise fall opens a year and the other
 * seasons close one.
 */
export const academicYear = ({
  season,
  start_year,
  start_date,
}: {
  season: Season
  start_year: number
  start_date?: string | null
}): string => {
  const day = start_date ? cairoDay(start_date) : null
  const [year, month] = day ? day.split('-').map(Number) : [start_year, season === 'fall' ? 9 : 1]
  const first = month >= 9 ? year : year - 1
  return `${first}–${first + 1}`
}
