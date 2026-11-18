/**
 * ADR 0011 go-live on production: fills the sessions collection from each
 * course's old schedule and sessions array, as the fill did on the local copy.
 * The 2026-11-18 deploy ran the migrations, but no fill ran, so production had
 * no sessions.
 *
 *   pnpm tsx scripts/restore-prod-sessions.ts --target <host:port/db> --out <dir>            dry run
 *   pnpm tsx scripts/restore-prod-sessions.ts --target <host:port/db> --out <dir> --apply    writes
 *
 * - `--target` must name the database `DATABASE_URL` connects to, or the run stops.
 * - The start dates and lengths from the old site (`archive-start-dates.ts`)
 *   go into the plan in memory. The courses' old `schedule` group is not
 *   written, so no course field changes. The session hooks write only the
 *   course's derived `first_day` and `last_day`.
 * - Text is tidied (`tidy`): titles on one line, no empty list items, and
 *   each text in the input of its own language. The report lists each fix.
 * - A course that has sessions is skipped, so a second run adds nothing.
 *   Each course is written in one transaction. Nothing is deleted.
 * - Writes `dry-run.md` (or `apply.md`), `plan.json` and `map.json` to `--out`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createLocalReq, getPayload } from 'payload'

import config from '../src/payload.config'
import { inTransaction } from '../src/lib/in-transaction'
import { decideStartDate, type ResearchEntry } from './archive-start-dates'
import { planCourseSessions, type Localized, type PlannedSession } from './course-sessions-plan'
import { lexicalToMarkdown } from './course-sessions-markdown'
import { loadCourseSources, type CourseSource } from './course-sessions-source'
import { writePlannedSessions } from './course-sessions-write'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const apply = process.argv.includes('--apply')
const target = arg('--target')
const outArg = arg('--out')
if (!target || !outArg) throw new Error('Give --target <host:port/db> and --out <dir>.')
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const url = new URL(process.env.DATABASE_URL ?? '')
const connected = `${url.hostname}:${url.port || '5432'}${url.pathname}`
if (connected !== target)
  throw new Error(`DATABASE_URL names ${connected}, not --target ${target}.`)

const payload = await getPayload({ config })
const toMarkdown = await lexicalToMarkdown(payload)
const {
  rows: [where],
} = await payload.db.pool.query<{ db: string }>('SELECT current_database() AS db')
if (`/${where!.db}` !== url.pathname) throw new Error(`Connected to ${where!.db}.`)

const research: ResearchEntry[] = JSON.parse(
  readFileSync('docs/research/2026-11-course-start-dates.json', 'utf8'),
)
const researchOf = new Map(research.map((e) => [e.id, e]))

/** The old site's start date and length, for the fields the course is missing. */
const withArchiveDates = (source: CourseSource['source']): CourseSource['source'] => {
  const entry = researchOf.get(source.id)
  const schedule = source.schedule ?? {}
  if (!entry) return source
  const decision = decideStartDate(entry, {
    start_date: schedule.start_date?.slice(0, 10) ?? null,
    weeks: schedule.weeks ?? null,
  })
  if (!decision.dated) return source
  const { start_date, weeks } = decision.writes
  return {
    ...source,
    schedule: {
      ...schedule,
      ...(start_date && { start_date: `${start_date}T00:00:00.000Z`, start_precision: 'day' }),
      ...(weeks && { weeks }),
    },
  }
}

const ARABIC = /[\u0600-\u06FF]/
const LATIN = /[A-Za-z]/

/**
 * Text in the language input it is written in. English text alone in the
 * Arabic input moves to the English one; a copy of the same text in both
 * inputs stays only in its own language (Arabic reads English as fallback).
 */
const placed = (value: Localized<string>, fixes: string[], what: string): Localized<string> => {
  const en = value?.en || null
  const ar = value?.ar || null
  const arabic = (t: string | null) =>
    !!t && ARABIC.test(t) && !LATIN.test(t.replace(/\[[^\]]*\]\([^)]*\)/g, ''))
  const english = (t: string | null) => !!t && !ARABIC.test(t)
  if (!en && english(ar)) {
    fixes.push(`${what}: English text moved from the Arabic input to the English one`)
    return { en: ar, ar: null }
  }
  if (!ar && arabic(en)) {
    fixes.push(`${what}: Arabic text moved from the English input to the Arabic one`)
    return { en: null, ar: en }
  }
  if (en && en === ar) {
    fixes.push(
      `${what}: the same text in both inputs kept only in ${arabic(en) ? 'Arabic' : 'English'}`,
    )
    return arabic(en) ? { en: null, ar } : { en, ar: null }
  }
  return value && { en, ar }
}

