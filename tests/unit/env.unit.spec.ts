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
    vi.stubEnv('PMOAUTH_TOKEN_PEPPER', 'p'.repeat(32))
    vi.stubGlobal('window', undefined)

    const { env } = await import('@/env')

    expect(env.R2_ENDPOINT).toBe('https://test.r2.cloudflarestorage.com')
  })

  describe('the assistant sign-in secret', () => {
    const production = () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('R2_ENDPOINT', 'https://test.r2.cloudflarestorage.com')
      vi.stubGlobal('window', undefined)
    }

    it('is required by a production server', async () => {
      production()
      vi.stubEnv('PMOAUTH_TOKEN_PEPPER', '')
      await expect(import('@/env')).rejects.toThrow('PMOAUTH_TOKEN_PEPPER is required')
    })

    it('must be 32 characters or more', async () => {
      production()
      vi.stubEnv('PMOAUTH_TOKEN_PEPPER', 'too-short')
      await expect(import('@/env')).rejects.toThrow()
    })

    it('is not needed while building', async () => {
      production()
      vi.stubEnv('NEXT_PHASE', 'phase-production-build')
      vi.stubEnv('PMOAUTH_TOKEN_PEPPER', '')
      const { env } = await import('@/env')
      expect(env.PMOAUTH_TOKEN_PEPPER).toBeUndefined()
    })
  })
})
