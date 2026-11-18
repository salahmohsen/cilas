import { describe, expect, it } from 'vitest'
import {
  decodeCursor,
  encodeCursor,
  fingerprint,
  inputSchema,
  permissionFilter,
  permits,
  projection,
  CursorReset,
} from '@/lib/private-search/model'

const source = {
  id: 42,
  space: 3,
  body: 'مرحبا learning [file](https://private/file) https://private/secret',
  updatedAt: '2026-10-28T00:00:00Z',
}
describe('private search boundary', () => {
  it('fails closed for empty permissions and forged selection', () => {
    expect(permissionFilter({ ids: [], gated: new Map() })).toBeNull()
    expect(permissionFilter({ ids: [3], gated: new Map() }, 4)).toBeNull()
    expect(() => permissionFilter({ ids: [NaN], gated: new Map() })).toThrow()
  })
  it('binds each intro to its own space and intersects selection with the entire predicate', () => {
    const e = {
      ids: [1, 2, 3],
      gated: new Map([
        [2, 42],
        [3, 51],
      ]),
    }
    expect(permissionFilter(e, 2)).toBe(
      '(spaceId:=[1] || (spaceId:=2 && postId:=42) || (spaceId:=3 && postId:=51)) && spaceId:=2',
    )
    expect(permits(e, 3, 42)).toBe(false)
    expect(permits(e, 2, 42)).toBe(true)
  })
  it('projects only content and routing, removes URL targets and tombstones', () => {
    const doc = projection('post', { ...source, email: 'secret@example.com' } as typeof source)
    expect(doc?.body).toBe('مرحبا learning file ')
    expect(Object.keys(doc!)).toEqual([
      'id',
      'sourceId',
      'kind',
      'spaceId',
      'postId',
      'title',
      'body',
      'updatedAt',
      'sourceRevision',
    ])
    expect(projection('post', { ...source, deleted_at: 'today' })).toBeNull()
    expect(projection('comment', source)).toBeNull()
    expect(projection('post', { ...source, body: 'changed' })?.sourceRevision).not.toBe(
      doc?.sourceRevision,
    )
  })
  it('rejects engine passthrough, wildcard browsing, huge queries and invalid sorts', () => {
    for (const input of [
      { query: '*' },
      { query: 'a'.repeat(161) },
      { query: 'hello', filter_by: 'spaceId:>0' },
      { query: 'hello', searches: [] },
      { query: 'hello', space: '1 || true' },
    ]) {
      expect(inputSchema.safeParse(input).success).toBe(false)
    }
  })
  it('accepts browsing, multiple spaces, none and alpha while rejecting ambiguous or forged selections', () => {
    expect(inputSchema.parse({ query: '', spaces: [], sort: 'alpha' })).toMatchObject({
      spaces: [],
      sort: 'alpha',
    })
    expect(inputSchema.parse({ query: 'a', spaces: [1, 2] }).spaces).toEqual([1, 2])
    for (const input of [
      { query: 'needle', space: 1, spaces: [1] },
      { query: 'needle', spaces: ['1'] },
      { query: 'needle', spaces: [-1] },
      { query: 'needle', spaces: Array.from({ length: 2001 }, (_, i) => i + 1) },
    ])
      expect(inputSchema.safeParse(input).success).toBe(false)
  })
  it('authenticates pagination against every request binding and expiry', () => {
    const binding = fingerprint([1, 'query', [3], 'generation'])
    const token = encodeCursor({ binding, offset: 29, expires: Date.now() + 10000 }, 'secret')
    expect(decodeCursor(token, binding, 'secret')).toBe(29)
    for (const [value, expectedBinding, secret] of [
      [token + 'x', binding, 'secret'],
      [token, fingerprint([2]), 'secret'],
      [token, binding, 'other'],
    ]) {
      expect(() => decodeCursor(value, expectedBinding, secret)).toThrow(CursorReset)
    }
    expect(() =>
      decodeCursor(encodeCursor({ binding, offset: 0, expires: 0 }, 'secret'), binding, 'secret'),
    ).toThrow(CursorReset)
  })
})
