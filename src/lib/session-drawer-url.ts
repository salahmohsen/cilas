/**
 * The session drawer's place in the URL: the open session is the `open`
 * search param, so Back closes it and a link opens it. (`session` already
 * filters a space's feed to a session's posts.) Server pages build links with
 * it; the client drawer host reads it.
 */
export const SESSION_PARAM = 'open'

/** `href` (a path with or without a query) with the session drawer open on `id`. */
export const sessionDrawerHref = (href: string, id: string) => {
  const url = new URL(href, 'http://local')
  url.searchParams.set(SESSION_PARAM, id)
  return `${url.pathname}${url.search}${url.hash}`
}
