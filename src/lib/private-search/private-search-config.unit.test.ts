import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  env: {
    PRIVATE_SPACES_SEARCH: 'true',
    PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: 'true',
    NEXT_PUBLIC_TYPESENSE_API_KEY: 'public',
    TYPESENSE_PRIVATE_SEARCH_KEY: 'read',
    TYPESENSE_PRIVATE_WRITE_KEY: 'write',
    TYPESENSE_HOST: 'public-engine',
    TYPESENSE_PORT: 8108,
    TYPESENSE_PROTOCOL: 'http',
    TYPESENSE_PRIVATE_HOST: 'private-engine',
    TYPESENSE_PRIVATE_PORT: 8109,
    TYPESENSE_PRIVATE_PROTOCOL: 'http',
  },
  denial: 401,
  healthy: true,
  clients: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/env', () => ({ env: state.env }))
vi.mock('typesense', () => ({
  Client: class {
    constructor(options: Record<string, unknown>) {
      state.clients.push(options)
    }
    health = { retrieve: async () => ({ ok: state.healthy }) }
    collections = () => ({
      documents: () => ({
        search: async () => {
          throw { httpStatus: state.denial }
        },
        export: async () => {
          throw { httpStatus: state.denial }
        },
      }),
    })
    keys = () => ({
      retrieve: async () => {
        throw { httpStatus: state.denial }
      },
    })
  },
}))
import {
  assertPrivateSearchIsolation,
  privateClient,
  privateSearchEnabled,
} from '@/lib/private-search/config'

describe('private search release boundary', () => {
  beforeEach(() => {
    state.env.PRIVATE_SPACES_SEARCH = 'true'
    state.env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED = 'true'
    state.denial = 401
    state.healthy = true
    state.clients.length = 0
  })
  it('requires both the feature switch and the completed credential audit', () => {
    expect(privateSearchEnabled()).toBe(true)
    state.env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED = 'false'
    expect(privateSearchEnabled()).toBe(false)
    state.env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED = 'true'
    state.env.PRIVATE_SPACES_SEARCH = 'false'
    expect(privateSearchEnabled()).toBe(false)
  })
  it('refuses maintenance before the retired-key audit and while the private engine is unhealthy', async () => {
    state.env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED = 'false'
    await expect(assertPrivateSearchIsolation()).rejects.toThrow('not been verified')
    expect(state.clients).toHaveLength(0)
    state.env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED = 'true'
    state.healthy = false
    await expect(assertPrivateSearchIsolation()).rejects.toThrow('not healthy')
  })
  it('requires authorization denial rather than a missing collection or transport failure', async () => {
    await expect(assertPrivateSearchIsolation()).resolves.toBeUndefined()
    for (const status of [404, 500, 0]) {
      state.denial = status
      await expect(assertPrivateSearchIsolation()).rejects.toThrow('private operation')
    }
  })
  it('sends distinct server credentials only to the configured private endpoint', () => {
    privateClient('read')
    privateClient('write')
    expect(state.clients.map((c) => c.apiKey)).toEqual(['read', 'write'])
    expect(
      state.clients.every(
        (c) =>
          JSON.stringify(c.nodes) ===
          JSON.stringify([{ host: 'private-engine', port: 8109, protocol: 'http' }]),
      ),
    ).toBe(true)
  })
})
