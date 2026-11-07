import { cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpamCheck } from '@/components/forms/spam-check'
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
    expect((await spam.submit(submission))?.ok).toBe(true)
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
    await spam.submit(submission, [['attachment', file]])
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('/api/form-submissions/with-files')
    expect(init?.headers).toEqual({ [TURNSTILE_HEADER]: 'verified-token' })
    const body = init!.body as FormData
    expect(JSON.parse(String(body.get('payload')))).toEqual(submission)
    expect((body.get('file:attachment') as File).name).toBe('note.txt')
    expect(widget.token).toHaveBeenCalledTimes(1)
    expect(widget.reset).toHaveBeenCalledTimes(1)
  })

  it('returns fake success to a honeypot without sending anything', async () => {
    const { spam, container } = mount()
    container.querySelector<HTMLInputElement>('input[name="website"]')!.value = 'bot'
    expect(await spam.submit(submission)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(widget.token).not.toHaveBeenCalled()
  })

  it('renews the token after token or network failures', async () => {
    const { spam } = mount()
    widget.token.mockRejectedValueOnce(new Error('challenge failed'))
    await expect(spam.submit(submission)).rejects.toThrow('challenge failed')
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(spam.submit(submission)).rejects.toThrow('offline')
    expect(widget.reset).toHaveBeenCalledTimes(2)
  })
})
