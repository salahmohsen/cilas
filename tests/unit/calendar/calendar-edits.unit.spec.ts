import { describe, expect, it } from 'vitest'

import {
  changesOf,
  keepDeleted,
  restoreBlock,
  unsavedIdsOf,
} from '@/components/calendar/ui/calendar-edits'
import {
  newBlock,
  newItemId,
  timedBlocks,
  type TimedBlock,
} from '@/components/calendar/ui/calendar-model'
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
    const drawn = newBlock(newItemId(), '2026-11-16', 600, 660)
    expect(edit([...base, drawn], 'session')).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          {
            blockId: drawn.blockId,
            date: '2026-11-16',
            start_time: '10:00',
            end_time: '11:00',
          },
        ],
      },
    ])
  })

  it('sends the blocks of one new item as one create-item, and another new item as another', () => {
    const first = newItemId()
    const copy = [
      newBlock(first, '2026-11-24', 1140, 1260),
      newBlock(first, '2026-11-26', 1140, 1260),
    ]
    const other = newBlock(newItemId(), '2026-11-16', 600, 660)
    expect(edit([...base, ...copy, other], 'session')).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          { blockId: copy[0]!.blockId, date: '2026-11-24', start_time: '19:00', end_time: '21:00' },
          { blockId: copy[1]!.blockId, date: '2026-11-26', start_time: '19:00', end_time: '21:00' },
        ],
      },
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          { blockId: other.blockId, date: '2026-11-16', start_time: '10:00', end_time: '11:00' },
        ],
      },
    ])
  })

  it('drops a new item when its last block is deleted', () => {
    const item = newItemId()
    const first = newBlock(item, '2026-11-24', 1140, 1260)
    const second = newBlock(item, '2026-11-26', 1140, 1260)
    const working = keepDeleted([...base, first, second], [...base, first], second.id, base)
    expect(edit(working, 'session')).toMatchObject([
      { op: 'create-item', blocks: [{ blockId: first.blockId }] },
    ])
    expect(edit(keepDeleted(working, base, first.id, base), 'session')).toEqual([])
  })

  it('refuses to draw when the host named no kind for new items', () => {
    expect(() => edit([...base, newBlock(newItemId(), '2026-11-16', 600, 660)])).toThrow(/no kind/)
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
    const drawn = newBlock(newItemId(), '2026-11-16', 600, 660)
    const working = keepDeleted([...base, drawn], base, drawn.id, base)
    expect(working).toEqual(base)
    expect(edit(working, 'session')).toEqual([])
  })

  it('restores a ghost to what it was, with no change left', () => {
    const ghosted = keepDeleted(base, [thu], tue.id, base)
    expect(edit(restoreBlock(ghosted, tue.id))).toEqual([])
  })

  it('sends every kind of change in one list: moves and placements, new items, then deletes', () => {
    const drawn = newBlock(newItemId(), '2026-11-16', 600, 660)
    const placed = newBlock('week-4', '2026-11-15', 900, 960)
    const working = keepDeleted(
      [{ ...thu, start: 18 * 60 }, tue, drawn, placed],
      [{ ...thu, start: 18 * 60 }, drawn, placed],
      tue.id,
      base,
    )
    expect(edit(working, 'session').map((change) => change.op)).toEqual([
      'move-block',
      'add-block',
      'create-item',
      'delete-block',
    ])
  })
})
