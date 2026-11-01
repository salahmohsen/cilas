import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildServerError, ErrorLimiter } from '@/lib/analytics/server-error'

const capture = vi.fn()
vi.mock('posthog-node', () => ({
  PostHog: class {
    captureExceptionImmediate = capture
  },
}))

const failure = (message: string) => {
  const error = new Error(message)
  error.name = 'TypeError'
  return error
}

describe('building a server error report', () => {
  it('keeps a public page error, cleaned of emails and secrets, and drops the query', () => {
    const report = buildServerError(
      failure('Cannot read x for jo@example.org token=abc123'),
      { path: '/en/articles/hello?token=secret&email=a@b.co', method: 'GET' },
      { routePath: '/[locale]/articles/[slug]', routeType: 'render' },
    )
    expect(report?.error.message).not.toContain('jo@example.org')
    expect(report?.error.message).not.toContain('abc123')
    expect(report?.properties).toMatchObject({
      $process_person_profile: false,
      route: '/[locale]/articles/[slug]',
      $current_url: '/en/articles/hello',
    })
    expect(JSON.stringify(report)).not.toContain('secret')
  })

  it.each(['/en/spaces/12/posts/3', '/admin/collections/users/4', '/api/users/me'])(
    'withholds the message and the address for the private route %s',
    (path) => {
      const report = buildServerError(
        failure('Comment "my secret plan" failed'),
        { path, method: 'POST' },
        { routePath: '/some/[route]' },
      )
      expect(report?.error.message).toContain('withheld')
      expect(JSON.stringify(report?.properties)).not.toContain(path)
      expect(report?.error.stack).not.toContain('secret plan')
      expect(report?.properties.route).toBe('/some/[route]')
    },
  )

  it('keeps the code location of the stack', () => {
    const report = buildServerError(
      failure('x'),
      { path: '/en/about', method: 'GET' },
      { routePath: '/a' },
    )
    expect(report?.error.stack).toMatch(/\n\s+at /)
  })

  it('reports nothing for noise, redirects, not-found and bot probes', () => {
    const info = { path: '/en/about', method: 'GET' }
    expect(buildServerError(failure('The operation was aborted'), info, {})).toBeNull()
    expect(
      buildServerError(Object.assign(new Error('x'), { digest: 'NEXT_NOT_FOUND' }), info, {}),
    ).toBeNull()
    expect(
      buildServerError(failure('boom'), { path: '/wp-login.php', method: 'GET' }, {}),
    ).toBeNull()
    expect(buildServerError(failure('boom'), { path: '/x/.env', method: 'GET' }, {})).toBeNull()
  })

  it('handles a thrown string', () => {
    const report = buildServerError('plain', { path: '/en', method: 'GET' }, {})
    expect(report?.error.message).toBe('plain')
  })
})

describe('the error limiter', () => {
  it('lets one fault through once per window', () => {
    const limiter = new ErrorLimiter(1000, 10)
    expect(limiter.allow('a', 0)).toBe(true)
    expect(limiter.allow('a', 500)).toBe(false)
    expect(limiter.allow('b', 500)).toBe(true)
    expect(limiter.allow('a', 1500)).toBe(true)
  })

  it('caps the whole process per hour', () => {
    const limiter = new ErrorLimiter(0, 3)
    expect([1, 2, 3, 4].map((n) => limiter.allow(`e${n}`, n))).toEqual([true, true, true, false])
    expect(limiter.allow('later', 3_700_000)).toBe(true)
  })
})

describe('reporting to PostHog', () => {
  beforeEach(() => {
    vi.resetModules()
    capture.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => vi.unstubAllEnvs())

  const report = async (message: string, path = '/en/about') => {
    const { reportServerError } = await import('@/lib/analytics/server')
    await reportServerError(failure(message), { path, method: 'GET' }, { routePath: '/p' })
  }

  it('sends nothing without a key', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    await report('boom')
    expect(capture).not.toHaveBeenCalled()
  })

  it('sends one report with a key, and not the same fault again', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    await report('boom')
    await report('boom')
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0]?.[1]).toBe('cilas-server')
  })

  it('never throws when PostHog fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    capture.mockRejectedValue(new Error('network down'))
    await expect(report('another')).resolves.toBeUndefined()
  })

  it('gives up on a slow PostHog', async () => {
    vi.useFakeTimers()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    capture.mockReturnValue(new Promise(() => {}))
    const done = report('slow one')
    await vi.advanceTimersByTimeAsync(3000)
    await expect(done).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
