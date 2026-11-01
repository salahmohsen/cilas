/**
 * Cleaning addresses before they leave the site. An address can carry a
 * token or an email in its query (a reset link, a `next=` redirect), so only
 * the campaign tags that web analytics reads are kept.
 */
import { reportedPath } from './paths'

const KEPT_PARAMS = /^(utm_(source|medium|campaign|term|content)|ref)$/

/** The address without its hash and without any query except campaign tags. */
export const scrubUrl = (raw: string): string => {
  let url: URL
  try {
    url = new URL(raw, 'https://invalid.local')
  } catch {
    return ''
  }
  const kept = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    if (KEPT_PARAMS.test(key)) kept.set(key, value.slice(0, 100))
  }
  const query = kept.size ? `?${kept}` : ''
  const origin = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? url.origin : ''
  return `${origin}${reportedPath(url.pathname)}${query}`
}

/** A referrer reduced to its origin and path: a search page's query tells who searched for what. */
export const scrubReferrer = (raw: string): string => {
  try {
    const url = new URL(raw)
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return ''
  }
}

const SECRET = /(token|key|secret|password|auth|session|code|signature)=[^&\s"']+/gi
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g

/** Free text (an error message) without query secrets or email addresses. */
export const scrubText = (text: string, max = 300): string =>
  text.replace(SECRET, '$1=[removed]').replace(EMAIL, '[email]').slice(0, max)
