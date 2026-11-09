import { createHmac } from 'node:crypto'

import { Client } from 'typesense'

/** How long a signed-in reader's search key lasts, in seconds. */
export const COMMUNITY_KEY_SECONDS = 900

/**
 * The server's search-only key for community articles, derived from the
 * admin key so that it needs no setting of its own and stays the same across
 * restarts. The derivation is one-way. The site search indexer registers it
 * with Typesense at startup. It is never sent to a browser.
 */
export const communityParentKey = (adminKey: string) =>
  createHmac('sha256', adminKey).update('cilas:community-search:v1').digest('hex')

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
