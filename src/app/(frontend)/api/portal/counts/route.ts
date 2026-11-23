import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { currentReader } from '@/lib/reader'
import { needsCounts } from '@/portal/needs/needs'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  let payload: Payload | undefined
  try {
    payload = await getPayload({ config })
    const user = await currentReader()
    if (!user) return new Response('Sign in first.', { status: 401, headers })
    return Response.json(await needsCounts(payload, user), { headers })
  } catch (error) {
    if (payload) payload.logger.error({ err: error }, 'portal counts: request failed')
    else console.error('portal counts: request failed', error)
    return new Response('Unable to load work counts.', { status: 500, headers })
  }
}
