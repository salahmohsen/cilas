import type { Syllabus } from './syllabus-schema'

const norm = (url: string): string =>
  url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase()

/** Links in the source that no material in the syllabus carries as an href. */
export const missingLinks = (links: string[], syllabus: Syllabus): string[] => {
  const have = new Set(
    [...syllabus.sessions.flatMap((s) => s.materials), ...syllabus.bibliography]
      .map((m) => m.href)
      .filter((h): h is string => Boolean(h))
      .map(norm),
  )
  return [...new Set(links)].filter((l) => !have.has(norm(l)))
}

/** How many units the text numbers: the largest of the marker families. */
export const unitMarkers = (text: string): number => {
  const words = new Set<string>()
  for (const m of text.matchAll(/\b(?:week|session)\s+(\d+)/gi))
    words.add(`${m[0].split(/\s/)[0].toLowerCase()}${m[1]}`)
  const week = new Set([...words].filter((w) => w.startsWith('week'))).size
  const session = new Set([...words].filter((w) => w.startsWith('session'))).size

  // Arabic markers carry an ordinal word; count distinct word after the marker.
  const arabic = new Set<string>()
  for (const m of text.matchAll(/(?:الأسبوع|الاسبوع|أسبوع|اللقاء|لقاء|الجلسة|جلسة)\s+(\S+)/gu))
    arabic.add(m[1])

  const lines = new Set<string>()
  for (const m of text.matchAll(/^\s*(\d+)\s*[.)]/gm)) lines.add(m[1])

  return Math.max(week, session, arabic.size, lines.size)
}

/** True when the counts differ by more than one, or markers exist but sessions don't. */
/**
 * Whether the syllabus's meetings (a session spanning "weeks 5–7" counts 3)
 * differ by more than one from the units the text numbers. With no markers
 * found, the flow can't be checked this way, so it isn't flagged.
 */
export const sessionMismatch = (markers: number, meetings: number): boolean =>
  markers > 0 && (Math.abs(markers - meetings) > 1 || meetings === 0)
