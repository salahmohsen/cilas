import type { CalendarChange, CalendarItem, NewBlock } from '@/lib/calendar-items'

import type { TimedBlock } from './calendar-model'
import { toTime } from './calendar-time'

const timesOf = (block: TimedBlock) => ({
  date: block.track,
  start_time: toTime(block.start),
  end_time: toTime(block.end),
})

const moved = (was: TimedBlock, now: TimedBlock) =>
  was.track !== now.track || was.start !== now.start || was.end !== now.end

type Edit = {
  items: CalendarItem[]
  /** The blocks as loaded. */
  base: TimedBlock[]
  /** The blocks as edited, deleted ones included as ghosts. */
  working: TimedBlock[]
  /** What an item made on the page becomes. */
  newItemKind?: string
}

/**
 * The one list a Save sends: what differs between the loaded blocks and the
 * edited ones. Blocks of an item the host did not load are new; those of one
 * item go in one `create-item`.
 */
export function changesOf({ items, base, working, newItemKind }: Edit): CalendarChange[] {
  const versions = new Map(items.map((item) => [item.id, item.version]))
  const before = new Map(base.map((block) => [block.id, block]))
  const changes: CalendarChange[] = []
  const created = new Map<string, NewBlock[]>()

  for (const block of working) {
    if (block.deleted) continue
    const was = before.get(block.id)
    const version = versions.get(block.itemId)
    if (!was) {
      if (version === undefined) {
        created.set(block.itemId, [
          ...(created.get(block.itemId) ?? []),
          { blockId: block.blockId, ...timesOf(block) },
        ])
      } else {
        changes.push({
          op: 'add-block',
          itemId: block.itemId,
          version,
          blockId: block.blockId,
          ...timesOf(block),
        })
      }
    } else if (moved(was, block)) {
      changes.push({
        op: 'move-block',
        itemId: block.itemId,
        version: version!,
        blockId: block.blockId,
        ...timesOf(block),
      })
    }
  }

  for (const [first, ...rest] of created.values()) {
    if (!newItemKind) throw new Error('An item was made but no kind was given for new items.')
    changes.push({ op: 'create-item', kind: newItemKind, blocks: [first!, ...rest] })
  }

  for (const block of working) {
    if (block.deleted && before.has(block.id)) {
      changes.push({
        op: 'delete-block',
        itemId: block.itemId,
        version: versions.get(block.itemId)!,
        blockId: block.blockId,
      })
    }
  }
  return changes
}

/** The live blocks that differ from what was loaded: drawn, placed or moved. */
export function unsavedIdsOf(base: TimedBlock[], working: TimedBlock[]): Set<string> {
  const before = new Map(base.map((block) => [block.id, block]))
  return new Set(
    working
      .filter((block) => {
        if (block.deleted) return false
        const was = before.get(block.id)
        return !was || moved(was, block)
      })
      .map((block) => block.id),
  )
}

/**
 * What the span editor's new list becomes after a Delete: a loaded block stays
 * as a ghost, at the place it had, so Restore can bring it back. A block made
 * on the page is simply gone.
 */
export function keepDeleted(
  previous: TimedBlock[],
  next: TimedBlock[],
  id: string,
  base: TimedBlock[],
): TimedBlock[] {
  const removed = previous.find((block) => block.id === id)
  if (!removed || !base.some((block) => block.id === id)) return next
  return [...next, { ...removed, deleted: true }]
}

export const restoreBlock = (working: TimedBlock[], id: string): TimedBlock[] =>
  working.map((block) => (block.id === id ? { ...block, deleted: false } : block))
