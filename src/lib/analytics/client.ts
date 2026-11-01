import type { PostHog, PostHogConfig } from 'posthog-js'

import { isNoisyError } from './errors'
import { INGEST_PATH, posthogHosts } from './hosts'
import { isTrackedPath } from './paths'
import { gateCapture } from './policy'
import { setSender } from './track'

/** Share of page loads whose visit is recorded. Free plan: 5,000 recordings a month. */
export const REPLAY_SAMPLE_RATE = 0.1

/** Exceptions sent from one page load; a render loop must not use the month's allowance. */
export const MAX_EXCEPTIONS_PER_PAGE = 5

/** Text PostHog hides in a recording: the forms people type into. */
export const REPLAY_MASK_SELECTOR = 'form, [data-analytics-mask]'

type Capture = { event: string; properties?: Record<string, unknown> }

/** Drops the errors that mean nothing and repeats of one, then applies the page rules. */
export const makeBeforeSend = () => {
  const seen = new Set<string>()
  return (capture: Capture | null): Capture | null => {
    if (capture?.event === '$exception') {
      const first = (
        capture.properties?.$exception_list as { type?: string; value?: string }[] | undefined
      )?.[0]
      if (isNoisyError(first?.value, first?.type)) return null
      const signature = `${first?.type}:${first?.value}`
      if (seen.has(signature) || seen.size >= MAX_EXCEPTIONS_PER_PAGE) return null
      seen.add(signature)
    }
    return gateCapture(capture)
  }
}

/**
 * Cookieless and quiet. Nothing is stored in the browser (`persistence:
 * memory`: a new page load is a new visitor), nothing is captured on its own
 * (no autocapture, no page-leave, no heartbeats, no heat maps), nobody is
 * identified, and the flags and survey calls are off. Page views and errors
 * are the only automatic events; the rest go through `track`.
 */
export const posthogConfig = (): Partial<PostHogConfig> => ({
  api_host: INGEST_PATH,
  ui_host: posthogHosts().ui,
  persistence: 'memory',
  person_profiles: 'identified_only',
  autocapture: false,
  capture_pageview: 'history_change',
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  rageclick: false,
  capture_performance: false,
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
  advanced_disable_flags: true,
  disable_surveys: true,
  disable_session_recording: true,
  respect_dnt: true,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: REPLAY_MASK_SELECTOR,
  },
  before_send: makeBeforeSend() as PostHogConfig['before_send'],
})

/** Records only a sampled share of visits, and only while on a page analytics may see. */
export const makeRecordingSync = (
  posthog: Pick<PostHog, 'startSessionRecording' | 'stopSessionRecording'>,
  sampled: boolean,
) => {
  let on = false
  return (pathname: string) => {
    const want = sampled && isTrackedPath(pathname)
    if (want === on) return
    on = want
    if (want) posthog.startSessionRecording()
    else posthog.stopSessionRecording()
  }
}

let syncRecording: (pathname: string) => void = () => {}

/** Next calls this as a navigation starts, before the address changes. */
export const onNavigate = (url: string) => {
  try {
    syncRecording(new URL(url, window.location.href).pathname)
  } catch {}
}

/**
 * Starts analytics when a key is set. Without one nothing is downloaded, no
 * request is made and `track` stays a no-op. PostHog loads in a separate
 * chunk, so the first page view can follow hydration by a moment.
 */
export const startAnalytics = (key: string | undefined) => {
  if (!key || typeof window === 'undefined') return
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, posthogConfig())
      setSender((event, properties) => posthog.capture(event, properties))
      syncRecording = makeRecordingSync(posthog, Math.random() < REPLAY_SAMPLE_RATE)
      syncRecording(window.location.pathname)
    })
    .catch(() => {})
}
