import type { Instrumentation } from 'next'

/**
 * Server errors go to PostHog's error tracking (docs/analytics.md). Without a
 * key nothing loads. The Node runtime only: the Edge runtime has no PostHog
 * server client, and this site's pages and routes run on Node.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  const { reportServerError } = await import('@/lib/analytics/server')
  await reportServerError(err, request, context)
}
