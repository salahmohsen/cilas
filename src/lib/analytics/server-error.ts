import { isBotPath, isNoisyError } from './errors'
import { isTrackedPath, reportedPath, stripLocale } from './paths'
import { scrubText } from './scrub'

export type RequestInfo = { path: string; method: string }
export type ErrorContext = { routePath?: string; routeType?: string; routerKind?: string }

export type ServerErrorReport = {
  error: Error
  properties: Record<string, unknown>
  /** Same value for the same fault; the limiter counts by it. */
  signature: string
}

const REDACTED = '[message withheld: private route]'

const framesOf = (stack: string | undefined) =>
  (stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at\s/.test(line))
    .join('\n')

/**
 * What to tell PostHog about a failed request, or null to say nothing.
 *
 * Errors from any route count, but only a public page's error keeps its
 * message (cleaned of emails and secrets). A private route (Spaces, settings,
 * the admin, the API) reports its error name, its code location and the route
 * pattern: the message can quote what a person typed. The address never
 * carries a query; a person's name in an address is replaced.
 */
export const buildServerError = (
  err: unknown,
  request: RequestInfo,
  context: ErrorContext,
): ServerErrorReport | null => {
  const source = err instanceof Error ? err : new Error(String(err))
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined
  const path = request.path.split('?')[0] ?? '/'

  if (isBotPath(path)) return null
  if (isNoisyError(source.message, source.name) || isNoisyError(digest)) return null

  const publicPage = isTrackedPath(path)
  const message = publicPage ? scrubText(source.message) : REDACTED
  const error = new Error(message)
  error.name = source.name
  error.stack = `${source.name}: ${message}\n${framesOf(source.stack)}`

  const route = context.routePath ?? stripLocale(path)
  return {
    error,
    signature: `${source.name}:${route}:${digest ?? message}`,
    properties: {
      $process_person_profile: false,
      source: 'server',
      route,
      route_type: context.routeType,
      router_kind: context.routerKind,
      method: request.method,
      digest,
      // Public pages only: a private page's address could hold an id.
      ...(publicPage ? { $current_url: reportedPath(path), $pathname: reportedPath(path) } : {}),
    },
  }
}

/**
 * Keeps one failing page from using the month's allowance: a fault reports at
 * most once every `windowMs`, and the process at most `limit` times an hour.
 */
export class ErrorLimiter {
  private seen = new Map<string, number>()
  private sent: number[] = []

  constructor(
    private windowMs = 10 * 60_000,
    private limit = 60,
  ) {}

  allow(signature: string, now = Date.now()): boolean {
    this.sent = this.sent.filter((at) => now - at < 3_600_000)
    const last = this.seen.get(signature)
    if (last !== undefined && now - last < this.windowMs) return false
    if (this.sent.length >= this.limit) return false
    this.seen.set(signature, now)
    this.sent.push(now)
    if (this.seen.size > 500) {
      for (const [key, at] of this.seen) if (now - at >= this.windowMs) this.seen.delete(key)
    }
    return true
  }
}
