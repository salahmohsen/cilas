import { cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { failureMessage, useSpamCheck } from '@/components/forms/spam-check'
import { TURNSTILE_HEADER } from '@/lib/turnstile'

const widget = vi.hoisted(() => ({ token: vi.fn(), reset: vi.fn() }))
vi.mock('@/env.client', () => ({ clientEnv: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-key' } }))
vi.mock('next-intl', () => ({ useLocale: () => 'en' }))
vi.mock('@marsidev/react-turnstile', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    Turnstile: forwardRef(function TestTurnstile(_props, ref) {
      useImperativeHandle(ref, () => ({ getResponsePromise: widget.token, reset: widget.reset }))
      return null
    }),
  }
})

const submission = { form: 7, submissionData: [{ field: 'name', value: 'Nour' }] }
const mount = () => {
  const { result } = renderHook(() => useSpamCheck())
  const view = render(result.current.fields)
  return { spam: result.current, ...view }
}

beforeEach(() => {
  widget.token.mockReset().mockResolvedValue('verified-token')
  widget.reset.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 201 })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('guarded form submission', () => {
  it('sends JSON with its token and renews the token afterward', async () => {
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(fetch).toHaveBeenCalledWith('/api/form-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TURNSTILE_HEADER]: 'verified-token' },
      body: JSON.stringify(submission),
    })
    expect(widget.reset).toHaveBeenCalledTimes(1)
  })

  it('sends answers and files together under a single token', async () => {
    const { spam } = mount()
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
    expect(await spam.submit(submission, [['attachment', file]])).toEqual({ kind: 'sent' })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/form-submissions/with-files')
    expect(init?.headers).toEqual({ [TURNSTILE_HEADER]: 'verified-token' })
    const body = init!.body as FormData
    expect(JSON.parse(String(body.get('payload')))).toEqual(submission)
    expect((body.get('file:attachment') as File).name).toBe('note.txt')
    expect(widget.token).toHaveBeenCalledTimes(1)
  })

  it('names a bot without sending anything', async () => {
    const { spam, container } = mount()
    container.querySelector<HTMLInputElement>('input[name="website"]')!.value = 'bot'
    expect(await spam.submit(submission)).toEqual({ kind: 'bot' })
    expect(fetch).not.toHaveBeenCalled()
    expect(widget.token).not.toHaveBeenCalled()
  })

  it('names a failed spam check without sending, and renews the token', async () => {
    const { spam } = mount()
    widget.token.mockRejectedValueOnce(new Error('Timeout'))
    expect(await spam.submit(submission)).toEqual({ kind: 'spam-check-failed' })
    expect(fetch).not.toHaveBeenCalled()
    expect(widget.reset).toHaveBeenCalledTimes(1)
  })

  it('names a network failure', async () => {
    const { spam } = mount()
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await spam.submit(submission)).toEqual({ kind: 'network' })
    expect(widget.reset).toHaveBeenCalledTimes(1)
  })

  it('passes on the server’s reason for a refusal', async () => {
    const { spam } = mount()
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ errors: [{ message: 'This course is closed.' }] }, { status: 400 }),
    )
    expect(await spam.submit(submission)).toEqual({
      kind: 'refused',
      error: 'This course is closed.',
    })
  })

  it('names a refusal without a reason', async () => {
    const { spam } = mount()
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))
    expect(await spam.submit(submission)).toEqual({ kind: 'refused', error: null })
  })
})

describe('failure messages', () => {
  const t = (key: string) => `<${key}>`

  it.each([
    [{ kind: 'spam-check-failed' } as const, '<spamCheckFailed>'],
    [{ kind: 'network' } as const, '<failed>'],
    [{ kind: 'refused', error: null } as const, '<serverFailed>'],
    [{ kind: 'refused', error: 'This course is closed.' } as const, 'This course is closed.'],
  ])('shows %j as %s', (result, message) => {
    expect(failureMessage(result, t)).toBe(message)
  })
})
