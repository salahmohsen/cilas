import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'
import { afterAll, beforeAll } from 'vitest'

import { failOnUnhandledRequests } from './msw.test-utils'

export const mockNetwork = (...handlers: RequestHandler[]) => {
  const worker = setupWorker(...handlers)
  beforeAll(() => worker.start({ onUnhandledRequest: 'error', quiet: true }))
  failOnUnhandledRequests(worker)
  afterAll(() => worker.stop())
  return worker
}
