/**
 * ADR 0011, migration step 3: checks the filled sessions against the old
 * course data, for every course. Reads only.
 *
 *   pnpm tsx scripts/verify-course-sessions.ts [--map path/to/map.json]
 *
 * - Meetings: the new `meetingsOf` equals today's `expandSchedule`, meeting
 *   by meeting (day, times, cancelled), and each meeting sits in the session
 *   made from the old row that held it, or in a new untitled one when no row
 *   held it. A course with a start date and no meeting expects one all-day
 *   meeting on that day.
 * - Content: each old row's session has the same title, delivery, cancelled,
 *   materials and activities, and its description as Markdown.
 * - The course's timing note (on the course and its latest version), first
 *   day and last day.
 *
 * It reads each course as the fill did (`loadCourseSources`): a published
 * course with a newer pending draft is checked against the draft.
 *
 * Lists every new untitled session. Exits non-zero on any other difference.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { byWhen, firstDay, lastDay, meetingsOf, sessionsInOrder } from '../src/lib/meetings'
import { expandSchedule, sessionsInOrder as rowsInOrder } from '../src/lib/schedule'
import type { Session } from '../src/payload-types'
import { planCourseSessions, type Localized, type OldRow } from './course-sessions-plan'
import { lexicalToMarkdown } from './course-sessions-markdown'
import { loadCourseSources } from './course-sessions-source'

const i = process.argv.indexOf('--map')
const mapPath = resolve(i === -1 ? 'course-sessions-map.json' : process.argv[i + 1]!)
const map: Record<string, number> = JSON.parse(readFileSync(mapPath, 'utf8'))

const payload = await getPayload({ config })
const toMarkdown = await lexicalToMarkdown(payload)

type Row = Record<string, unknown>

/** Missing, undefined and null are the same; so are the two languages' absent values. */
const clean = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value ?? null, (_, v) => (v === undefined ? null : v)))
const same = (a: unknown, b: unknown): boolean => {
  try {
    assert.deepEqual(clean(a), clean(b))
    return true
  } catch {
    return false
  }
}
const both = <T>(value: Localized<T>) => ({ en: value?.en ?? null, ar: value?.ar ?? null })
const markdown = (value: Localized<unknown>) => ({
  en: value?.en ? toMarkdown(value.en).trim() || null : null,
  ar: value?.ar ? toMarkdown(value.ar).trim() || null : null,
})
/**
 * The words alone, so a lossy conversion shows. Both sides lose escapes,
 * block markers (headings, list items) and whitespace: a Lexical paragraph
 * that starts "- " by hand becomes a Markdown list item, with the same words.
 */
type LexicalNode = { text?: string; children?: LexicalNode[] }
const lexicalText = (node: LexicalNode | undefined): string =>
  (node?.text ?? '') + (node?.children ?? []).map(lexicalText).join('\n')
const words = (text: string) =>
  text
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.|#{1,6})(?=\s|$)/gm, '')
    .replace(/\s+/g, '')
const lostWords = (old: Localized<unknown>, now: Localized<string>) =>
  (['en', 'ar'] as const).filter(
    (locale) =>
      words(lexicalText((old?.[locale] as { root?: LexicalNode } | null)?.root)) !==
      words(now?.[locale] ?? ''),
  )
const materials = (list: unknown) =>
  ((list as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    title: both(r.title as Localized<string>),
    href: r.href ?? null,
    note: both(r.note as Localized<string>),
  }))
const activities = (list: unknown) =>
  ((list as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    description: both(r.description as Localized<string>),
  }))

type Entry = {
  date: string
  start_time: string | null
  end_time: string | null
  cancelled: boolean
  // The new session's ID, or 'untitled' for a session no old row became.
  owner: number | 'untitled'
}
const sorted = (list: Entry[]) =>
  [...list].sort((a, b) => byWhen(a, b) || String(a.owner).localeCompare(String(b.owner)))

const differences: string[] = []
const untitled: Array<{ course: number; session: number; meetings: string[] }> = []

const courses = await loadCourseSources(payload)

