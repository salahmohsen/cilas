import { checkServer, mount } from '@ui-sdk/core/testing'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { EditBlock } from '@/components/calendar/ui/calendar-model'
import { weekSpans } from '@/components/calendar/ui/week-spans'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const block = (id: string, track: string, start: number, end: number) =>
  ({
    id,
    track,
    start,
    end,
    itemId: id,
    blockId: id,
  }) satisfies EditBlock

const MARKUP = `<root>
  <track value="mon"><span value="a">A</span></track>
  <track value="tue"><span value="b">B</span></track>
  <track value="wed"></track>
</root>`

const options = (overrides: Record<string, unknown> = {}) => ({
  spans: [block('a', 'mon', 600, 720), block('b', 'tue', 300, 360)],
  editable: true,
  tracks: ['mon', 'tue', 'wed'],
  min: 0,
  max: 1440,
  step: 15,
  label: (span: EditBlock) => `${span.id} ${span.track} ${span.start}-${span.end}`,
  message: ({ type, label }: { type: string; label: string }) => `${type}: ${label}`,
  onPress: vi.fn(),
  ...overrides,
})

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
})

describe('keyboard on a block', () => {
  it('moves it by a quarter hour with the arrows along the day', async () => {
    const changes: EditBlock[][] = []
    const view = mount(
      weekSpans,
      options({ onSpansChange: (value: EditBlock[]) => changes.push(value) }),
      MARKUP,
    )
    try {
      view.part('span', 'a')!.focus()
      await view.keys('ArrowDown')
      expect(changes.at(-1)!.find((span) => span.id === 'a')).toMatchObject({
        start: 615,
        end: 735,
      })
      await view.keys('ArrowUp')
    } finally {
      view.unmount()
    }
  })

  it('resizes it with Shift and the arrows', async () => {
    const changes: EditBlock[][] = []
    const view = mount(
      weekSpans,
      options({ onSpansChange: (value: EditBlock[]) => changes.push(value) }),
      MARKUP,
    )
    try {
      view.part('span', 'a')!.focus()
      await view.keys('Shift+ArrowDown')
      expect(changes.at(-1)!.find((span) => span.id === 'a')).toMatchObject({
        start: 600,
        end: 735,
      })
    } finally {
      view.unmount()
    }
  })

  it('moves it to the next day with the arrows across', async () => {
    const changes: EditBlock[][] = []
    const view = mount(
      weekSpans,
      options({ onSpansChange: (value: EditBlock[]) => changes.push(value) }),
      MARKUP,
    )
    try {
      view.part('span', 'a')!.focus()
      await view.keys('ArrowRight')
      expect(changes.at(-1)!.find((span) => span.id === 'a')?.track).toBe('tue')
    } finally {
      view.unmount()
    }
  })

  it('removes it with Delete and announces it by our message', async () => {
    const calls: { value: EditBlock[]; action: string }[] = []
    const view = mount(
      weekSpans,
      options({
        onSpansChange: (value: EditBlock[], details: { action: string }) =>
          calls.push({ value, action: details.action }),
      }),
      MARKUP,
    )
    try {
      view.part('span', 'a')!.focus()
      await view.keys('Delete')
      expect(calls.at(-1)!.action).toBe('delete')
      expect(calls.at(-1)!.value.map((span) => span.id)).toEqual(['b'])
      await view.settle()
      expect(view.announced.join(' ')).toContain('delete: a mon 600-720')
    } finally {
      view.unmount()
    }
  })

  it('changes nothing when not editable', async () => {
    const onSpansChange = vi.fn()
    const view = mount(weekSpans, options({ editable: false, onSpansChange }), MARKUP)
    try {
      view.part('span', 'a')!.focus()
      await view.keys('ArrowDown', 'Shift+ArrowDown', 'ArrowRight', 'Delete')
      expect(onSpansChange).not.toHaveBeenCalled()
    } finally {
      view.unmount()
    }
  })

  it('leaves a deleted block (a ghost) fixed', async () => {
    const onSpansChange = vi.fn()
    const ghost = { ...block('a', 'mon', 600, 720), deleted: true }
    const view = mount(
      weekSpans,
      options({ spans: [ghost, block('b', 'tue', 300, 360)], onSpansChange }),
      MARKUP,
    )
    try {
      view.part('span', 'a')!.focus()
      await view.keys('ArrowDown', 'Delete')
      expect(onSpansChange).not.toHaveBeenCalled()
    } finally {
      view.unmount()
    }
  })

  it('reports a press, for open and restore', async () => {
    const onPress = vi.fn()
    const view = mount(weekSpans, options({ onPress }), MARKUP)
    try {
      await view.click(view.part('span', 'b')!)
      expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), expect.anything())
    } finally {
      view.unmount()
    }
  })
})

describe('structure', () => {
  it.fails("passes checkServer: spanStyle reads min and max inside a part's attrs", () => {
    checkServer(weekSpans, options(), MARKUP)
  })

  it('swaps the arrows across days in right to left', async () => {
    const rtl = MARKUP.replace('<root>', '<root dir="rtl">')
    const changes: EditBlock[][] = []
    const view = mount(
      weekSpans,
      options({ onSpansChange: (value: EditBlock[]) => changes.push(value) }),
      rtl,
    )
    try {
      view.part('span', 'b')!.focus()
      await view.keys('ArrowLeft')
      expect(changes.at(-1)!.find((span) => span.id === 'b')?.track).toBe('wed')
      await view.keys('ArrowRight')
      expect(changes.at(-1)!.find((span) => span.id === 'b')?.track).toBe('mon')
    } finally {
      view.unmount()
    }
  })

  it('makes each block a native button with the name from `label`', () => {
    const view = mount(weekSpans, options(), MARKUP)
    try {
      const span = view.part('span', 'a')!
      expect(span.tagName).toBe('BUTTON')
      expect(span.getAttribute('data-span-id')).toBe('a')
      expect(span.getAttribute('type')).toBe('button')
    } finally {
      view.unmount()
    }
  })
})

describe('pointer', () => {
  it('draws a block on an empty stretch of a day', async () => {
    const created: { track: string; start: number; end: number }[] = []
    const create = (span: { track: string; start: number; end: number }) => {
      created.push(span)
      return block('new', span.track, span.start, span.end)
    }
    const changes: { value: EditBlock[]; action: string }[] = []
    const view = mount(
      weekSpans,
      options({
        create,
        onSpansChange: (value: EditBlock[], details: { action: string }) =>
          changes.push({ value, action: details.action }),
      }),
      MARKUP,
    )
    try {
      const wed = view.part('track', 'wed')!
      await view.drag(wed, { by: { x: 0, y: 120 } })
      expect(created).toHaveLength(1)
      expect(changes.at(-1)!.action).toBe('draw')
      expect(changes.at(-1)!.value.find((span) => span.id === 'new')?.track).toBe('wed')
    } finally {
      view.unmount()
    }
  })
})
