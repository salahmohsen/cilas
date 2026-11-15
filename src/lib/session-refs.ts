/**
 * Course sessions named in a post or comment body. The body stays the one
 * source of truth, as plain Markdown-safe text:
 *
 * - a mention, written with `#`, reads inline: `[#3 Title](session:<id>)`
 * - a block, chosen from the `/` menu, is a paragraph of its own: `::session[<id>]`
 * - a schedule block, at most one a post, is a paragraph of its own:
 *   `::schedule[<first Saturday>+<weeks>:<id>,<id>]`. It names the weeks to
 *   show and the sessions to mark, never their dates, so it reads the
 *   current schedule.
 *
 * A block token inside a sentence is not a block: it reads as a mention. A
 * schedule token inside a sentence is nothing.
 */
import { cairoDay } from '@/lib/cairo-day'
import { weekStart } from '@/lib/calendar'
import { numberedSessions, type SessionTimes } from '@/lib/meetings'

const ID = '[A-Za-z0-9_-]{1,64}'

/** At most this many of each in one body; the server turns the rest into plain text. */
export const SESSION_REF_MAX = { mentions: 10, blocks: 3, schedules: 1 } as const

/** The most weeks a schedule block may show. */
const SCHEDULE_MAX_WEEKS = 26

// Arc's rich-text editor recognizes this scheme independently so it stays reusable.
export const SESSION_HREF = 'session:'

