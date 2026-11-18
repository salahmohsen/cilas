import net from 'node:net'

import pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { NOTIFICATION_CHANNEL, type ClientNotificationEvent } from '@/lib/realtime/events'

const database = new URL(process.env.DATABASE_URL!)

const startProxy = () => {
  const sockets = new Set<net.Socket>()
  const listeners: (() => void)[] = []
  const refusals: (() => void)[] = []
  const state = { connections: 0, refusing: false }
  const server = net.createServer((client) => {
    state.connections += 1
    if (state.refusing) {
      client.destroy()
      for (const refusal of refusals.splice(0)) refusal()
      return
    }
    const upstream = net.connect(Number(database.port), database.hostname)
    for (const socket of [client, upstream]) {
      sockets.add(socket)
      socket.on('error', () => socket.destroy())
      socket.on('close', () => {
        sockets.delete(socket)
        client.destroy()
        upstream.destroy()
      })
    }
    client.pipe(upstream)
    upstream.on('data', (chunk: Buffer) => {
      if (chunk.includes('LISTEN\0')) for (const listener of listeners.splice(0)) listener()
      client.write(chunk)
    })
  })
  return {
    state,
    start: () =>
      new Promise<string>((resolve) =>
        server.listen(0, '127.0.0.1', () => {
          const { port } = server.address() as net.AddressInfo
          const url = new URL(database)
          url.hostname = '127.0.0.1'
          url.port = String(port)
          resolve(url.href)
        }),
      ),
    cut: () => {
      for (const socket of sockets) socket.destroy()
    },
    refused: () => new Promise<void>((resolve) => refusals.push(resolve)),
    listening: () => new Promise<void>((resolve) => listeners.push(resolve)),
    stop: () => {
      for (const socket of sockets) socket.destroy()
      server.close()
    },
  }
}

let proxy: ReturnType<typeof startProxy>
const notifier = new pg.Client({ connectionString: process.env.DATABASE_URL })
let subscribe: typeof import('@/lib/realtime/hub').subscribe

const account = () => 900_000_000 + Math.floor(Math.random() * 90_000_000)
const notify = (recipient: number, id = 1) =>
  notifier.query('select pg_notify($1, $2)', [
    NOTIFICATION_CHANNEL,
    JSON.stringify({ op: 'deleted', id, recipient, origin: 'tab-a' }),
  ])

const sink = () => {
  const events: ClientNotificationEvent[] = []
  const waiting: ((event: ClientNotificationEvent) => void)[] = []
  const resyncs: (() => void)[] = []
  let resynced = 0
  return {
    events,
    get resynced() {
      return resynced
    },
    event: (event: ClientNotificationEvent) => {
      events.push(event)
      for (const resolve of waiting.splice(0)) resolve(event)
    },
    resync: () => {
      resynced += 1
      for (const resolve of resyncs.splice(0)) resolve()
    },
    nextEvent: () => new Promise<ClientNotificationEvent>((resolve) => waiting.push(resolve)),
    nextResync: () => new Promise<void>((resolve) => resyncs.push(resolve)),
  }
}

beforeAll(() => notifier.connect())
afterAll(() => notifier.end())
beforeEach(async () => {
  proxy = startProxy()
  const proxyUrl = await proxy.start()
  vi.stubEnv('DATABASE_LISTEN_URL', proxyUrl)
  vi.resetModules()
  delete (globalThis as { __cilasNotificationHub?: unknown }).__cilasNotificationHub
  ;({ subscribe } = await import('@/lib/realtime/hub'))
})
afterEach(() => {
  proxy.stop()
  vi.unstubAllEnvs()
})

describe('notification hub', () => {
  it('opens one connection for any number of streams', async () => {
    const up = proxy.listening()
    const [a, b] = [account(), account()]
    subscribe(a, sink())
    subscribe(a, sink())
    subscribe(b, sink())
    await up
    expect(proxy.state.connections).toBe(1)
  })

  it('sends an event only to its recipient, without the recipient field', async () => {
    const mine = sink()
    const theirs = sink()
    const up = proxy.listening()
    const [a, b] = [account(), account()]
    subscribe(a, mine)
    subscribe(b, theirs)
    await up
    const received = mine.nextEvent()
    await notify(a)
    expect(await received).toEqual({ op: 'deleted', id: 1, origin: 'tab-a' })
    expect(theirs.events).toEqual([])
  })

  it('stops sending to a stream after its removal', async () => {
    const removed = sink()
    const kept = sink()
    const up = proxy.listening()
    const [a, b] = [account(), account()]
    const remove = subscribe(a, removed)
    subscribe(b, kept)
    await up
    remove()
    const received = kept.nextEvent()
    await notify(a)
    await notify(b, 2)
    await received
    expect(removed.events).toEqual([])
  })

  it('survives a refused connection, then retries and asks open streams to refetch', async () => {
    proxy.state.refusing = true
    const me = account()
    const open = sink()
    const refetched = open.nextResync()
    const refused = proxy.refused()
    subscribe(me, open)
    await refused
    proxy.state.refusing = false
    await refetched
    expect(open.resynced).toBe(1)
    const received = open.nextEvent()
    await notify(me)
    expect(await received).toMatchObject({ id: 1 })
  })

  it('reconnects after the listener drops and asks open streams to refetch', async () => {
    const me = account()
    const open = sink()
    const up = proxy.listening()
    subscribe(me, open)
    await up
    const refetched = open.nextResync()
    proxy.cut()
    await refetched
    expect(open.resynced).toBe(1)
    expect(proxy.state.connections).toBe(2)
    const received = open.nextEvent()
    await notify(me, 5)
    expect(await received).toMatchObject({ id: 5 })
  })
})
