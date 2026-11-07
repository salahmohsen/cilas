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
 * identified, and the flags and survey calls are off. Page views, errors and
 * web vitals are the only automatic events; the rest go through `track`.
 */
export const posthogConfig = (): Partial<PostHogConfig> => ({
  // PostHog's own recommended defaults (docs/libraries/next-js). Among them:
  // its scripts go into <head> (no hydration mismatch), a recording shorter
  // than its minimum duration is dropped, and a hash is stripped from addresses.
  defaults: '2026-08-30',
  external_scripts_inject_target: 'head',
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
  // Web vitals (LCP, CLS, FCP, INP), at most one `$web_vitals` event per page. The
  // gate cleans the addresses nested in it. Network timing would add every
  // request's address to recordings, so it stays off.
  capture_performance: { web_vitals: true, network_timing: false },
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
  // Remote config must stay on: the recorder reads its settings from it. No
  // feature flags are evaluated, and the "internal user" check (a $set event
  // that would start a person profile on localhost) is off.
  advanced_disable_feature_flags: true,
  internal_or_test_user_hostname: null,
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
 * request is made and `track` stays a no-op.
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
