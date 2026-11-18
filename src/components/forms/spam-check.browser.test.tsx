import { cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { failureMessage, useSpamCheck } from '@/components/forms/spam-check'
import { TURNSTILE_HEADER } from '@/lib/turnstile'

import { IntlProvider } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-browser.test-utils'
import { mouse, visibleCenterOf } from '../../../testing/pointer.test-utils'

const network = mockNetwork()
const submission = { form: 7, submissionData: [{ field: 'name', value: 'Nour' }] }
const dummyToken = 'XXXX.DUMMY.TOKEN.XXXX'
const blockingKey = '2x00000000000000000000AB'
const interactiveKey = '3x00000000000000000000FF'

const mount = (siteKey?: string) => {
  const { result } = renderHook(() => useSpamCheck(siteKey), { wrapper: IntlProvider })
  const view = render(result.current.fields)
  return { spam: result.current, ...view }
}

const recordSubmissions = () => {
  const received: { token: string | null; body: unknown }[] = []
  network.use(
    http.post('/api/form-submissions', async ({ request }) => {
      received.push({ token: request.headers.get(TURNSTILE_HEADER), body: await request.json() })
      return new HttpResponse(null, { status: 201 })
    }),
  )
  return received
}

afterEach(cleanup)

describe('guarded form submission', () => {
  it('sends the answers as JSON', async () => {
    const received: { type: string | null; body: unknown }[] = []
    network.use(
      http.post('/api/form-submissions', async ({ request }) => {
        received.push({ type: request.headers.get('content-type'), body: await request.json() })
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(received).toEqual([{ type: 'application/json', body: submission }])
  })

  it('sends the Turnstile token with the answers', async () => {
    const received = recordSubmissions()
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(received).toEqual([{ token: dummyToken, body: submission }])
  })

  it('renews the token after a submit, so the next one has its own', async () => {
    const received = recordSubmissions()
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(received.map((r) => r.token)).toEqual([dummyToken, dummyToken])
  })

  it('sends answers and files together under one token', async () => {
    const received: { token: string | null; payload: unknown; file: string | null }[] = []
    network.use(
      http.post('/api/form-submissions/with-files', async ({ request }) => {
        const body = await request.formData()
        received.push({
          token: request.headers.get(TURNSTILE_HEADER),
          payload: JSON.parse(String(body.get('payload'))),
          file: (body.get('file:attachment') as File).name,
        })
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const { spam } = mount()
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
    expect(await spam.submit(submission, [['attachment', file]])).toEqual({ kind: 'sent' })
    expect(received).toEqual([{ token: dummyToken, payload: submission, file: 'note.txt' }])
  })

  it('names a failed spam check without sending anything', async () => {
    const { spam } = mount(blockingKey)
    expect(await spam.submit(submission)).toEqual({ kind: 'spam-check-failed' })
  })

  it('shows the check when Cloudflare needs a click, and sends after it', async () => {
    const received = recordSubmissions()
    const { spam, container } = mount(interactiveKey)
    const widget = container.querySelector('.spam-check-widget')!
    await waitFor(() => expect(widget.getBoundingClientRect().height).toBeGreaterThan(0))
    const box = visibleCenterOf(widget)
    const checkbox = { x: widget.getBoundingClientRect().left + 30, y: box.y }
    await mouse.move(checkbox)
    await mouse.down(checkbox)
    await mouse.up(checkbox)
    expect(await spam.submit(submission)).toEqual({ kind: 'sent' })
    expect(received).toEqual([{ token: dummyToken, body: submission }])
  })

  it('names a bot without sending anything', async () => {
    const { spam, container } = mount()
    container.querySelector<HTMLInputElement>('input[name="website"]')!.value = 'bot'
    expect(await spam.submit(submission)).toEqual({ kind: 'bot' })
  })

  it('names a network failure', async () => {
    network.use(http.post('/api/form-submissions', () => HttpResponse.error()))
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({ kind: 'network' })
  })

  it('passes on the server’s reason for a refusal', async () => {
    network.use(
      http.post('/api/form-submissions', () =>
        HttpResponse.json({ errors: [{ message: 'This course is closed.' }] }, { status: 400 }),
      ),
    )
    const { spam } = mount()
    expect(await spam.submit(submission)).toEqual({
      kind: 'refused',
      error: 'This course is closed.',
    })
  })

  it('names a refusal without a reason', async () => {
    network.use(
      http.post('/api/form-submissions', () => new HttpResponse('Bad gateway', { status: 502 })),
    )
    const { spam } = mount()
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
