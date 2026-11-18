import { describe, expect, it } from 'vitest'

import { importWithEnv } from '../testing/env.test-utils'

describe('client environment', () => {
  it('reads the public settings the build writes in', async () => {
    const { clientEnv } = await importWithEnv(
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key', NEXT_PUBLIC_TYPESENSE_PORT: '443' },
      () => import('@/env.client'),
    )
    expect(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('site-key')
    expect(clientEnv.NEXT_PUBLIC_TYPESENSE_PORT).toBe(443)
  })

  it('treats a blank setting as unset and falls back to the defaults', async () => {
    const { clientEnv, clientDefaults } = await importWithEnv(
      {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
        NEXT_PUBLIC_TYPESENSE_HOST: '',
        NEXT_PUBLIC_TYPESENSE_PORT: '',
      },
      () => import('@/env.client'),
    )
    expect(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined()
    expect(clientEnv.NEXT_PUBLIC_TYPESENSE_HOST).toBe(clientDefaults.NEXT_PUBLIC_TYPESENSE_HOST)
    expect(clientEnv.NEXT_PUBLIC_TYPESENSE_PORT).toBe(clientDefaults.NEXT_PUBLIC_TYPESENSE_PORT)
  })
})
