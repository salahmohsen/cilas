import { http, HttpResponse, passthrough } from 'msw'

import { env } from '@/env'

import { isLocalUrl } from './local-env'

const localOrigin = (name: string, url: string) => {
  if (!isLocalUrl(url)) {
    throw new Error(`Refusing to pass requests through to ${name} at "${url}": it is not local.`)
  }
  return new URL(url).origin
}

const storageOrigin = localOrigin('storage', env.R2_ENDPOINT)
const searchOrigin = localOrigin(
  'Typesense',
  `${env.TYPESENSE_PROTOCOL}://${env.TYPESENSE_HOST}:${env.TYPESENSE_PORT}`,
)

export const storageUrl = `${storageOrigin}/${env.R2_BUCKET}/*`

export const localServices = [
  http.all(`${storageOrigin}/*`, () => passthrough()),
  http.all(`${searchOrigin}/*`, () => passthrough()),
  http.post(
    'https://telemetry.payloadcms.com/events',
    () => new HttpResponse(null, { status: 204 }),
  ),
]
