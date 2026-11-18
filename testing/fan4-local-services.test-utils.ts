import { http, HttpResponse, passthrough } from 'msw'

import { env } from '@/env'

const storageUrl = `${new URL(env.R2_ENDPOINT).origin}/${env.R2_BUCKET}/*`
const searchOrigin = `${env.TYPESENSE_PROTOCOL}://${env.TYPESENSE_HOST}:${env.TYPESENSE_PORT}`

export const localServiceHandlers = [
  http.all(storageUrl, () => passthrough()),
  http.all(`${searchOrigin}/*`, () => passthrough()),
  http.post(
    'https://telemetry.payloadcms.com/events',
    () => new HttpResponse(null, { status: 204 }),
  ),
]

export { storageUrl }
