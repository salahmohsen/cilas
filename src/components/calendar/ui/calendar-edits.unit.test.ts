import { describe, expect, it } from 'vitest'

import {
  changesOf,
  keepDeleted,
  rebase,
  restoreBlock,
  unsavedIdsOf,
} from '@/components/calendar/ui/calendar-edits'
import {
  blocksOf,
  copyBlock,
  newBlock,
  newItemId,
  type EditBlock,
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
const base = blocksOf(items)
const edit = (working: EditBlock[], newItemKind?: string) =>
  changesOf({ items, base, working, newItemKind })
const tue = base[0]!
const thu = base[1]!

describe('an all-day block', () => {
  const day = [
    {
      ...items[1]!,
      blocks: [{ id: 'wed', date: '2026-11-18', start_time: null, end_time: null }],
    },
  ]
  const dayBase = blocksOf(day)

  it('is flagged all day, and a move sends the new day with no times', () => {
    expect(dayBase).toEqual([
      expect.objectContaining({ id: 'week-4/wed', track: '2026-11-18', allDay: true }),
    ])
    const moved = { ...dayBase[0]!, track: '2026-11-20' }
    expect(changesOf({ items: day, base: dayBase, working: [moved] })).toEqual([
      {
        op: 'move-block',
        itemId: 'week-4',
        version: 'v4',
        blockId: 'wed',
        date: '2026-11-20',
        start_time: null,
        end_time: null,
      },
    ])
  })

  it('is copied all day, and a new one in a new item is sent as a create-item with no times', () => {
    const itemId = newItemId()
    const copy = copyBlock(dayBase[0]!, itemId, '2026-11-25')
    expect(copy).toMatchObject({ allDay: true, track: '2026-11-25', itemId })
    expect(
      changesOf({ items: day, base: dayBase, working: [...dayBase, copy], newItemKind: 'session' }),
    ).toEqual([
      {
        op: 'create-item',
        itemId: expect.any(String),
        kind: 'session',
        blocks: [{ blockId: copy.blockId, date: '2026-11-25', start_time: null, end_time: null }],
      },
    ])
  })
})

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
        itemId: expect.any(String),
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
        itemId: expect.any(String),
        kind: 'session',
        blocks: [
          { blockId: copy[0]!.blockId, date: '2026-11-24', start_time: '19:00', end_time: '21:00' },
          { blockId: copy[1]!.blockId, date: '2026-11-26', start_time: '19:00', end_time: '21:00' },
        ],
      },
      {
        op: 'create-item',
        itemId: expect.any(String),
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

describe('carrying edits to newly loaded items', () => {
  const moved = (block: EditBlock) => ({
    ...block,
    start: block.start + 60,
    end: block.end + 60,
  })
  const bump = (item: CalendarItem, blocks = item.blocks) => ({
    ...item,
    version: `${item.version}-b`,
    blocks,
  })

  it('keeps the edits of items that did not change', () => {
    const working = [moved(tue), thu]
    const next = rebase({
      current: items,
      items: [items[0]!, bump(items[1]!)],
      working,
      changed: new Set(['week-3']),
    })
    expect(next.working).toEqual(working)
    expect(next.dropped).toEqual([])
  })

  it('takes the loaded blocks of an item that changed, and names it when it had an edit', () => {
    const changedWeek3 = bump(items[0]!, [items[0]!.blocks[0]!])
    const next = rebase({
      current: items,
      items: [changedWeek3, items[1]!],
      working: [moved(tue), thu],
      changed: new Set(['week-3']),
    })
    expect(next.working).toEqual(blocksOf([changedWeek3]))
    expect(next.base).toEqual(blocksOf([changedWeek3, items[1]!]))
    expect(next.dropped).toEqual(['Week 3'])
  })

  it('names an item by its new title', () => {
    const renamed = { ...bump(items[0]!), title: 'Week three' }
    const next = rebase({
      current: items,
      items: [renamed, items[1]!],
      working: [moved(tue), thu],
      changed: new Set(['week-3']),
    })
    expect(next.dropped).toEqual(['Week three'])
  })

  it('does not name an item that changed but had no edit', () => {
    const next = rebase({
      current: items,
      items: [bump(items[0]!), items[1]!],
      working: base,
      changed: new Set(),
    })
    expect(next.dropped).toEqual([])
  })

  it('drops the blocks of an item that is gone, and keeps blocks of items made on the page', () => {
    const made = newBlock(newItemId(), '2026-11-20', 600, 660)
    const next = rebase({
      current: items,
      items: [items[1]!],
      working: [moved(tue), made],
      changed: new Set(['week-3']),
    })
    expect(next.working).toEqual([made])
    expect(next.dropped).toEqual(['Week 3'])
  })

  it('shows an item that is new', () => {
    const extra: CalendarItem = {
      ...items[1]!,
      id: 'extra',
      blocks: [{ id: 'x', date: '2026-11-18', start_time: '10:00', end_time: '11:00' }],
    }
    const next = rebase({
      current: items,
      items: [...items, extra],
      working: base,
      changed: new Set(),
    })
    expect(next.working).toEqual([...base, ...blocksOf([extra])])
  })
})

describe('a new block removed before Save', () => {
  it('sends no create command to the database', () => {
    const drawn = newBlock(newItemId(), '2026-11-16', 600, 660)
    const working = keepDeleted([...base, drawn], base, drawn.id, base)
    expect(edit(working, 'session')).toEqual([])
  })
})
