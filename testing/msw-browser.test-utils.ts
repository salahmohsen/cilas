import { http, HttpResponse, type RequestHandler } from 'msw'
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

const pixel = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
)

/** Next's image optimizer, which a browser test has no server for: every image is one pixel. */
export const nextImages = () =>
  http.get(
    '/_next/image',
    () => new HttpResponse(pixel, { headers: { 'content-type': 'image/png' } }),
  )
