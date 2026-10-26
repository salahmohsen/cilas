/**
 * Course sessions named in a post or comment body. The body stays the one
 * source of truth, as plain Markdown-safe text:
 *
 * - a mention, written with `#`, reads inline: `[#3 Title](session:<id>)`
 * - a block, chosen from the `/` menu, is a paragraph of its own: `::session[<id>]`
 *
 * A block token inside a sentence is not a block: it reads as a mention.
 */
import { expandSchedule, sessionsInOrder, type Schedule, type SessionDates } from '@/lib/schedule'

const ID = '[A-Za-z0-9_-]{1,64}'

/** At most this many of each in one body; the server turns the rest into plain text. */
export const SESSION_REF_MAX = { mentions: 10, blocks: 3 } as const

export const SESSION_HREF = 'session:'
export const SESSION_BLOCK_HREF = 'session-block:'

const mentionPattern = () => new RegExp(`\\[([^\\]\\n]*)\\]\\(${SESSION_HREF}(${ID})\\)`, 'g')
const blockPattern = () => new RegExp(`::session\\[(${ID})\\]`, 'g')
const BLOCK_LINE = new RegExp(`^\\s*::session\\[(${ID})\\]\\s*$`)
const FENCE = /^\s*```/

export const mentionToken = (id: string, label: string) =>
  `[${label.replace(/[[\]\n]/g, '')}](${SESSION_HREF}${id})`

export const blockToken = (id: string) => `::session[${id}]`

/** A line that holds only a block token, with no text around it. */
export const blockLineId = (line: string): string | null => BLOCK_LINE.exec(line)?.[1] ?? null

export type BodyPart = { type: 'text'; markdown: string } | { type: 'block'; id: string }

/**
 * Lines with a role: inside a code fence nothing counts; a block is a block
 * token alone in its paragraph (blank line, or the body's edge, on each side).
 */
const lineRoles = (lines: string[]): ('code' | 'block' | 'text')[] => {
  let fenced = false
  return lines.map((line, i) => {
    if (FENCE.test(line)) {
      fenced = !fenced
      return 'code'
    }
    if (fenced) return 'code'
    const alone =
      (i === 0 || !lines[i - 1]!.trim()) && (i === lines.length - 1 || !lines[i + 1]!.trim())
    return alone && blockLineId(line) ? 'block' : 'text'
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
    } else run.push(line)
  })
  flush()
  return parts
}

/** A block token left inside a sentence becomes a mention with no label of its own. */
export const inlineBlocks = (markdown: string): string =>
  markdown
    .split('\n')
    .map((line, i, lines) =>
      lineRoles(lines)[i] === 'code'
        ? line
        : line.replace(blockPattern(), (_, id: string) => mentionToken(id, '')),
    )
    .join('\n')

/** Every session id the body names, mentions and blocks alike, in order and without repeats. */
export const sessionIdsIn = (body: string): string[] => {
  const ids = new Set<string>()
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const roles = lineRoles(lines)
  lines.forEach((line, i) => {
    if (roles[i] === 'code') return
    for (const m of line.matchAll(mentionPattern())) ids.add(m[2]!)
    for (const m of line.matchAll(blockPattern())) ids.add(m[1]!)
  })
  return [...ids]
}

/**
 * The body as the server stores it: a session that is not one of `known`
 * turns into plain text (a mention keeps its words, a block goes), and so
 * does every mention or block past the cap. Without `blocks` (comments), a
 * block line reads as a mention.
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
  const keepMention = (id: string) => known.has(id) && ++mentions <= SESSION_REF_MAX.mentions
  const out: (string | null)[] = lines.map((line, i) => {
    if (roles[i] === 'code') return line
    if (roles[i] === 'block' && blocks) {
      const id = blockLineId(line)!
      return known.has(id) && ++cards <= SESSION_REF_MAX.blocks ? blockToken(id) : null
    }
    return line
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
  /** The course counts weeks rather than sessions */
  week: boolean
  /** Its first meeting that is not cancelled, a Cairo day */
  date: string | null
  cancelled: boolean
}

type FactCourse = {
  sessions?: (SessionDates & { id?: string | null; session_title?: string | null })[] | null
  schedule?: Schedule | null
  session_unit?: string | null
}

/** Every session of the course by id, numbered and dated as the syllabus shows them. */
export const sessionFacts = (course: FactCourse): Record<string, SessionFact> => {
  const meetings = expandSchedule(course.schedule, course.sessions)
  const out: Record<string, SessionFact> = {}
  sessionsInOrder(course.sessions ?? []).forEach((session, i) => {
    if (!session.id) return
    const own = meetings.filter((m) => m.session === i + 1)
    out[session.id] = {
      n: i + 1,
      title: session.session_title || null,
      week: course.session_unit === 'week',
      date: (own.find((m) => !m.cancelled) ?? own[0])?.date ?? null,
      cancelled: Boolean(session.cancelled),
    }
  })
  return out
}
