import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('production environment boundaries', () => {
  it('loads public settings in a browser without reading server settings', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'public-widget-key')

    const { env } = await import('@/env')

    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('public-widget-key')
    expect(() => env.R2_ENDPOINT).toThrow('server-side environment variable on the client')
  })

  it('refuses local storage on a production server', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('R2_ENDPOINT', 'http://127.0.0.1:19000')
    vi.stubGlobal('window', undefined)

    await expect(import('@/env')).rejects.toThrow(
      'Production storage must use a Cloudflare R2 HTTPS endpoint',
    )
  })

  it('accepts Cloudflare storage on a production server', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('R2_ENDPOINT', 'https://test.r2.cloudflarestorage.com')
    vi.stubGlobal('window', undefined)

    const { env } = await import('@/env')

    expect(env.R2_ENDPOINT).toBe('https://test.r2.cloudflarestorage.com')
  })
})
