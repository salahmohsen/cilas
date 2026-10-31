// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const currentReader = vi.fn()
const unsubscribe = vi.fn()
const subscribe = vi.fn()

vi.mock('@/lib/reader', () => ({ currentReader: () => currentReader() }))
vi.mock('@/lib/realtime/hub', () => ({ subscribe: (...args: unknown[]) => subscribe(...args) }))

const { GET } = await import('../../src/app/(frontend)/api/notifications/stream/route')

beforeEach(() => {
  vi.clearAllMocks()
  subscribe.mockReturnValue(unsubscribe)
})

describe('GET /api/notifications/stream', () => {
  it('refuses a request with no signed-in account', async () => {
    currentReader.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/notifications/stream'))
    expect(res.status).toBe(401)
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('streams only the signed-in account, with headers that stop buffering', async () => {
    currentReader.mockResolvedValue({ id: 7 })
    const abort = new AbortController()
    const res = await GET(
      new Request('http://localhost/api/notifications/stream', { signal: abort.signal }),
    )
    expect(subscribe).toHaveBeenCalledExactlyOnceWith(7, expect.any(Object))
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-transform')
    expect(res.headers.get('x-accel-buffering')).toBe('no')

    const reader = res.body!.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('retry: 3000')
    subscribe.mock.calls[0][1].event({ op: 'deleted', id: 3 })
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      'event: notification\ndata: {"op":"deleted","id":3}\n\n',
    )

    abort.abort()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('removes its listener when the browser cancels the stream', async () => {
    currentReader.mockResolvedValue({ id: 7 })
    const res = await GET(new Request('http://localhost/api/notifications/stream'))
    await res.body!.cancel()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
