import type { EditBlock } from './calendar-model'

const present = (blocks: readonly EditBlock[]) => blocks.filter((block) => !block.deleted)

const byWhen = (a: EditBlock, b: EditBlock) =>
  a.track.localeCompare(b.track) ||
  Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) ||
  a.start - b.start ||
  a.end - b.end

/** A day's blocks, all-day first, then by start: the rows of the side panel's day. */
export const dayBlocksOf = (blocks: readonly EditBlock[], day: string): EditBlock[] =>
  present(blocks)
    .filter((block) => block.track === day)
    .toSorted(byWhen)

/** The first block after `day`, for an empty day's one row. */
export const nextBlockAfter = (blocks: readonly EditBlock[], day: string): EditBlock | undefined =>
  present(blocks)
    .filter((block) => block.track > day)
    .toSorted(byWhen)[0]

/**
 * The day a month opens on: today when the month holds it, else its first
 * day with an item, else its first day. `days` are the month's days.
 */
export const monthDefaultDay = (
  days: readonly string[],
  today: string | null,
  blocks: readonly EditBlock[],
): string => {
  if (today && days.includes(today)) return today
  const month = new Set(days)
  return (
    present(blocks)
      .filter((block) => month.has(block.track))
      .toSorted(byWhen)[0]?.track ?? days[0]!
  )
}
