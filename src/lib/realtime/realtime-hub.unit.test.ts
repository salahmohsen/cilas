// @vitest-environment node
import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({ env: { DATABASE_URL: 'postgres://u:p@localhost/db' } }))

/** A stand-in for pg.Client: the test decides when LISTEN answers. */
class FakeClient extends EventEmitter {
  static all: FakeClient[] = []
  listen: { resolve: () => void; reject: (e: Error) => void } | null = null
  ended = false
  constructor() {
    super()
    FakeClient.all.push(this)
  }
  connect() {
    return Promise.resolve()
  }
  query() {
    return new Promise<void>((resolve, reject) => {
      this.listen = { resolve, reject }
    })
  }
  end() {
    this.ended = true
    return Promise.resolve()
  }
}

vi.mock('pg', () => ({ default: { Client: FakeClient } }))

const tick = () => new Promise((r) => setImmediate(r))
const note = (recipient: number, id = 1) =>
  JSON.stringify({ op: 'deleted', id, recipient, origin: 'tab-a' })

let subscribe: typeof import('@/lib/realtime/hub').subscribe

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  FakeClient.all = []
  delete (globalThis as { __cilasNotificationHub?: unknown }).__cilasNotificationHub
  vi.resetModules()
  ;({ subscribe } = await import('@/lib/realtime/hub'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const listening = async () => {
  await tick()
  FakeClient.all.at(-1)!.listen!.resolve()
  await tick()
}

describe('notification hub', () => {
  it('opens one connection for any number of streams', async () => {
    subscribe(1, { event: vi.fn(), resync: vi.fn() })
    subscribe(1, { event: vi.fn(), resync: vi.fn() })
    subscribe(2, { event: vi.fn(), resync: vi.fn() })
    await listening()
    expect(FakeClient.all).toHaveLength(1)
  })

  it('sends an event only to its recipient, without the recipient field', async () => {
    const mine = { event: vi.fn(), resync: vi.fn() }
    const theirs = { event: vi.fn(), resync: vi.fn() }
    subscribe(1, mine)
    subscribe(2, theirs)
    await listening()
    FakeClient.all[0].emit('notification', { payload: note(1) })
    expect(mine.event).toHaveBeenCalledExactlyOnceWith({ op: 'deleted', id: 1, origin: 'tab-a' })
    expect(theirs.event).not.toHaveBeenCalled()
  })

  it('stops sending to a stream after its removal', async () => {
    const sink = { event: vi.fn(), resync: vi.fn() }
    const remove = subscribe(1, sink)
    await listening()
    remove()
    FakeClient.all[0].emit('notification', { payload: note(1) })
    expect(sink.event).not.toHaveBeenCalled()
  })

  it('survives a socket error while LISTEN is still pending, then retries', async () => {
    const sink = { event: vi.fn(), resync: vi.fn() }
    subscribe(1, sink)
    await tick()
    const first = FakeClient.all[0]
    // pg emits `error` on a dead socket and rejects the pending query.
    expect(() => first.emit('error', new Error('socket closed'))).not.toThrow()
    first.listen!.reject(new Error('socket closed'))
    await tick()
    expect(first.ended).toBe(true)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(FakeClient.all).toHaveLength(2)
    await listening()
    // The second attempt follows a failure, so open tabs refetch.
    expect(sink.resync).toHaveBeenCalledOnce()
  })

  it('reconnects after the listener drops and asks open streams to refetch', async () => {
    const sink = { event: vi.fn(), resync: vi.fn() }
    subscribe(1, sink)
    await listening()
    const first = FakeClient.all[0]
    expect(() => first.emit('error', new Error('terminated'))).not.toThrow()
    // A late `end` or `error` on the dead client must not start a second retry
    // or crash the process.
    first.emit('end')
    expect(() => first.emit('error', new Error('again'))).not.toThrow()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(FakeClient.all).toHaveLength(2)
    await listening()
    expect(sink.resync).toHaveBeenCalledOnce()
    FakeClient.all[1].emit('notification', { payload: note(1, 5) })
    expect(sink.event).toHaveBeenCalledOnce()
  })
})
