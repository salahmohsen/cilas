import { Client } from 'typesense'
import { env } from '@/env'

export const privateSearchEnabled = () =>
  env.PRIVATE_SPACES_SEARCH === 'true' && env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED === 'true'

const privateNode = () => ({
  host: env.TYPESENSE_PRIVATE_HOST ?? env.TYPESENSE_HOST,
  port: env.TYPESENSE_PRIVATE_PORT ?? env.TYPESENSE_PORT,
  protocol: env.TYPESENSE_PRIVATE_PROTOCOL ?? env.TYPESENSE_PROTOCOL,
})

export const assertPrivateSearchIsolation = async () => {
  // The operator attests that retired wildcard keys were revoked, including old browser bundles.
  if (env.PRIVATE_SPACES_SEARCH_KEYS_VERIFIED !== 'true' || !env.NEXT_PUBLIC_TYPESENSE_API_KEY)
    throw new Error('Private search key isolation has not been verified')
  const client = new Client({
    apiKey: env.NEXT_PUBLIC_TYPESENSE_API_KEY,
    logLevel: 'silent',
    connectionTimeoutSeconds: 2,
    numRetries: 0,
    nodes: [privateNode()],
  })
  if (!(await client.health.retrieve()).ok) throw new Error('Private engine is not healthy')
  const denied = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      if ([401, 403].includes((error as { httpStatus?: number }).httpStatus ?? 0)) return
    }
    throw new Error('Public search credentials can access a private operation')
  }
  for (const name of ['spaces_search', 'spaces_search_00000000000000000000000000000000']) {
    await denied(() => client.collections(name).documents().search({ q: '*', query_by: 'body' }))
    await denied(() => client.collections(name).documents().export())
  }
  await denied(() => client.keys().retrieve())
}
export const privateClient = (purpose: 'read' | 'write') => {
  const apiKey =
    purpose === 'read' ? env.TYPESENSE_PRIVATE_SEARCH_KEY : env.TYPESENSE_PRIVATE_WRITE_KEY
  if (!apiKey) throw new Error('Private search is not configured')
  return new Client({
    apiKey,
    logLevel: 'silent',
    connectionTimeoutSeconds: 2,
    numRetries: 0,
    nodes: [privateNode()],
  })
}
