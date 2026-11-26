import { REST_DELETE, REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'

import config from '../src/payload.config'

const handlers = {
  DELETE: REST_DELETE(config),
  GET: REST_GET(config),
  PATCH: REST_PATCH(config),
  POST: REST_POST(config),
}

/**
 * Calls Payload's REST handler in process, as the app's `/api/[...slug]` route
 * does: the same handler, config and storage adapter, with no server.
 */
export const rest = (
  method: keyof typeof handlers,
  path: string,
  { token, body }: { token?: string; body?: FormData } = {},
) =>
  handlers[method](
    new Request(`http://localhost:3000/api/${path}`, {
      method,
      body,
      headers: token ? { Authorization: `JWT ${token}` } : {},
    }),
    { params: Promise.resolve({ slug: path.split('?')[0].split('/') }) },
  )
