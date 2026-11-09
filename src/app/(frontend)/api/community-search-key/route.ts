import config from '@payload-config'
import { getPayload } from 'payload'

import { env } from '@/env'
import { communityParentKey, communitySearchKey } from '@/lib/community-search'

export const dynamic = 'force-dynamic'

const reply = (body: unknown) =>
  Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' },
  })

/** A signed-in reader's key for searching community articles; for anyone else, no key. */
export async function POST(request: Request) {
  const parent =
    env.TYPESENSE_COMMUNITY_SEARCH_KEY ??
    (env.TYPESENSE_API_KEY ? communityParentKey(env.TYPESENSE_API_KEY) : undefined)
  if (!parent) return reply({ key: null })
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: new Headers(request.headers) })
  if (!user || user.collection !== 'users') return reply({ key: null })
  return reply(communitySearchKey(parent))
}
