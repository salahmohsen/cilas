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
  /**
   * What the timing removal did to the course, from the head snapshot (the base
   * cannot know): `meetings` when the old pattern gave it no meeting and it
   * has meetings now; `weeks-lost` when it
   * had only a typed length, which no meeting replaces.
   */
  archive?: 'meetings' | 'weeks-lost'
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
 * A session's name as a reader shows it ("Session 3", "Week 3", "الجلسة ٣",
 * "الأسبوع ٣"), with the " · " the feed puts before it.
 */
const SESSION_LABEL = /(?: · )?(?:Session|Week|الجلسة|الأسبوع) [0-9٠-٩]+/g

/** A count of sessions or weeks, as the course page's length says it in either language. */
const SESSION_COUNT =
  /[0-9٠-٩]+ (?:sessions?|weeks?|جلسات|جلسة|أسابيع|أسبوعًا|أسبوع)|جلسة واحدة|جلستان|أسبوع واحد|أسبوعان/g

/** Whether `after` is `before` with a session's name added, or its session count changed. */
const labelOrCount = (before: string, after: string): boolean => {
  if (after.replace(SESSION_LABEL, '') === before) return true
  const counted = before.replace(SESSION_COUNT, '#')
  return counted !== before && counted === after.replace(SESSION_COUNT, '#')
}

/**
 * Whether `after` has the lines of `before`, each unchanged or changed only
 * by `labelOrCount`, and no other line. A meeting the pattern made after the
 * last old session showed with no session; it now belongs to a new session
 * and shows its name, and the page counts the new sessions. The feed sorts
 * its lines, so a line is matched wherever it went.
 */
export const onlyLabels = (before: unknown, after: unknown): boolean => {
  const was = linesOf(before)
  const now = linesOf(after)
  if (was.length !== now.length) return false
  const left = [...now]
  for (const line of was) {
    const at = left.findIndex((n) => n === line || labelOrCount(line, n))
    if (at === -1) return false
    left.splice(at, 1)
  }
  return true
}

/** Hand-typed list markers at the start of a line ("- ", "2. "), which became Markdown lists. */
const LIST_MARKER = /^(?:- |\d+\. )/gm

/**
 * Whether the search text `after` is `before` with its hand-typed list
 * markers gone, the same words in the same order. A description converted to
 * Markdown turned them into list items; the index keeps the words, not the
 * syntax. The index lists each line once, so a line that matches an earlier
 * one once its marker is gone is listed once.
 */
export const onlyListMarkers = (before: unknown, after: unknown): boolean => {
  if (typeof before !== 'string' || typeof after !== 'string' || before === after) return false
  const lines = before.replace(LIST_MARKER, '').split('\n')
  return lines.filter((line, i) => lines.indexOf(line) === i).join('\n') === after
}

/** A session's label and a count of sessions or weeks, with the unit word replaced, numbers kept. */
const unitFree = (value: unknown): string =>
  (JSON.stringify(value) ?? '')
    .replace(/(?:Week|Session) ([0-9]+)/g, '# $1')
    .replace(/(?:الأسبوع|الجلسة) ([0-9٠-٩]+)/g, '# $1')
    .replace(
      /([0-9٠-٩]+) (?:weeks?|sessions?|أسابيع|أسبوعًا|أسبوع|جلسات|جلسة)(?![\u0621-\u064A])/g,
      '$1 #',
    )
    .replace(/(?:جلسة|أسبوع) واحد(?:ة)?/g, '1 #')
    .replace(/جلستان|أسبوعان/g, '2 #')

/**
 * Whether `after` is `before` with "Week N" and "N weeks" turned into "Session N" and "N sessions":
 * every number the same. The numbering setting is gone, so every untitled session is "Session N".
 */
export const onlyUnits = (before: unknown, after: unknown): boolean =>
  !same(before, after) && unitFree(before) === unitFree(after)

/** A value with every property named `key` removed, at any depth. */
const withoutKey = (value: unknown, key: string): unknown => {
  if (Array.isArray(value)) return value.map((v) => withoutKey(v, key))
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== key)
        .map(([k, v]) => [k, withoutKey(v, key)]),
    )
  return value
}

/** Whether `after` has the lines of `before` less some, the rest unchanged and in order. */
export const onlyRemovals = (before: unknown, after: unknown): boolean => {
  const was = linesOf(before)
  const now = linesOf(after)
  let at = 0
  for (const line of was) if (at < now.length && line === now[at]) at++
  return at === now.length && now.length < was.length
}

/** Whether a card's length ("10 weeks") is gone and its date is the same. */
export const onlyLengthGone = (before: unknown, after: unknown): boolean =>
  isRecord(before) &&
  isRecord(after) &&
  !!before.length &&
  !after.length &&
  same({ ...before, length: '' }, { ...after, length: '' })

