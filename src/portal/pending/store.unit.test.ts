import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPendingStore } from './store'

const input = {
  key: 'one',
  label: 'Approve',
  request: { url: '/api/review', body: { to: 'approved' } },
}
const second = { ...input, key: 'two' }
const ok = () => Response.json({ emailed: true })
function deferred() {
  let resolve!: (response: Response) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Response>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const setup = (reply: () => Promise<Response> = async () => ok()) => {
  const fetcher = vi.fn()
  const refresh = vi.fn()
  const store = createPendingStore({
    clock: {
      now: () => Date.now(),
      setTimeout: (fn, ms) => Number(setTimeout(fn, ms)),
      clearTimeout: (id) => clearTimeout(id),
    },
    fetcher: (url, init) => {
      fetcher(url, init)
      return reply()
    },
    undoMs: 5000,
    refresh,
  })
  const item = (key = input.key) => store.getSnapshot().get(key)
  return { fetcher, refresh, store, item }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('pending: store', () => {
  it('the view reports the time left now and holds nothing but its four fields', () => {
    const { store } = setup()
    store.decide(input)
    const view = store.getView(input.key)
    expect(view?.remainingMs).toBe(5000)
    vi.advanceTimersByTime(2000)
    expect(store.getView(input.key)).toBe(view)
    expect(view?.remainingMs).toBe(3000)
    expect(Object.keys(view ?? {}).toSorted()).toEqual(['remainingMs', 'result', 'state', 'status'])
    store.pause(input.key, 'focus')
    vi.advanceTimersByTime(1000)
    expect(store.getView(input.key)?.remainingMs).toBe(3000)
    expect(store.getView('missing')).toBeNull()
  })

  it('expire and flush together send one authenticated keepalive POST', async () => {
    const { store, fetcher } = setup()
    store.decide(input)
    vi.advanceTimersByTime(5000)
    expect(await store.flush()).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(input.request.url, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.request.body),
    })
  })

  it('starts the fetch inside the call that expired the timer', () => {
    const { store, fetcher, item } = setup()
    store.decide(input)
    vi.advanceTimersByTime(4999)
    expect(fetcher).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(item()?.state).toBe('committing')
  })

  it('commits after the time left before focus', () => {
    const { store, fetcher } = setup()
    store.decide(input)
    vi.advanceTimersByTime(2000)
    store.pause(input.key, 'focus')
    vi.advanceTimersByTime(7000)
    store.resume(input.key, 'focus')
    vi.advanceTimersByTime(2999)
    expect(fetcher).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it.each([400, 409])(
    'ends a %s refusal in undone, preserves its result and refreshes',
    async (status) => {
      const result = { field: 'note' }
      const { store, fetcher, item, refresh } = setup(async () => Response.json(result, { status }))
      store.decide(input)
      expect(await store.flush()).toEqual({ ok: true })
      expect(item()).toMatchObject({ state: 'undone', status, result })
      store.retry(input.key)
      expect(fetcher).toHaveBeenCalledOnce()
      expect(refresh).toHaveBeenCalledOnce()
    },
  )

  it('pauses both items during a modal and resumes each with its time left', () => {
    const { store, fetcher, item } = setup()
    store.decide(input)
    vi.advanceTimersByTime(1000)
    store.decide(second)
    vi.advanceTimersByTime(2000)
    store.overlay(true)
    vi.advanceTimersByTime(6000)
    expect(item()).toMatchObject({ state: 'paused', remainingMs: 2000 })
    expect(item(second.key)).toMatchObject({ state: 'paused', remainingMs: 3000 })
    store.overlay(false)
    vi.advanceTimersByTime(2000)
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('stays paused until both a dialog and its sheet close', () => {
    const { store, item } = setup()
    store.decide(input)
    store.overlay(true)
    store.overlay(true)
    store.overlay(false)
    expect(item()?.state).toBe('paused')
    store.overlay(false)
    expect(item()?.state).toBe('pending')
  })

  it('keeps the JSON success result in the view', async () => {
    const { store } = setup()
    store.decide(input)
    await store.flush()
    expect(store.items[0]?.view).toMatchObject({ state: 'sent', result: { emailed: true } })
  })

  it('refuses a duplicate key without changing its snapshot', () => {
    const { store } = setup()
    expect(store.decide(input)).toBe(true)
    const snapshot = store.getSnapshot()
    expect(store.decide(input)).toBe(false)
    expect(store.getSnapshot()).toBe(snapshot)
  })

  it('starts paused while an overlay is open', () => {
    const { store, fetcher, item } = setup()
    store.overlay(true)
    store.decide(input)
    vi.advanceTimersByTime(6000)
    expect(item()).toMatchObject({ state: 'paused', remainingMs: 5000 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('waits for an already in-flight commit', async () => {
    const response = deferred()
    const { store, fetcher } = setup(() => response.promise)
    store.decide(input)
    vi.advanceTimersByTime(5100)
    const finished = vi.fn()
    const flushed = store.flush().then(finished)
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(finished).not.toHaveBeenCalled()
    response.resolve(ok())
    await flushed
    expect(finished).toHaveBeenCalledWith({ ok: true })
  })

  it('reports an already in-flight commit failure', async () => {
    const response = deferred()
    const { store, item } = setup(() => response.promise)
    store.decide(input)
    vi.advanceTimersByTime(5000)
    const flushed = store.flush()
    response.reject(new Error('offline'))
    expect(await flushed).toEqual({ ok: false })
    expect(item()?.state).toBe('failed')
  })

  it('reports when a failed item fails again during flush', async () => {
    const { store, fetcher } = setup(async () => new Response(null, { status: 503 }))
    store.decide(input)
    expect(await store.flush()).toEqual({ ok: false })
    expect(await store.flush()).toEqual({ ok: false })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('removes a sent item after 8 seconds', async () => {
    const { store, item } = setup()
    store.decide(input)
    await store.flush()
    vi.advanceTimersByTime(7999)
    expect(item()?.state).toBe('sent')
    vi.advanceTimersByTime(1)
    expect(item()).toBeUndefined()
  })

  it('rejects an oversized request by UTF-8 byte length', () => {
    const { store } = setup()
    expect(() =>
      store.decide({ ...input, request: { ...input.request, body: 'ش'.repeat(32768) } }),
    ).toThrow()
    expect(store.items).toEqual([])
  })

  it('rejects a cross-origin request before queuing it', () => {
    const { store } = setup()
    expect(() =>
      store.decide({ ...input, request: { ...input.request, url: '//other.example/api' } }),
    ).toThrow()
    expect(store.items).toEqual([])
  })

  it('an old request resolving after reset cannot complete a new item with the same key', async () => {
    const response = deferred()
    const { store, item, refresh } = setup(() => response.promise)
    store.decide(input)
    const flushed = store.flush()
    store.reset()
    store.decide(input)
    response.resolve(Response.json({}, { status: 409 }))
    await flushed
    expect(item()?.state).toBe('pending')
    expect(refresh).not.toHaveBeenCalled()
  })
})
