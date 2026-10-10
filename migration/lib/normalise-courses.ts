import { slugify } from '../../src/lib/slugify'
import type { ExtractedCourse } from './extraction-schema'

type Season = 'fall' | 'winter' | 'spring' | 'summer'
const TRIMESTER: Record<string, Season> = { first: 'fall', second: 'winter', third: 'spring' }

/** Season and start year from an old file name, or null if it says nothing usable. */
export const cycleFromFile = (file: string): { season: Season; start_year: number } | null => {
  const name = file.replace(/\.html$/, '').replace(/(\d{4})1$/, '$1') // "20221" duplicates
  const trimester = /^(\d{4})-(\d{4})-(first|second|third)-trimester/.exec(name)
  if (trimester) {
    const season = TRIMESTER[trimester[3]]
    return { season, start_year: Number(season === 'fall' ? trimester[1] : trimester[2]) }
  }
  const named = /(fall|winter|spring|summer)\D*?(\d{4})(?:-(\d{4}))?$/.exec(name)
  if (!named) return null
  const season = named[1] as Season
  const year = Number(named[3] && season !== 'fall' ? named[3] : named[2])
  return { season, start_year: year }
}

const SPACES = {
  'darb el-labbana': 'Darb el-Labbana',
  'al-ghuria': 'al-Ghuria',
  'al-manshiya': 'al-Manshiya',
} as const

/** The space a cycle met in: as the page says, else Alexandria by name, else a flagged default. */
export const spaceOf = (
  hint: string | null,
  file: string,
  title: string,
): { space: string; guessed: boolean } => {
  if (hint && hint in SPACES) return { space: SPACES[hint as keyof typeof SPACES], guessed: false }
  if (/alex/i.test(file) || /alex/i.test(title)) return { space: 'al-Manshiya', guessed: false }
  return { space: 'Darb el-Labbana', guessed: true }
}

/** The course's own old page if it had one, else a fragment of the page that listed it. */
export const courseLegacyUrl = (pageUrl: string, course: ExtractedCourse): string => {
  const own = course.own_page?.replace(/^https?:\/\/(www\.)?ci-las\.org\//, '').replace(/^\//, '')
  if (own && /^[^/:?#]+\.html$/.test(own)) return `/${own}`
  return `${pageUrl.split('#')[0]}#${slugify(course.title)}`
}

/** The schedule pattern (ADR 0002) from an extraction; unknowns stay out. */
export const scheduleOf = (course: ExtractedCourse) => {
  const timed = course.start_time && course.end_time
  return {
    ...(course.start_date ? { start_date: course.start_date } : {}),
    start_precision: 'day' as const,
    ...(course.weeks ? { weeks: course.weeks } : {}),
    slots: timed
      ? course.weekdays.map((weekday) => ({
          weekday,
          start_time: course.start_time as string,
          end_time: course.end_time as string,
        }))
      : [],
    ...(course.schedule_text ? { note: course.schedule_text } : {}),
  }
}

const fold = (name: string): string =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** One spelling per person: aliases first, then a tidy form of the name as written. */
export const canonicalName = (name: string, aliases: Record<string, string[]>): string => {
  const key = fold(name)
  for (const [canonical, variants] of Object.entries(aliases)) {
    if ([canonical, ...variants].some((v) => fold(v) === key)) return canonical
  }
  return name.replace(/\s+/g, ' ').trim()
}

/** True when more than half the letters are Arabic. */
export const isMostlyArabic = (text: string): boolean => {
  const letters = text.match(/\p{L}/gu) ?? []
  const arabic = letters.filter((c) => /\p{Script=Arabic}/u.test(c)).length
  return letters.length > 0 && arabic / letters.length > 0.5
}
