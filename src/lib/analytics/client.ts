import type { PostHogConfig } from 'posthog-js'

import { isNoisyError } from './errors'
import { INGEST_PATH, posthogHosts } from './hosts'
import { gateCapture } from './policy'
import { setSender } from './track'

/** Exceptions sent from one page load; a render loop must not use the month's allowance. */
export const MAX_EXCEPTIONS_PER_PAGE = 5

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
 * Cookieless and quiet. `cookieless_mode: 'always'`: nothing is stored in the
 * browser, and PostHog counts a visitor by a hash of the IP, the user agent
 * and a salt it deletes each day, so one person is one visitor for a day.
 * Nothing is captured on its own (no autocapture, no page-leave, no heat maps),
 * nobody is identified, and the flags, survey and recorder calls are off: the
 * recorder cannot run without a stored session. Page views, errors and web
 * vitals are the only automatic events; the rest go through `track`.
 */
export const posthogConfig = (): Partial<PostHogConfig> => ({
  // PostHog's own recommended defaults (docs/libraries/next-js). Among them:
  // its scripts go into <head> (no hydration mismatch) and a hash is stripped
  // from addresses.
  defaults: '2026-08-30',
  external_scripts_inject_target: 'head',
  api_host: INGEST_PATH,
  ui_host: posthogHosts().ui,
  cookieless_mode: 'always',
  person_profiles: 'identified_only',
  autocapture: false,
  capture_pageview: 'history_change',
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  rageclick: false,
  // Web vitals (LCP, CLS, FCP, INP), at most one `$web_vitals` event per page. The
  // gate cleans the addresses nested in it.
  capture_performance: { web_vitals: true, network_timing: false },
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: false,
  },
  // No feature flags are evaluated, and the "internal user" check (a $set
  // event that would start a person profile on localhost) is off.
  advanced_disable_feature_flags: true,
  internal_or_test_user_hostname: null,
  disable_surveys: true,
  disable_session_recording: true,
  respect_dnt: true,
  before_send: makeBeforeSend() as PostHogConfig['before_send'],
})

/** Set on a device that opened the admin panel: its visits are staff, not audience. */
export const STAFF_FLAG = 'cilas:staff-device'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * True on a staff device. Opening /admin marks the device for good, so the
 * team's own visits to the public site stop counting. The one flag is the
 * only thing analytics stores in a browser, and only in a staff one.
 */
export const isStaffDevice = (storage: FlagStorage, pathname: string): boolean => {
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')
  try {
    if (admin) storage.setItem(STAFF_FLAG, '1')
    return admin || storage.getItem(STAFF_FLAG) === '1'
  } catch {
    return admin
  }
}

/**
 * Starts analytics when a key is set and the device is not staff. Otherwise
 * nothing is downloaded, no request is made and `track` stays a no-op.
 */
export const startAnalytics = (key: string | undefined) => {
  if (!key || typeof window === 'undefined') return
  // Reading `window.localStorage` itself throws where storage is blocked.
  const storage: FlagStorage = {
    getItem: (name) => window.localStorage.getItem(name),
    setItem: (name, value) => window.localStorage.setItem(name, value),
  }
  if (isStaffDevice(storage, window.location.pathname)) return
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, posthogConfig())
      setSender((event, properties) => posthog.capture(event, properties))
    })
    .catch(() => {})
}
