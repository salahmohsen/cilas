import { Client } from 'typesense'
import { env } from '@/env'

export const privateSearchEnabled = () => env.PRIVATE_SPACES_SEARCH === 'true'
export const privateClient = (purpose: 'read' | 'write') => {
  const apiKey =
    purpose === 'read' ? env.TYPESENSE_PRIVATE_SEARCH_KEY : env.TYPESENSE_PRIVATE_WRITE_KEY
  if (!apiKey) throw new Error('Private search is not configured')
  return new Client({
    apiKey,
    logLevel: 'silent',
    connectionTimeoutSeconds: 2,
    numRetries: 0,
    nodes: [
      { host: env.TYPESENSE_HOST, port: env.TYPESENSE_PORT, protocol: env.TYPESENSE_PROTOCOL },
    ],
  })
}
