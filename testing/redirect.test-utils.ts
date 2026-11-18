import { getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { isHTTPAccessFallbackError } from 'next/dist/client/components/http-access-fallback/http-access-fallback'

/**
 * Runs server code that may call the real `redirect()` or `notFound()` from
 * `next/navigation`, and says which happened: `{ redirect: url }`,
 * `{ notFound: true }` or `{ returned: value }`. Any other error propagates.
 */
export const navigationOutcome = async <Result>(work: () => Promise<Result>) => {
  try {
    return { returned: await work() }
  } catch (error) {
    if (isRedirectError(error)) return { redirect: getURLFromRedirectError(error) }
    if (isHTTPAccessFallbackError(error)) return { notFound: true }
    throw error
  }
}
