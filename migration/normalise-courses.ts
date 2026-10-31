/**
 * Stage 3: migration/extracted/*.json → seed/data/archive/{cycles,courses}.json
 * and migration/review/courses.md (every guess, for a person to check).
 *
 *   npx tsx migration/normalise-courses.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { CoursePage, type ExtractedCourse } from './lib/extraction-schema'
import {
  canonicalName,
  courseLegacyUrl,
  cycleFromFile,
  scheduleOf,
  spaceOf,
} from './lib/normalise-courses'

const here = import.meta.dirname
const root = path.join(here, '..')
const aliases = JSON.parse(readFileSync(path.join(here, 'aliases.json'), 'utf8')) as Record<
  string,
  string[]
>
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: Array<{ file: string; legacy_url: string; title: string }>
}
const pageOf = new Map(pages.map((p) => [p.file, p]))

// Pages whose extraction set `location` without the page saying so.
const LOCATION_GUESSED = new Set([
  'pedagogy-and-sustainable-architecture.html',
  'performing-fiction.html',
  'philosophy-of-education.html',
  'physics-for-poets.html',
  'poetry-and-prose.html',
  'politics--poetics-of-identities.html',
  'portray-women-and-representation-in-the-middle-east.html',
  'postcolonialism.html',
  'power-and-space-critical-approaches-to-the-built-environment.html',
  'public-policy-making--design-thinking.html',
  'quality-time-with-kierkegaard.html',
])

type Cycle = {
  key: string
  season: string
  start_year: number
  start_date?: string
  deadline?: string
  space: string
  legacy_url: string
}
type Course = {
  legacy_url: string
  cycle: string | null
  title: string
  title_ar: string | null
  subtitle: string | null
  course_type: ExtractedCourse['course_type']
  fellows: Array<{ name: string; email: string | null; bio: string | null }>
  location: ExtractedCourse['location']
  schedule: ReturnType<typeof scheduleOf>
  description: string
  flow_uploads: string[]
  register_url: string | null
  epigraph?: string
  epigraph_ar?: string
}

const cycles = new Map<string, Cycle>()
const courses = new Map<string, Course>()
const review: string[] = []

const toCourse = (pageUrl: string, c: ExtractedCourse, cycle: string | null): Course => ({
  legacy_url: courseLegacyUrl(pageUrl, c),
  cycle,
  title: c.title.trim(),
  title_ar: c.title_ar,
  subtitle: c.subtitle,
  course_type: c.course_type,
  fellows: c.fellows.map((f) => ({ ...f, name: canonicalName(f.name, aliases) })),
  location: c.location,
  schedule: scheduleOf(c),
  description: c.description.trim(),
  flow_uploads: c.flow_links.filter((l) => /uploads\//.test(l)),
  register_url: c.register_url,
})

// Fill gaps in `base` from `extra` without overwriting what base has.
const merge = (base: Course, extra: Course): Course => {
  const out = { ...base }
  for (const [k, v] of Object.entries(extra) as Array<[keyof Course, Course[keyof Course]]>) {
    const value = out[k]
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0)
    if (empty) (out as Record<string, unknown>)[k] = v
  }
  return out
}

const files = readdirSync(path.join(here, 'extracted')).filter((f) => f.endsWith('.json'))

// Cycle pages first, so course pages merge into the cycle they were listed under.
const parsed = files
  .map((f) => {
    const file = f.replace(/\.json$/, '')
    const data = CoursePage.parse(
      JSON.parse(readFileSync(path.join(here, 'extracted', f), 'utf8')).data,
    )
    return { file, page: pageOf.get(file), data }
  })
  .sort((a, b) => Number(Boolean(a.data.course)) - Number(Boolean(b.data.course)))

for (const { file, page, data } of parsed) {
  const pageUrl = page?.legacy_url ?? `/${file}`
  for (const c of data.cycles) {
    const fromName = cycleFromFile(file)
    // A file name with a season and a year pair ("winter-cycle-2022-2023")
    // decides: winter counts by its January year, whatever month it opened.
    const named = fromName && /\d{4}-\d{4}/.test(file) && data.cycles.length === 1 ? fromName : null
    const season = named?.season ?? c.season ?? fromName?.season
    const start_year =
      named?.start_year ??
      (c.start_date ? Number(c.start_date.slice(0, 4)) : (c.start_year ?? fromName?.start_year))
    if (!season || !start_year) {
      review.push(
        `- ${pageUrl}: cycle "${c.label}" has no season or year; its ${c.courses.length} course(s) were skipped`,
      )
      continue
    }
    const { space, guessed } = spaceOf(c.space_hint, file, page?.title ?? '', season, start_year)
    if (guessed)
      review.push(
        `- ${pageUrl}: ${season} ${start_year} placed at ${space} by date (no venue on the page)`,
      )
    const key = `${season}-${start_year}-${space}`
    if (!cycles.has(key)) {
      cycles.set(key, {
        key,
        season,
        start_year,
        ...(c.start_date ? { start_date: c.start_date } : {}),
        ...(c.deadline ? { deadline: c.deadline } : {}),
        space,
        legacy_url: data.cycles.length > 1 ? `${pageUrl}#${season}-${start_year}` : pageUrl,
      })
    }
    for (const ec of c.courses) {
      const course = toCourse(pageUrl, ec, key)
      const existing = courses.get(course.legacy_url)
      courses.set(course.legacy_url, existing ? merge(existing, course) : course)
    }
  }
  if (data.course) {
    const extracted = LOCATION_GUESSED.has(file) ? { ...data.course, location: [] } : data.course
    if (LOCATION_GUESSED.has(file) && data.course.location.length) {
      review.push(
        `- ${pageUrl}: location "${data.course.location.join(', ')}" was guessed by the extractor and dropped; set it if known`,
      )
    }
    const course = toCourse(pageUrl, { ...extracted, own_page: page?.file ?? null }, null)
    const listed = courses.get(course.legacy_url)
    if (listed) {
      courses.set(course.legacy_url, merge(course, listed)) // the course page wins
    } else {
      review.push(
        `- ${pageUrl}: course "${course.title}" is not listed on any cycle page; it has no cycle`,
      )
      courses.set(course.legacy_url, course)
    }
  }
}

// Editorial corrections (migration/course-overrides.json): a cycle the
// archive lacks, and fields a course's page got wrong. Each entry says why.
const overrides = JSON.parse(readFileSync(path.join(here, 'course-overrides.json'), 'utf8')) as {
  cycles: Array<Cycle & { $why?: string }>
  courses: Record<
    string,
    Partial<Course> & { $why?: string; schedule?: Partial<Course['schedule']> }
  >
}
for (const { $why: _why, ...cycle } of overrides.cycles) cycles.set(cycle.key, cycle)
for (const [url, { $why: _why, schedule, ...fields }] of Object.entries(overrides.courses)) {
  const course = courses.get(url)
  if (!course) {
    review.push(`- ${url}: an override names a course the archive does not have`)
    continue
  }
  courses.set(url, { ...course, ...fields, schedule: { ...course.schedule, ...schedule } })
}

const orphans = [...courses.values()].filter((c) => !c.cycle)
const outDir = path.join(root, 'seed', 'data', 'archive')
mkdirSync(outDir, { recursive: true })
const sorted = <T extends { legacy_url: string }>(xs: T[]) =>
  xs.sort((a, b) => a.legacy_url.localeCompare(b.legacy_url))
writeFileSync(
  path.join(outDir, 'cycles.json'),
  `${JSON.stringify(sorted([...cycles.values()]), null, 2)}\n`,
)
writeFileSync(
  path.join(outDir, 'courses.json'),
  `${JSON.stringify(sorted([...courses.values()]), null, 2)}\n`,
)
mkdirSync(path.join(here, 'review'), { recursive: true })
writeFileSync(
  path.join(here, 'review', 'courses.md'),
  `# Cycles and courses: to check\n\nGenerated by \`normalise-courses.ts\`. Each line is a guess or a gap.\n\n${review.sort().join('\n')}\n`,
)
console.log(
  `${cycles.size} cycles, ${courses.size} courses (${orphans.length} without a cycle), ${review.length} review note(s)`,
)
