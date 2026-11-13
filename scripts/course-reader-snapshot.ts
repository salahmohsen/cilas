/**
 * The pure half of `snapshot-course-readers.ts`: the snapshot's shape, how
 * two snapshots differ, and which differences the plan expects
 * (docs/plans/2026-11-13-sessions-readers.md, "Expected changes"). No
 * Payload, no network, so the rules have unit tests.
 */

/** What the plan knows about a course before the readers move. */
export type CourseMeta = {
  slug: string
  /** One of the 37 courses that got its start date from the old site. */
  archiveDated: boolean
  /** One of the 18 undated courses whose times became words in the timing note. */
  undatedWords: boolean
  /** Sessions the fill made that no old row held: untitled, shown as "Session N" or "Week N". */
  newSessions: number
}

/** One run: for each reader, what it gives for each course (by course ID). */
export type Snapshot = {
  label: string
  /** The fixed day passed to every reader that takes one. */
  today: string
  courses: Record<string, CourseMeta>
  readers: Record<string, Record<string, unknown>>
}

export type Verdict = 'EXPECTED' | 'UNEXPECTED'

export type Difference = {
  reader: string
  course: string
  /** The locale or part of the reader's value that differs (`en`, `ar`, or `` for all of it). */
  part: string
  before: unknown
  after: unknown
  verdict: Verdict
  reason: string
}

/** Readers that list, number or count a course's sessions. */
const SESSION_READERS = new Set([
  'page.facts',
  'page.syllabus',
  'llms',
  'calendar.ics',
  'calendar.month',
  'search.syllabus',
  'space.sessionFacts',
  'space.nextSession',
])

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Readers that show the timing note. */
const NOTE_READERS = new Set(['page.note', 'llms'])

/** Readers that showed a start or end date as a raw timestamp (`2019-01-31T00:00:00.000Z`). */
const DAY_READERS = new Set(['llms', 'list.study', 'list.fellows'])

const TIMESTAMP = /^(.*?)(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** A value with each raw timestamp, alone or at the end of a line, cut to its day. */
export const toDays = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(TIMESTAMP, '$1$2')
  if (Array.isArray(value)) return value.map(toDays)
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toDays(v)]))
  return value
}

/** A value as lines: a text's lines, a list's items, a record's fields (each line led by its key). */
const linesOf = (value: unknown): string[] => {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return value ? value.split('\n') : []
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
  if (isRecord(value))
    return Object.entries(value).flatMap(([k, v]) =>
      (Array.isArray(v) || typeof v === 'string' ? linesOf(v) : [JSON.stringify(v)]).map(
        (line) => `${k}: ${line}`,
      ),
    )
  return [JSON.stringify(value)]
}

/**
 * Whether `after` only adds lines to `before`: every line of `before` is
 * still there, unchanged and in the same order, and nothing else differs.
 */
export const onlyAdds = (before: unknown, after: unknown): boolean => {
  const was = linesOf(before)
  const now = linesOf(after)
  let at = 0
  for (const line of now) if (at < was.length && line === was[at]) at++
  return at === was.length && now.length > was.length
}

/**
 * Whether the plan expects `reader` to change from `before` to `after` for
 * this course. Course by course, reader by reader: an archive-dated course
 * may change anywhere; a course with new untitled sessions may gain lines
 * where sessions are listed or counted, and change no line it had; an
 * undated course's note may change only where the note shows.
 */
export const classify = (
  reader: string,
  meta: CourseMeta | undefined,
  before: unknown,
  after: unknown,
): { verdict: Verdict; reason: string } => {
  if (!meta) return { verdict: 'UNEXPECTED', reason: 'course not in the base snapshot' }
  if (meta.archiveDated) return { verdict: 'EXPECTED', reason: 'archive start date (37)' }
  if (meta.newSessions > 0 && SESSION_READERS.has(reader) && onlyAdds(before, after))
    return {
      verdict: 'EXPECTED',
      reason: `${meta.newSessions} new untitled session(s) (389), lines added only`,
    }
  if (meta.undatedWords && NOTE_READERS.has(reader))
    return { verdict: 'EXPECTED', reason: 'weekly times as words in the timing note (18)' }
  return { verdict: 'UNEXPECTED', reason: 'not in the plan' }
}

/** Values per locale (`{ en, ar }`) differ locale by locale; anything else as a whole. */
const parts = (before: unknown, after: unknown): Array<[string, unknown, unknown]> => {
  const keys = (v: unknown) => (isRecord(v) ? Object.keys(v) : [])
  const localized = (v: unknown) =>
    keys(v).length > 0 && keys(v).every((k) => k === 'en' || k === 'ar')
  if (!localized(before) || !localized(after)) return [['', before, after]]
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].map((k) => [k, b[k], a[k]])
}

