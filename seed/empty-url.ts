export const EMPTY_DATABASE = 'cilas_empty'

export function emptyDatabaseUrl(url: string): string {
  const next = new URL(url)
  next.pathname = `/${EMPTY_DATABASE}`
  return next.toString()
}
