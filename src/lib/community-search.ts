import { Client } from 'typesense'

/** How long a signed-in reader's search key lasts, in seconds. */
export const COMMUNITY_KEY_SECONDS = 900

/**
 * A key for searching community articles that ends by itself. It is derived
 * from `parent`, the server's search-only key for that index alone, so it can
 * read nothing else; deriving it makes no call to Typesense.
 */
export const communitySearchKey = (parent: string, now = Date.now()) => {
  const client = new Client({
    apiKey: parent,
    nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
  })
  return {
    key: client.keys().generateScopedSearchKey(parent, {
      expires_at: Math.floor(now / 1000) + COMMUNITY_KEY_SECONDS,
    }),
    expiresIn: COMMUNITY_KEY_SECONDS,
  }
}