/**
 * Whether the plan expects `reader` to change from `before` to `after` for
 * this course. Course by course, reader by reader: an archive-dated course
 * may change anywhere; a course with new untitled sessions may gain lines
 * where sessions are listed or counted, or name or count those sessions in
 * lines it had, and change nothing else; the search text may lose
 * hand-typed list markers; an undated course's note may change only where
 * the note shows.
 */
export const classify = (
  reader: string,
  meta: CourseMeta | undefined,
  before: unknown,
  after: unknown,
): { verdict: Verdict; reason: string } => {
  if (!meta) return { verdict: 'UNEXPECTED', reason: 'course not in the base snapshot' }
  if (onlyUnits(before, after))
    return { verdict: 'EXPECTED', reason: 'Week N became Session N (no numbering setting)' }
  if (reader === 'space.sessionFacts' && same(withoutKey(before, 'week'), after))
    return { verdict: 'EXPECTED', reason: 'the week flag is gone with the numbering setting' }
  if (reader === 'page.note' && onlyRemovals(before, after))
    return { verdict: 'EXPECTED', reason: 'the timing note is removed' }
  if (
    reader === 'list.articleCards' &&
    meta.archive === 'weeks-lost' &&
    onlyLengthGone(before, after)
  )
    return { verdict: 'EXPECTED', reason: 'a typed length with no meeting to replace it is gone' }
  if (meta.archive === 'meetings')
    return {
      verdict: 'EXPECTED',
      reason: 'archive meetings: approximate dates replace the old timing',
    }
  if (meta.archiveDated) return { verdict: 'EXPECTED', reason: 'archive start date (37)' }
  if (meta.newSessions > 0 && SESSION_READERS.has(reader) && onlyAdds(before, after))
    return {
      verdict: 'EXPECTED',
      reason: `${meta.newSessions} new untitled session(s) (389), lines added only`,
    }
  if (meta.newSessions > 0 && SESSION_READERS.has(reader) && onlyLabels(before, after))
    return {
      verdict: 'EXPECTED',
      reason: `${meta.newSessions} new untitled session(s): pattern meetings now named or counted`,
    }
  if (reader === 'search.syllabus' && onlyListMarkers(before, after))
    return { verdict: 'EXPECTED', reason: 'hand-typed list markers became Markdown lists (3)' }
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

/**
 * A difference a person reviewed and found correct, though no rule of the
 * plan covers it (`scripts/course-reader-accepted.json`). It holds only
 * against the base snapshot it was reviewed on: a new baseline starts with
 * none.
 */
export type Accepted = {
  /** The label of the base snapshot the difference was found against. */
  base: string
  course: string
  reader: string
  /** The locale (`en`, `ar`), or `` for a value with no locales. */
  part: string
  /** Why the new output is right, in one sentence. */
  reason: string
}

const matches = (entry: Accepted, d: Difference) =>
  entry.course === d.course && entry.reader === d.reader && entry.part === d.part

/**
 * The differences with the accepted entries for this base applied: an
 * UNEXPECTED difference an entry names becomes EXPECTED with its reason. An
 * entry that names no UNEXPECTED difference is itself UNEXPECTED, so a stale
 * entry cannot hide a later change.
 */
const applyAccepted = (diffs: Difference[], base: string, accepted: Accepted[]): Difference[] => {
  const entries = accepted.filter((e) => e.base === base)
  const judged = diffs.map((d) => {
    const entry = d.verdict === 'UNEXPECTED' && entries.find((e) => matches(e, d))
    return entry ? { ...d, verdict: 'EXPECTED' as const, reason: `accepted: ${entry.reason}` } : d
  })
  const stale = entries
    .filter((e) => !diffs.some((d) => d.verdict === 'UNEXPECTED' && matches(e, d)))
    .map((e): Difference => ({
      reader: e.reader,
      course: e.course,
      part: e.part,
      before: 'accepted difference',
      after: 'no such unexpected difference',
      verdict: 'UNEXPECTED',
      reason: `stale accepted entry: ${e.reason}`,
    }))
  return [...judged, ...stale]
}

/**
 * Every difference between two snapshots, judged against the base's course
 * facts and the reviewed `accepted` differences for that base.
 */
export const compareSnapshots = (
  base: Snapshot,
  head: Snapshot,
  accepted: Accepted[] = [],
): Difference[] => applyAccepted(rawDifferences(base, head), base.label, accepted)

/** The base's facts about a course, with what the head snapshot knows that the base cannot. */
const metaOf = (base: Snapshot, head: Snapshot, course: string): CourseMeta | undefined => {
  const meta = base.courses[course]
  return meta && { ...meta, archive: head.courses[course]?.archive }
}

const rawDifferences = (base: Snapshot, head: Snapshot): Difference[] => {
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
          : classify(reader, metaOf(base, head, course), days, after)
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
