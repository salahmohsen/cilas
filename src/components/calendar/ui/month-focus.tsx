'use client'

import {
  byCell,
  createGridFocus,
  definePrimitive,
  isRTL,
  selects,
  type GridCell,
} from '@ui-sdk/core'
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive'
import { useEffect, type ComponentProps, type ReactNode } from 'react'

type MonthGridOptions = { rows: number; start: GridCell }
type MonthGridState = { active: GridCell | null }

const sameCell = (a: GridCell | null, b: GridCell) => a?.row === b.row && a.col === b.col

const monthGrid = definePrimitive({
  name: 'month-grid',
  options: { rows: 'number', start: 'value' },
  state: (options: MonthGridOptions): MonthGridState => ({ active: options.start }),
  api: (context) => {
    const rows = () => (context.options() as MonthGridOptions).rows
    return {
      rows,
      grid: createGridFocus<MonthGridState>(context, { key: 'active', rows, cols: () => 7 }),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: 'grid',
      keys: { none: 'Focus stays on a day, whose keydown handles them.' },
    }),
    row: slot<{ value: string }>({ props: { value: 'string' }, role: 'row' }),
    cell: slot<{ value: string; row: number; col: number }>({
      props: { value: 'string', row: 'number', col: 'number' },
      role: 'gridcell',
      focus: 'roving',
      selects: selects({ active: byCell }),
      keys: [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'mod+Home',
        'mod+End',
        'PageUp',
        'PageDown',
        'Enter',
        ' ',
      ],
      attrs: (state, { props, api }) => ({ tabindex: api.grid.tabIndex(state, props) }),
      on: {
        keydown: (event, { api, el }) => {
          const from = api.grid.active()
          api.grid.keydown(event)
          if (!from || !sameCell(api.grid.active(), from)) return
          // A day follows the day before it: past a row's end, Left and Right go on to the next row.
          const rows = api.rows()
          const forward = event.key === (isRTL(el) ? 'ArrowLeft' : 'ArrowRight')
          const back = event.key === (isRTL(el) ? 'ArrowRight' : 'ArrowLeft')
          const to =
            forward && from.col === 6 && from.row < rows - 1
              ? { row: from.row + 1, col: 0 }
              : back && from.col === 0 && from.row > 0
                ? { row: from.row - 1, col: 6 }
                : null
          if (!to) return
          event.preventDefault()
          api.grid.focus(to, { reason: 'list-navigation', event })
        },
        // A day focused another way, like from code, takes the tab stop too.
        focus: (event, { api, props }) => {
          if (event.target === event.currentTarget && !sameCell(api.grid.active(), props))
            api.grid.focus(props, { reason: 'imperative', event })
        },
        pointerdown: (event, { api, props, store }) => {
          // A press on a chip keeps focus on the chip; its day still takes the tab stop.
          if ((event.target as Element).closest('button'))
            store.set({ active: { row: props.row, col: props.col } })
          else api.grid.focus(props, { reason: 'item-press', event })
        },
      },
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
})

const parts = createParts(monthGrid, { root: 'div', row: 'div', cell: 'div' })

type RootProps = MonthGridOptions & {
  /** Focus the start day once it renders, after the keyboard turned the month. */
  focusStart: boolean
  children: ReactNode
} & Omit<ComponentProps<'div'>, 'children'>

function Root({ rows, start, focusStart, ...props }: RootProps) {
  const handle = usePrimitive(monthGrid, { rows, start })
  useEffect(() => {
    if (focusStart) handle.api.grid.focus(start, { reason: 'list-navigation' })
    // Once per month: the grid remounts with each month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return usePart(handle, 'root', {}, props, 'div')
}

export const MonthFocus = { Root, Row: parts.Row, Cell: parts.Cell }
export type { GridCell }