const mentionPattern = () => new RegExp(`\\[([^\\]\\n]*)\\]\\(${SESSION_HREF}(${ID})\\)`, 'g')
const blockPattern = () => new RegExp(`::session\\[(${ID})\\]`, 'g')
const BLOCK_LINE = new RegExp(`^\\s*::session\\[(${ID})\\]\\s*$`)
const SCHEDULE = `::schedule\\[(\\d{4}-\\d{2}-\\d{2})\\+(\\d{1,2}):(${ID}(?:,${ID})*)\\]`
const schedulePattern = () => new RegExp(SCHEDULE, 'g')
const SCHEDULE_LINE = new RegExp(`^\\s*${SCHEDULE}\\s*$`)
const FENCE = /^\s*```/

export const mentionToken = (id: string, label: string) =>
  `[${label.replace(/[[\]\n]/g, '')}](${SESSION_HREF}${id})`

export const blockToken = (id: string) => `::session[${id}]`

/** A line that holds only a block token, with no text around it. */
export const blockLineId = (line: string): string | null => BLOCK_LINE.exec(line)?.[1] ?? null

/** What a schedule block shows: `weeks` Saturday weeks from `from`, with the sessions `ids` marked. */
export type ScheduleRef = { from: string; weeks: number; ids: string[] }

/** Weeks past the most a block shows are cut off. */
export const scheduleToken = ({ from, weeks, ids }: ScheduleRef) =>
  `::schedule[${weekStart(from)}+${Math.min(weeks, SCHEDULE_MAX_WEEKS)}:${ids.join(',')}]`

const scheduleOf = (m: RegExpExecArray | RegExpMatchArray): ScheduleRef | null => {
  const [, day, count, list] = m
  const weeks = Number(count)
  if (cairoDay(day!) !== day || weeks < 1 || weeks > SCHEDULE_MAX_WEEKS) return null
  return { from: weekStart(day!), weeks, ids: [...new Set(list!.split(','))] }
}

/** A line that holds only a valid schedule token, with no text around it. */
export const scheduleLineRef = (line: string): ScheduleRef | null => {
  const m = SCHEDULE_LINE.exec(line)
  return m ? scheduleOf(m) : null
}

export type BodyPart =
  | { type: 'text'; markdown: string }
  | { type: 'block'; id: string }
  | { type: 'schedule'; schedule: ScheduleRef }

/**
 * Lines with a role: inside a code fence nothing counts; a block is a block
 * token alone in its paragraph (blank line, or the body's edge, on each side).
 */
const lineRoles = (lines: string[]): ('code' | 'block' | 'schedule' | 'text')[] => {
  let fenced = false
  return lines.map((line, i) => {
    if (FENCE.test(line)) {
      fenced = !fenced
      return 'code'
    }
    if (fenced) return 'code'
    const alone =
      (i === 0 || !lines[i - 1]!.trim()) && (i === lines.length - 1 || !lines[i + 1]!.trim())
    if (!alone) return 'text'
    return blockLineId(line) ? 'block' : scheduleLineRef(line) ? 'schedule' : 'text'
  })
}

/** The body cut at its blocks, in order: Markdown runs between whole session cards. */
export const splitBlocks = (body: string): BodyPart[] => {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const roles = lineRoles(lines)
  const parts: BodyPart[] = []
  let run: string[] = []
  const flush = () => {
    const markdown = run.join('\n').trim()
    if (markdown) parts.push({ type: 'text', markdown })
    run = []
  }
  lines.forEach((line, i) => {
    if (roles[i] === 'block') {
      flush()
      parts.push({ type: 'block', id: blockLineId(line)! })
    } else if (roles[i] === 'schedule') {
      flush()
      parts.push({ type: 'schedule', schedule: scheduleLineRef(line)! })
    } else run.push(line)
  })
  flush()
  return parts
}

/** A block token left inside a sentence becomes a mention with no label of its own; a schedule token, nothing. */
export const inlineBlocks = (markdown: string): string =>
  markdown
    .split('\n')
    .map((line, i, lines) =>
      lineRoles(lines)[i] === 'code'
        ? line
        : line
            .replace(blockPattern(), (_, id: string) => mentionToken(id, ''))
            .replace(schedulePattern(), ''),
    )
    .join('\n')

/** Every session id the body names, mentions, blocks and schedules alike, in order and without repeats. */
export const sessionIdsIn = (body: string): string[] => {
  const ids = new Set<string>()
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const roles = lineRoles(lines)
  lines.forEach((line, i) => {
    if (roles[i] === 'code') return
    for (const m of line.matchAll(mentionPattern())) ids.add(m[2]!)
    for (const m of line.matchAll(blockPattern())) ids.add(m[1]!)
    for (const m of line.matchAll(schedulePattern()))
      for (const id of scheduleOf(m)?.ids ?? []) ids.add(id)
  })
  return [...ids]
}

/**
 * The body with each session ID its mentions and blocks name replaced by
 * `rename(id)`; tokens inside a code fence are text and stay.
 */
export const renameSessionRefs = (body: string, rename: (id: string) => string): string => {
  const lines = body.split('\n')
  const roles = lineRoles(lines.map((line) => line.replace(/\r$/, '')))
  return lines
    .map((line, i) =>
      roles[i] === 'code'
        ? line
        : line
            .replace(
              mentionPattern(),
              (_, label: string, id: string) => `[${label}](${SESSION_HREF}${rename(id)})`,
            )
            .replace(blockPattern(), (_, id: string) => blockToken(rename(id)))
            .replace(schedulePattern(), (whole) => {
              const ref = scheduleOf(new RegExp(SCHEDULE).exec(whole)!)
              return ref ? scheduleToken({ ...ref, ids: ref.ids.map(rename) }) : whole
            }),
    )
    .join('\n')
}

/**
 * The body as the server stores it: a session that is not one of `known`
 * turns into plain text (a mention keeps its words, a block goes), and so
 * does every mention or block past the cap. A schedule block keeps only its
 * known sessions, and goes when none is left, when it is past the first, or
 * inside a sentence. Without `blocks` (comments), a block line reads as a
 * mention and a schedule block goes.
 */
export const cleanSessionRefs = (
  body: string,
  known: ReadonlySet<string>,
  { blocks = true }: { blocks?: boolean } = {},
): string => {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const roles = lineRoles(lines)
  let mentions = 0
  let cards = 0
  let schedules = 0
  const keepMention = (id: string) => known.has(id) && ++mentions <= SESSION_REF_MAX.mentions
  const out: (string | null)[] = lines.map((line, i) => {
    if (roles[i] === 'code') return line
    if (roles[i] === 'block' && blocks) {
      const id = blockLineId(line)!
      return known.has(id) && ++cards <= SESSION_REF_MAX.blocks ? blockToken(id) : null
    }
    if (roles[i] === 'schedule') {
      const ref = scheduleLineRef(line)!
      const ids = ref.ids.filter((id) => known.has(id))
      return blocks && ids.length && ++schedules <= SESSION_REF_MAX.schedules
        ? scheduleToken({ ...ref, ids })
        : null
    }
    return line
      .replace(schedulePattern(), '')
      .replace(mentionPattern(), (whole, label: string, id: string) =>
        keepMention(id) ? whole : label,
      )
      .replace(blockPattern(), (whole, id: string) => (keepMention(id) ? whole : ''))
  })
  // A dropped block leaves no run of empty lines behind.
  return out
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** What a mention chip and the `#` list show of one session, from the live course. */
export type SessionFact = {
  /** Its place in the syllabus, from 1 */
  n: number
  title: string | null
  /** Its first meeting that is not cancelled, a Cairo day */
  date: string | null
  cancelled: boolean
}

type FactCourse = {
  sessions: readonly (SessionTimes & { id: number | string; title?: string | null })[]
}

/** Every session of the course by id, numbered and dated as the syllabus shows them. */
export const sessionFacts = (course: FactCourse): Record<string, SessionFact> =>
  Object.fromEntries(
    numberedSessions(course.sessions).map((n) => [
      String(n.session.id),
      {
        n: n.number,
        title: n.session.title || null,
        date: n.day,
        cancelled: Boolean(n.session.cancelled),
      },
    ]),
  )
