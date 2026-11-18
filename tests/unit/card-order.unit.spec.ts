import { describe, expect, it } from 'vitest'

import { moves, place } from '@/components/space/card-order'

describe('place', () => {
  const rows = ['a', 'b', 'c']

  it('moves a row down and up to the target index', () => {
    expect(place(rows, 0, 'a', 2)).toEqual(['b', 'c', 'a'])
    expect(place(rows, 2, 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(place(rows, 1, 'b', 1)).toEqual(rows)
  })

  it('inserts a new row at its target and keeps the others in order', () => {
    expect(place(rows, null, 'n', 3)).toEqual(['a', 'b', 'c', 'n'])
    expect(place(rows, null, 'n', 1)).toEqual(['a', 'n', 'b', 'c'])
  })

  it('clamps a target outside the list and leaves the input alone', () => {
    expect(place(rows, 0, 'a', 9)).toEqual(['b', 'c', 'a'])
    expect(place(rows, 2, 'c', -4)).toEqual(['c', 'a', 'b'])
    expect(rows).toEqual(['a', 'b', 'c'])
  })
})

describe('moves', () => {
  it('has no Move up for the first and no Move down for the last', () => {
    expect(moves(0, 3)).toEqual({ up: false, down: true })
    expect(moves(1, 3)).toEqual({ up: true, down: true })
    expect(moves(2, 3)).toEqual({ up: true, down: false })
  })

  it('has neither when the list holds one item', () => {
    expect(moves(0, 1)).toEqual({ up: false, down: false })
  })
})