for (const { course, source, latest } of courses) {
  const fail = (message: string) => differences.push(`Course ${course.id}: ${message}`)
  const rows: OldRow[] = rowsInOrder(source.sessions ?? [])
  const plan = planCourseSessions(source, toMarkdown)
  const sessions = (
    await payload.find({
      collection: 'sessions',
      where: { course: { equals: course.id } },
      locale: 'all',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs as unknown as Session[]

  const mapped = new Set(rows.map((r) => map[r.id]).filter((id) => id !== undefined))
  const ownerOfRow = (row: OldRow | undefined): Entry['owner'] =>
    row ? (map[row.id] ?? -1) : 'untitled'

  // Meetings.
  const expected: Entry[] = plan.startDay
    ? [
        {
          date: plan.startDay,
          start_time: null,
          end_time: null,
          cancelled: false,
          owner: ownerOfRow(rows[0]),
        },
      ]
    : expandSchedule(source.schedule, source.sessions).map((m) => ({
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        cancelled: !!m.cancelled,
        owner: m.session === undefined ? 'untitled' : ownerOfRow(rows[m.session - 1]),
      }))
  const ordered = sessionsInOrder(sessions)
  const actual: Entry[] = meetingsOf(sessions).map((m) => {
    const id = ordered[m.session - 1]!.id
    return {
      date: m.date,
      start_time: m.start_time ?? null,
      end_time: m.end_time ?? null,
      cancelled: !!m.cancelled,
      owner: mapped.has(id) ? id : 'untitled',
    }
  })
  const [want, got] = [sorted(expected), sorted(actual)]
  const at = want.findIndex((w, n) => !same(w, got[n]))
  if (want.length !== got.length || at !== -1)
    fail(
      `meetings differ (${want.length} expected, ${got.length} found); first: expected ${JSON.stringify(want[at] ?? null)}, found ${JSON.stringify(got[at === -1 ? want.length : at] ?? null)}`,
    )

  // Sessions: one per old row, plus the untitled ones the plan needs.
  const extra = sessions.filter((s) => !mapped.has(s.id))
  const plannedExtra = plan.sessions.filter((s) => !s.from).length
  if (sessions.length !== plan.sessions.length || extra.length !== plannedExtra)
    fail(
      `${sessions.length} sessions (${extra.length} untitled), expected ${plan.sessions.length} (${plannedExtra} untitled)`,
    )
  for (const s of extra)
    untitled.push({
      course: course.id,
      session: s.id,
      meetings: (s.meetings ?? []).map((m) =>
        [m.date, m.start_time, m.end_time].filter(Boolean).join(' '),
      ),
    })

  // Content.
  const byId = new Map(sessions.map((s) => [s.id, s]))
  for (const row of rows) {
    const session = byId.get(map[row.id] ?? -1)
    if (!session) {
      fail(`old row ${row.id} has no session in this course`)
      continue
    }
    const s = session as unknown as Row
    const checks: Array<[string, unknown, unknown]> = [
      ['title', both(row.session_title), both(s.title as Localized<string>)],
      ['description', markdown(row.description), both(s.description as Localized<string>)],
      ['delivery', row.delivery ?? null, s.delivery ?? null],
      ['cancelled', !!row.cancelled, !!s.cancelled],
      ['bibliography', materials(row.bibliography), materials(s.bibliography)],
      ['activities', activities(row.activities), activities(s.activities)],
    ]
    for (const [field, old, now] of checks)
      if (!same(old, now)) fail(`session ${session.id} (row ${row.id}): ${field} differs`)
    for (const locale of lostWords(row.description, s.description as Localized<string>))
      fail(`session ${session.id} (row ${row.id}): description text changed in ${locale}`)
  }

  // The course's own fields.
  if (!same(both(plan.timingNote), both(course.timing_note)))
    fail('timing note differs from the plan')
  if (latest && !same(both(plan.timingNote), both(latest.timing_note)))
    fail(`timing note of the latest version (${latest.id}) differs from the plan`)
  const held = expected.filter((m) => !m.cancelled)
  if ((course.first_day ?? null) !== firstDay(held) || (course.last_day ?? null) !== lastDay(held))
    fail(
      `first/last day ${course.first_day}–${course.last_day}, expected ${firstDay(held)}–${lastDay(held)}`,
    )
}

console.log(
  JSON.stringify(
    { courses: courses.length, untitledSessions: untitled.length, untitled, differences },
    null,
    2,
  ),
)
console.log(differences.length ? `${differences.length} differences` : 'No differences')
process.exit(differences.length ? 1 : 0)