/** Every difference between two snapshots, judged against the base's course facts. */
export const compareSnapshots = (base: Snapshot, head: Snapshot): Difference[] => {
  const out: Difference[] = []
  const readers = [...new Set([...Object.keys(base.readers), ...Object.keys(head.readers)])].sort()
  for (const reader of readers) {
    const b = base.readers[reader]
    const a = head.readers[reader]
    if (!b || !a) {
      out.push({
        reader,
        course: '*',
        part: '',
        before: b ? 'recorded' : 'missing',
        after: a ? 'recorded' : 'missing',
        verdict: 'UNEXPECTED',
        reason: 'reader recorded in one snapshot only',
      })
      continue
    }
    const courses = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort(
      (x, y) => Number(x) - Number(y),
    )
    for (const course of courses) {
      if (same(b[course], a[course])) continue
      for (const [part, before, after] of parts(b[course], a[course])) {
        if (same(before, after)) continue
        const days = DAY_READERS.has(reader) ? toDays(before) : before
        const { verdict, reason } = same(days, after)
          ? { verdict: 'EXPECTED' as const, reason: 'raw timestamp to the same day' }
          : classify(reader, base.courses[course], days, after)
        out.push({ reader, course, part, before, after, verdict, reason })
      }
    }
  }
  return out
}

/** Lines that say how a value changed: removed and added list items, or before and after. */
export const describeChange = (before: unknown, after: unknown): string[] => {
  if (Array.isArray(before) && Array.isArray(after)) {
    const text = (v: unknown) => JSON.stringify(v)
    const was = before.map(text)
    const now = after.map(text)
    return [
      ...was.filter((x) => !now.includes(x)).map((x) => `- ${x}`),
      ...now.filter((x) => !was.includes(x)).map((x) => `+ ${x}`),
      ...(was.every((x) => now.includes(x)) && now.every((x) => was.includes(x))
        ? ['~ same items, new order']
        : []),
    ]
  }
  return [`- ${JSON.stringify(before)}`, `+ ${JSON.stringify(after)}`]
}

/** The report `--compare` prints: grouped by reader, then course. */
export const formatDifferences = (diffs: Difference[], base: Snapshot): string => {
  const lines: string[] = []
  let reader = ''
  for (const d of diffs) {
    if (d.reader !== reader) {
      reader = d.reader
      lines.push('', `## ${reader}`)
    }
    const slug = base.courses[d.course]?.slug ?? '?'
    lines.push(
      `${d.verdict} course ${d.course} (${slug})${d.part ? ` [${d.part}]` : ''}: ${d.reason}`,
    )
    for (const line of describeChange(d.before, d.after)) lines.push(`    ${line}`)
  }
  const count = (v: Verdict) => diffs.filter((d) => d.verdict === v).length
  lines.push('', `${count('EXPECTED')} expected, ${count('UNEXPECTED')} unexpected difference(s).`)
  return lines.join('\n')
}

/* ------------------------------------------------------------ extractors */

const unescapeIcs = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

export type IcsEvent = Record<string, string>

/** The VEVENTs of an iCalendar text, each as its properties (parameters kept in the key). */
export const parseIcs = (ics: string): IcsEvent[] => {
  const lines = ics.replace(/\r\n[ \t]/g, '').split(/\r?\n/)
  const events: IcsEvent[] = []
  let current: IcsEvent | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {}
    else if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
    } else if (current) {
      const at = line.indexOf(':')
      if (at > 0) current[line.slice(0, at)] = unescapeIcs(line.slice(at + 1))
    }
  }
  return events
}

/** The course slug a site URL or path points at, or null. */
export const courseSlugOf = (url: string | null | undefined): string | null =>
  /\/study\/([^/?#]+)\/?(?:[?#]|$)/.exec(url ?? '')?.[1] ?? null

/**
 * A course's entries in the feed, without what changes on every run or
 * names an entry by its place in a list: `DTSTAMP` (the time of the
 * request) and `UID` (`c<id>-<index>` today; ADR 0011 gives each meeting
 * its own). Sorted, so the order of courses in the feed does not count.
 */
export const icsByCourse = (ics: string): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  for (const event of parseIcs(ics)) {
    const slug = courseSlugOf(event.URL)
    if (!slug) continue
    const { DTSTAMP: _stamp, UID: _uid, URL: _url, ...rest } = event
    ;(out[slug] ??= []).push(
      Object.entries(rest)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(' | '),
    )
  }
  for (const list of Object.values(out)) list.sort()
  return out
}

/** Lines of a Markdown section (`## heading` up to the next `## `). */
const section = (markdown: string, headings: readonly string[]): string[] => {
  const lines = markdown.split('\n')
  const start = lines.findIndex(
    (l) => headings.includes(l.replace(/^##\s+/, '').trim()) && l.startsWith('## '),
  )
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  return lines.slice(start + 1, end === -1 ? undefined : end)
}

const LLMS_FACTS = ['Practical facts', 'معلومات عملية']
const LLMS_SYLLABUS = ['Syllabus', 'المقرّر']
const LLMS_TIME_FACTS = /^\*\*(Starts|Ends|Meets|تبدأ|تنتهي|اللقاءات):\*\*/
const LLMS_SESSION_LINE =
  /^(### |(Meetings|اللقاءات): |Dates: |The syllabus may still change\.|قد يتغيّر المقرّر\.)/

/**
 * The time in a course's llms document: the start, end and meeting facts,
 * and each syllabus session's heading, meeting count and own dates.
 */
export const llmsTimes = (markdown: string): { facts: string[]; syllabus: string[] } => ({
  facts: section(markdown, LLMS_FACTS).filter((l) => LLMS_TIME_FACTS.test(l)),
  syllabus: section(markdown, LLMS_SYLLABUS).filter((l) => LLMS_SESSION_LINE.test(l)),
})
