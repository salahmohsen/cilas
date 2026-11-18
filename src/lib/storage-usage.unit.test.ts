import { describe, expect, it } from 'vitest'

import { docBytes, sumByPrefix, sumDocBytes } from '@/lib/storage-usage'

describe('docBytes', () => {
  it('adds every image size variant to the file', () => {
    expect(
      docBytes({ filesize: 100, sizes: { thumbnail: { filesize: 10 }, card: { filesize: 20 } } }),
    ).toBe(130)
  })
  it('treats nulls and missing sizes as zero', () => {
    expect(docBytes({ filesize: null, sizes: { thumbnail: { filesize: null }, card: null } })).toBe(
      0,
    )
    expect(docBytes({ filesize: 5 })).toBe(5)
    expect(docBytes({})).toBe(0)
  })
})

describe('sumDocBytes', () => {
  it('is zero for no docs', () => expect(sumDocBytes([])).toBe(0))
  it('sums docs', () =>
    expect(sumDocBytes([{ filesize: 1, sizes: { a: { filesize: 2 } } }, { filesize: 4 }])).toBe(7))
})

describe('sumByPrefix', () => {
  it('groups by the first path part', () => {
    expect(
      sumByPrefix([
        { Key: 'media/a.webp', Size: 10 },
        { Key: 'media/b.webp', Size: 5 },
        { Key: 'spaces/x/y.webp', Size: 3 },
        { Key: 'loose.txt', Size: 2 },
        { Key: 'media/c.webp' },
      ]),
    ).toEqual({ media: 15, spaces: 3, '': 2 })
  })
  it('is empty for an empty listing', () => expect(sumByPrefix([])).toEqual({}))
})
