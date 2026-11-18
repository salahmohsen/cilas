import { isCommonAssetRequest } from 'msw'
import type { SetupServer } from 'msw/node'
import { afterEach } from 'vitest'

export const failOnUnhandledRequests = (api: Pick<SetupServer, 'events' | 'resetHandlers'>) => {
  const unhandled: string[] = []
  api.events.on('request:unhandled', ({ request }) => {
    if (!isCommonAssetRequest(request)) unhandled.push(`${request.method} ${request.url}`)
  })
  afterEach(() => {
    api.resetHandlers()
    const missed = unhandled.splice(0)
    if (missed.length > 0) throw new Error(`No MSW handler for ${missed.join(', ')}`)
  })
}
