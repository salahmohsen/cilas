import { describe, expect, it } from 'vitest'

import { srcOverlapsUpstream } from './access-audit'

const field = (name: string, access?: Record<string, unknown>) => ({ name, type: 'text', access })

describe('srcOverlapsUpstream', () => {
  it('finds a rule that src puts on a field that UPSTREAM lists', () => {
    expect(
      srcOverlapsUpstream({
        collections: [
          { slug: 'users', fields: [field('salt', { create: () => false }), field('name')] },
        ],
      } as never),
    ).toEqual(['collection:users salt create'])
  })

  it('ignores an operation that UPSTREAM does not list for the field', () => {
    expect(
      srcOverlapsUpstream({
        collections: [{ slug: 'users', fields: [field('salt', { read: () => false })] }],
      } as never),
    ).toEqual([])
  })

  it('finds a rule that src puts on a whole entity that UPSTREAM lists', () => {
    expect(
      srcOverlapsUpstream({
        collections: [{ slug: 'payload-kv', access: { read: () => false }, fields: [] }],
      } as never),
    ).toEqual(['collection:payload-kv * read'])
  })
})
