import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { importWithEnv } from '../../../testing/env.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'

const engine = 'http://private-engine:8109'

const configured = {
  PRIVATE_SPACES_SEARCH: 'true',
  PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: 'true',
  NEXT_PUBLIC_TYPESENSE_API_KEY: 'public',
  TYPESENSE_PRIVATE_SEARCH_KEY: 'read',
  TYPESENSE_PRIVATE_WRITE_KEY: 'write',
  TYPESENSE_HOST: 'public-engine',
  TYPESENSE_PORT: '8108',
  TYPESENSE_PROTOCOL: 'http',
  TYPESENSE_PRIVATE_HOST: 'private-engine',
  TYPESENSE_PRIVATE_PORT: '8109',
  TYPESENSE_PRIVATE_PROTOCOL: 'http',
}

const configWith = (vars: Record<string, string> = {}) =>
  importWithEnv({ ...configured, ...vars }, () => import('@/lib/private-search/config'))

const health = (ok: boolean) => http.get(`${engine}/health`, () => HttpResponse.json({ ok }))
const denyOperations = (status: number) => [
  http.get(`${engine}/collections/:name/documents/search`, () =>
    HttpResponse.json({ message: 'denied' }, { status }),
  ),
  http.get(`${engine}/collections/:name/documents/export`, () =>
    HttpResponse.json({ message: 'denied' }, { status }),
  ),
  http.get(`${engine}/keys`, () => HttpResponse.json({ message: 'denied' }, { status })),
]

const network = mockNetwork()

describe('private search release boundary', () => {
  it('requires both the feature switch and the completed credential audit', async () => {
    expect((await configWith()).privateSearchEnabled()).toBe(true)
    expect(
      (await configWith({ PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: 'false' })).privateSearchEnabled(),
    ).toBe(false)
    expect((await configWith({ PRIVATE_SPACES_SEARCH: 'false' })).privateSearchEnabled()).toBe(
      false,
    )
  })

  it('refuses maintenance before the retired-key audit and while the private engine is unhealthy', async () => {
    const unaudited = await configWith({ PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: 'false' })
    await expect(unaudited.assertPrivateSearchIsolation()).rejects.toThrow('not been verified')
    const audited = await configWith()
    network.use(health(false))
    await expect(audited.assertPrivateSearchIsolation()).rejects.toThrow('not healthy')
  })

  it('accepts the engine when the public credentials are denied every private operation', async () => {
    const { assertPrivateSearchIsolation } = await configWith()
    network.use(health(true), ...denyOperations(401))
    await expect(assertPrivateSearchIsolation()).resolves.toBeUndefined()
  })

  it.each([404, 500])(
    'requires authorization denial rather than a missing collection or a %s',
    async (status) => {
      const { assertPrivateSearchIsolation } = await configWith()
      network.use(health(true), ...denyOperations(status))
      await expect(assertPrivateSearchIsolation()).rejects.toThrow('private operation')
    },
  )

  it('requires authorization denial rather than a transport failure', async () => {
    const { assertPrivateSearchIsolation } = await configWith()
    network.use(
      health(true),
      http.get(`${engine}/collections/:name/documents/search`, () => HttpResponse.error()),
    )
    await expect(assertPrivateSearchIsolation()).rejects.toThrow('private operation')
  })

  it('sends distinct server credentials only to the configured private endpoint', async () => {
    const { privateClient } = await configWith()
    const keys: Array<string | null> = []
    network.use(
      http.get(`${engine}/health`, ({ request }) => {
        keys.push(request.headers.get('x-typesense-api-key'))
        return HttpResponse.json({ ok: true })
      }),
    )
    await privateClient('read').health.retrieve()
    await privateClient('write').health.retrieve()
    expect(keys).toEqual(['read', 'write'])
  })
})
