import { describe, expect, it, vi } from 'vitest'

describe('production environment boundaries in a browser', () => {
  it('loads public settings in a browser without reading server settings', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'public-widget-key')

    const { env } = await import('@/env')

    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('public-widget-key')
    expect(() => env.R2_ENDPOINT).toThrow('server-side environment variable on the client')
  })
})
