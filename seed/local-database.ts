/**
 * The seeds wipe and re-create content, so they only ever run against the
 * local docker Postgres of this branch (`localhost:5433`). `127.0.0.1` is
 * refused on purpose: the rule is the strict one `seed/index.ts` always had.
 */
export function requireLocalSeedDatabase(url: string | undefined): string {
  if (url && URL.canParse(url)) {
    const { hostname, port } = new URL(url)
    if (hostname === 'localhost' && port === '5433') return url
  }
  throw new Error('Refusing to seed: DATABASE_URL must point at localhost:5433.')
}
