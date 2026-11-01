import type { PostHog } from 'posthog-node'

import { DEFAULT_POSTHOG_HOST } from './hosts'
import { buildServerError, ErrorLimiter, type ErrorContext, type RequestInfo } from './server-error'

/** The longest a failing request waits for PostHog. */
const SEND_TIMEOUT_MS = 2500

/** Not a person: the server is one fixed sender, and no profile is made for it. */
const SERVER_ID = 'cilas-server'

const limiter = new ErrorLimiter()
let client: PostHog | null | undefined

const posthog = async (): Promise<PostHog | null> => {
  if (client !== undefined) return client
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return (client = null)
  const { PostHog } = await import('posthog-node')
  return (client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: SEND_TIMEOUT_MS,
    fetchRetryCount: 0,
    disableGeoip: true,
  }))
}

/**
 * Sends a server error to PostHog (Next's `onRequestError`). Awaited by Next,
 * so it is bounded by a timeout, and it never throws: reporting must not turn
 * one failure into two.
 */
export const reportServerError = async (
  err: unknown,
  request: RequestInfo,
  context: ErrorContext,
): Promise<void> => {
  try {
    const report = buildServerError(err, request, context)
    if (!report || !limiter.allow(report.signature)) return
    const ph = await posthog()
    if (!ph) return
    await Promise.race([
      ph.captureExceptionImmediate(report.error, SERVER_ID, report.properties),
      new Promise((resolve) => setTimeout(resolve, SEND_TIMEOUT_MS)),
    ])
  } catch {}
}
