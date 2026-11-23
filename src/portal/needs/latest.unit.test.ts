import { describe, expect, it } from 'vitest'

import { LATEST_PAGE, latestPagesOf } from './latest'

describe('latestPagesOf', () => {
  it.each([
    ['2', 60],
    ['10', 300],
    [undefined, 30],
    ['abc', 30],
    ['0', 30],
    ['-1', 30],
    ['1.5', 30],
    ['99999', 30],
    ['', 30],
  ])('latest=%s reads %i rows', (value, rows) => {
    expect(LATEST_PAGE * latestPagesOf(value)).toBe(rows)
  })

  it('reads the first value of a repeated parameter', () => {
    expect(latestPagesOf(['3', '5'])).toBe(3)
  })
})
