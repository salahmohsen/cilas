import { describe, expect, it } from 'vitest'

import { importWithEnv } from '../testing/env.test-utils'

describe('production environment boundaries on a server', () => {
  it('refuses local storage on a production server', async () => {
    await expect(
      importWithEnv(
        { NODE_ENV: 'production', R2_ENDPOINT: 'http://127.0.0.1:19000' },
        () => import('@/env'),
      ),
    ).rejects.toThrow('Production storage must use a Cloudflare R2 HTTPS endpoint')
  })

  it('accepts Cloudflare storage on a production server', async () => {
    const { env } = await importWithEnv(
      { NODE_ENV: 'production', R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com' },
      () => import('@/env'),
    )

    expect(env.R2_ENDPOINT).toBe('https://test.r2.cloudflarestorage.com')
  })
})
