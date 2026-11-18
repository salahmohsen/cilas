import { http, HttpResponse, passthrough } from 'msw'

import { env } from '@/env'

const storageOrigin = new URL(env.R2_ENDPOINT).origin
const searchOrigin = `${env.TYPESENSE_PROTOCOL}://${env.TYPESENSE_HOST}:${env.TYPESENSE_PORT}`

export const localServiceHandlers = [
  http.all(`${storageOrigin}/*`, () => passthrough()),
  http.all(`${searchOrigin}/*`, () => passthrough()),
  http.post(
    'https://telemetry.payloadcms.com/events',
    () => new HttpResponse(null, { status: 204 }),
  ),
]

export const storageUrl = `${storageOrigin}/*`
