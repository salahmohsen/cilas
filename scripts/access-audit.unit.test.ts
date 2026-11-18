import type { CollectionConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { overrideApiKeyCollection } from '@/plugins/mcp/api-keys'

import { sourceSetsAccess, UPSTREAM } from './access-audit'

const listed = (entity: string) =>
  new Set(UPSTREAM.filter((entry) => entry.entity === entity).map((entry) => entry.field))

describe('UPSTREAM lists only rules that Payload adds', () => {
  it('finds a rule that src puts on a field', () => {
    expect(
      sourceSetsAccess([{ name: 'salt', type: 'text', access: { create: () => false } }]),
    ).toEqual(['salt'])
    expect(sourceSetsAccess([{ name: 'salt', type: 'text', access: {} }])).toEqual([])
  })

  it('src sets no rule on a field of users that UPSTREAM lists', () => {
    expect(
      sourceSetsAccess(Users.fields).filter((path) => listed('collection:users').has(path)),
    ).toEqual([])
  })

  it('the API key override sets no rule on a field that UPSTREAM lists', () => {
    const fields = ['user', 'apiKey', 'apiKeyIndex'].map((name) => ({ name, type: 'text' }))
    const overridden = overrideApiKeyCollection({
      slug: 'payload-mcp-api-keys',
      fields,
    } as unknown as CollectionConfig)
    expect(
      sourceSetsAccess(overridden.fields).filter((path) =>
        listed('collection:payload-mcp-api-keys').has(path),
      ),
    ).toEqual([])
  })
})
