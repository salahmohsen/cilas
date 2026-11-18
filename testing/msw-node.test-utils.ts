import type { RequestHandler } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll } from 'vitest'

import { failOnUnhandledRequests } from './msw.test-utils'

export const mockNetwork = (...handlers: RequestHandler[]) => {
  const server = setupServer(...handlers)
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  failOnUnhandledRequests(server)
  afterAll(() => server.close())
  return server
}
