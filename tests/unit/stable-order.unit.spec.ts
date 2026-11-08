import { describe, expect, it } from 'vitest'

import { keepOrder } from '@/components/space/stable-order'

describe('keepOrder', () => {
  it('keeps a post where it was when activity moves it up', () => {
    expect(keepOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['a', 'b', 'c'])
  })
  it('puts a new post first', () => {
    expect(keepOrder(['a', 'b'], ['n', 'b', 'a'])).toEqual(['n', 'a', 'b'])
  })
  it('adds more posts at the end', () => {
    expect(keepOrder(['a', 'b'], ['b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })
  it('drops a removed post', () => {
    expect(keepOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['a', 'c'])
  })
})