const oneLine = (t: string | null | undefined) => t?.replace(/\s+/g, ' ').trim() || null
/** Markdown with no empty list items, at most one blank line in a row. */
const cleanMarkdown = (t: string | null | undefined) =>
  t
    ?.replace(/^[ \t]*([-*+]|\d+\.)[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null

const tidy = (s: PlannedSession, fixes: string[]): PlannedSession => {
  const n = `session ${s.position + 1}`
  const description = {
    en: cleanMarkdown(s.description?.en),
    ar: cleanMarkdown(s.description?.ar),
  }
  if (
    description.en !== (s.description?.en ?? null) ||
    description.ar !== (s.description?.ar ?? null)
  )
    fixes.push(`${n} description: empty list items or blank lines removed`)
  return {
    ...s,
    title: placed(
      s.title && { en: oneLine(s.title.en), ar: oneLine(s.title.ar) },
      fixes,
      `${n} title`,
    ),
    description: placed(description, fixes, `${n} description`),
  }
}

const HTML = /<\/?[a-z][^>]*>|&(nbsp|amp|lt|gt|quot|#\d+);/i
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** What a reader would see as wrong in one course's planned sessions. */
const problemsOf = (sessions: PlannedSession[]): string[] => {
  const found: string[] = []
  const seen = new Set<string>()
  sessions.forEach((s, i) => {
    const n = `session ${i + 1}`
    for (const [field, value] of [
      ['title', s.title],
      ['description', s.description],
    ] as const) {
      if (HTML.test(`${value?.en ?? ''} ${value?.ar ?? ''}`)) found.push(`${n}: HTML in ${field}`)
      if (value?.en && ARABIC.test(value.en) && !LATIN.test(value.en))
        found.push(`${n}: Arabic only in the English ${field}`)
      if (value?.ar && LATIN.test(value.ar) && !ARABIC.test(value.ar))
        found.push(`${n}: no Arabic in the Arabic ${field}`)
    }
    if (s.position !== i) found.push(`${n}: position ${s.position}`)
    for (const m of s.meetings) {
      if (!DAY.test(m.date)) found.push(`${n}: day ${m.date}`)
      const timed = m.start_time || m.end_time
      if (timed && !(TIME.test(m.start_time ?? '') && TIME.test(m.end_time ?? '')))
        found.push(`${n}: times ${m.start_time}-${m.end_time}`)
      if (timed && m.start_time! >= m.end_time!) found.push(`${n}: ends before it starts`)
      const key = `${m.date} ${m.start_time ?? ''}`
      if (seen.has(key)) found.push(`${n}: second meeting at ${key}`)
      seen.add(key)
    }
  })
  return found
}

type Line = {
  id: number
  slug: string
  fromDraft: boolean
  archiveDates: boolean
  planned: number
  meetings: number
  present: number
  action: 'add' | 'present' | 'conflict' | 'none'
  problems: string[]
  fixes: string[]
}

const sources = await loadCourseSources(payload)
const { docs: slugs } = await payload.find({
  collection: 'courses',
  depth: 0,
  pagination: false,
  draft: false,
  overrideAccess: true,
  select: { slug: true },
})
const slugOf = new Map(slugs.map((c) => [c.id, c.slug ?? '']))
const { rows: present } = await payload.db.pool.query<{ course: number; n: string }>(
  'SELECT course_id AS course, count(*) AS n FROM sessions GROUP BY course_id',
)
const presentOf = new Map(present.map((r) => [r.course, Number(r.n)]))

const lines: Line[] = []
const plans: Record<number, PlannedSession[]> = {}
const map: Record<string, number> = {}
for (const { course, source, fromDraft } of sources) {
  const dated = withArchiveDates(source)
  const fixes: string[] = []
  const sessions = planCourseSessions(dated, toMarkdown).sessions.map((s) => tidy(s, fixes))
  const has = presentOf.get(course.id) ?? 0
  const action = !sessions.length
    ? 'none'
    : has === 0
      ? 'add'
      : has === sessions.length
        ? 'present'
        : 'conflict'
  plans[course.id] = sessions
  lines.push({
    id: course.id,
    slug: slugOf.get(course.id) ?? '',
    fromDraft,
    archiveDates: dated !== source,
    planned: sessions.length,
    meetings: sessions.reduce((n, s) => n + s.meetings.length, 0),
    present: has,
    action,
    problems: problemsOf(sessions),
    fixes,
  })
  if (!apply || action !== 'add') continue
  const req = await createLocalReq({}, payload)
  const made = await inTransaction(req, () =>
    writePlannedSessions(payload, req, course.id, sessions),
  )
  for (const [from, id] of made) if (from) map[from] = id
  console.log(`course ${course.id}: ${made.length} sessions`)
}

const sum = (pick: (l: Line) => number, of = lines) => of.reduce((n, l) => n + pick(l), 0)
const added = lines.filter((l) => l.action === 'add')
const sample = added
  .filter((l) => l.planned && l.meetings)
  .filter((_, i, all) => i % Math.max(1, Math.floor(all.length / 10)) === 0)
  .slice(0, 10)
const cell = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '(empty)'
    : String(typeof v === 'string' ? v : JSON.stringify(v))
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ⏎ ')
        .slice(0, 160)
const sourceById = new Map(sources.map((s) => [s.course.id, s.source]))

const report = [
  `# Session restore: ${apply ? 'apply' : 'dry run'}`,
  '',
  `Database: ${connected}. Run at ${new Date().toISOString()}.`,
  '',
  '## Totals',
  '',
  `- Courses: ${lines.length}. To add: ${added.length}. Already present: ${lines.filter((l) => l.action === 'present').length}. Conflicts: ${lines.filter((l) => l.action === 'conflict').length}. No sessions in the old data: ${lines.filter((l) => l.action === 'none').length}.`,
  `- Sessions to add: ${sum((l) => l.planned, added)}. Meetings to add: ${sum((l) => l.meetings, added)}. Untitled sessions (pattern meetings no row held): ${added.reduce((n, l) => n + plans[l.id]!.filter((s) => !s.from).length, 0)}.`,
  `- Courses read from a pending draft: ${
    lines
      .filter((l) => l.fromDraft)
      .map((l) => l.id)
      .join(', ') || 'none'
  }.`,
  `- Courses dated from the old site in memory: ${lines.filter((l) => l.archiveDates).length} (${lines
    .filter((l) => l.archiveDates)
    .map((l) => l.id)
    .join(', ')}).`,
  `- Quality problems left: ${sum((l) => l.problems.length)}. Fixes made: ${sum((l) => l.fixes.length)}.`,
  '',
  '## Quality problems',
  '',
  ...lines.flatMap((l) => l.problems.map((p) => `- Course ${l.id} (${l.slug}): ${p}`)),
  '',
  '## Fixes made to the old text',
  '',
  ...lines.flatMap((l) => l.fixes.map((f) => `- Course ${l.id} (${l.slug}), ${f}`)),
  '',
  '## Sample sessions, field by field',
  '',
  ...sample.flatMap((l) => {
    const s = plans[l.id]!.find((x) => x.from && x.meetings.length) ?? plans[l.id]![0]!
    const row = sourceById.get(l.id)?.sessions?.find((r) => r.id === s.from)
    const sched = sourceById.get(l.id)?.schedule
    return [
      `### Course ${l.id} (${l.slug}), session ${s.position + 1}`,
      '',
      '| Input | Source value | Target value |',
      '| --- | --- | --- |',
      `| course | ${l.id} / ${cell(l.slug)} | ${l.id} |`,
      `| title (en) | ${cell(row?.session_title?.en)} | ${cell(s.title?.en)} |`,
      `| title (ar) | ${cell(row?.session_title?.ar)} | ${cell(s.title?.ar)} |`,
      `| description (en) | Lexical rich text | ${cell(s.description?.en)} |`,
      `| description (ar) | Lexical rich text | ${cell(s.description?.ar)} |`,
      `| delivery | ${cell(row?.delivery)} | ${cell(s.delivery)} |`,
      `| cancelled | ${cell(row?.cancelled)} | ${s.cancelled} |`,
      `| meetings | schedule ${cell(sched?.start_date?.slice(0, 10))}, ${cell(sched?.weeks)} weeks, slots ${cell(sched?.slots?.map((x) => `${x.weekday} ${x.start_time}-${x.end_time}`).join(', '))} | ${s.meetings.map((m) => `${m.date} ${m.start_time}-${m.end_time}`).join(', ')} (Africa/Cairo wall time) |`,
      `| position | row order ${cell(row?.order)} | ${s.position} |`,
      '',
    ]
  }),
  '## Per course',
  '',
  '| Course | Slug | Action | Planned sessions | Meetings | Present | Draft | Archive dates |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...lines.map(
    (l) =>
      `| ${l.id} | ${l.slug} | ${l.action} | ${l.planned} | ${l.meetings} | ${l.present} | ${l.fromDraft ? 'yes' : ''} | ${l.archiveDates ? 'yes' : ''} |`,
  ),
  '',
].join('\n')

writeFileSync(join(out, apply ? 'apply.md' : 'dry-run.md'), report)
writeFileSync(join(out, 'plan.json'), `${JSON.stringify(plans, null, 1)}\n`)
if (apply) writeFileSync(join(out, 'map.json'), `${JSON.stringify(map, null, 2)}\n`)
console.log(
  JSON.stringify({
    apply,
    database: connected,
    add: added.length,
    sessions: sum((l) => l.planned, added),
    meetings: sum((l) => l.meetings, added),
    conflicts: lines.filter((l) => l.action === 'conflict').map((l) => l.id),
    problems: sum((l) => l.problems.length),
  }),
)
process.exit(0)
