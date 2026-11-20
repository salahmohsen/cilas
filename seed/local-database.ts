import { parse } from 'pg-connection-string'

/**
 * The seeds wipe and re-create content, so they only ever run against the
 * local docker Postgres of this branch (`localhost:5433`, user `cilas`).
 * `127.0.0.1` is refused on purpose: the rule is the strict one `seed/index.ts`
 * always had.
 *
 * The check reads the URL the way `pg` does (`pg-connection-string`), not the
 * way `URL` does: `?host=` and `?port=` override the authority there, so a URL
 * with any query string, or a socket path as host, is refused.
 */
export function requireLocalSeedDatabase(url: string | undefined): string {
  if (url && !/[?#]/.test(url)) {
    try {
      const { host, port, user } = parse(url)
      if (host === 'localhost' && port === '5433' && user === 'cilas') return url
    } catch {
      // An unparsable URL is refused below.
    }
  }
  throw new Error(
    'Refusing to seed: DATABASE_URL must point at localhost:5433/cilas_dev, with no query string. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.',
  )
}
