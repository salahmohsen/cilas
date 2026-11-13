import { describe, expect, it } from 'vitest'

import {
  changesOf,
  keepDeleted,
  restoreBlock,
  unsavedIdsOf,
} from '@/components/calendar/ui/calendar-edits'
import { newBlock, timedBlocks, type TimedBlock } from '@/components/calendar/ui/calendar-model'
import type { CalendarItem } from '@/lib/calendar-items'

const items: CalendarItem[] = [
  {
    id: 'week-3',
    kind: 'session',
    title: 'Week 3',
    tone: 'yellow',
    cancelled: false,
    version: 'v3',
    blocks: [
      { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
      { id: 'thu', date: '2026-11-19', start_time: '19:00', end_time: '21:00' },
    ],
  },
  {
    id: 'week-4',
    kind: 'session',
    title: 'Week 4',
    tone: 'yellow',
    cancelled: false,
    version: 'v4',
    blocks: [],
  },
]
const base = timedBlocks(items)
const edit = (working: TimedBlock[], newItemKind?: string) =>
  changesOf({ items, base, working, newItemKind })
const tue = base[0]!
const thu = base[1]!

describe('the change list of a Save', () => {
  it('is empty when nothing differs', () => {
    expect(edit(base)).toEqual([])
    expect(unsavedIdsOf(base, base).size).toBe(0)
  })

  it('moves a block: a move-block with the item version and the new times', () => {
    const moved = { ...tue, track: '2026-11-18', start: 19 * 60 + 15, end: 21 * 60 + 30 }
    expect(edit([moved, thu])).toEqual([
      {
        op: 'move-block',
        itemId: 'week-3',
        version: 'v3',
        blockId: 'tue',
        date: '2026-11-18',
        start_time: '19:15',
        end_time: '21:30',
      },
    ])
    expect([...unsavedIdsOf(base, [moved, thu])]).toEqual(['week-3/tue'])
  })

  it('draws on an empty slot: a create-item with the host kind and no version', () => {
    const drawn = newBlock(null, '2026-11-16', 600, 660)
    expect(edit([...base, drawn], 'session')).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blockId: drawn.blockId,
        date: '2026-11-16',
        start_time: '10:00',
        end_time: '11:00',
      },
    ])
  })

  it('refuses to draw when the host named no kind for new items', () => {
    expect(() => edit([...base, newBlock(null, '2026-11-16', 600, 660)])).toThrow(/no kind/)
  })

  it('places an unscheduled item: an add-block with its version', () => {
    const placed = newBlock('week-4', '2026-11-15', 900, 960)
    expect(edit([...base, placed])).toEqual([
      {
        op: 'add-block',
        itemId: 'week-4',
        version: 'v4',
        blockId: placed.blockId,
        date: '2026-11-15',
        start_time: '15:00',
        end_time: '16:00',
      },
    ])
  })

  it('deletes a loaded block: a delete-block, and the ghost is not a live block', () => {
    const working = keepDeleted(base, [thu], tue.id, base)
    expect(working.find((block) => block.id === tue.id)).toMatchObject({ deleted: true })
    expect(edit(working)).toEqual([
      { op: 'delete-block', itemId: 'week-3', version: 'v3', blockId: 'tue' },
    ])
    expect(unsavedIdsOf(base, working).size).toBe(0)
  })

  it('sends only the delete for a block that was moved and then deleted', () => {
    const moved = { ...tue, start: 600, end: 660 }
    const working = keepDeleted([moved, thu], [thu], tue.id, base)
    expect(edit(working).map((change) => change.op)).toEqual(['delete-block'])
  })

  it('forgets a block made on the page when it is deleted', () => {
    const drawn = newBlock(null, '2026-11-16', 600, 660)
    const working = keepDeleted([...base, drawn], base, drawn.id, base)
    expect(working).toEqual(base)
    expect(edit(working, 'session')).toEqual([])
  })

  it('restores a ghost to what it was, with no change left', () => {
    const ghosted = keepDeleted(base, [thu], tue.id, base)
    expect(edit(restoreBlock(ghosted, tue.id))).toEqual([])
  })

  it('sends every kind of change in one list: creates and moves, then deletes', () => {
    const drawn = newBlock(null, '2026-11-16', 600, 660)
    const placed = newBlock('week-4', '2026-11-15', 900, 960)
    const working = keepDeleted(
      [{ ...thu, start: 18 * 60 }, tue, drawn, placed],
      [{ ...thu, start: 18 * 60 }, drawn, placed],
      tue.id,
      base,
    )
    expect(edit(working, 'session').map((change) => change.op)).toEqual([
      'move-block',
      'create-item',
      'add-block',
      'delete-block',
    ])
  })
})
