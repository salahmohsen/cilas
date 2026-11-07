import { routing } from '@/i18n/routing'
import { INGEST_PATH } from './hosts'

/**
 * Which pages analytics may see. The rule is an allowlist: a page counts only
 * if its first path segment (after the language) names a public section, so a
 * new private route is excluded until someone adds it here on purpose.
 *
 * Never listed, so never tracked: Spaces, settings, profile, login, forgot and
 * reset, the signed-in copies of pages, /admin, /api, previews and the
 * ingestion proxy itself.
 */
const LOCALES = routing.locales

/** Public sections, by first path segment. `''` is the home page. */
export const TRACKED_SECTIONS = [
  '',
  'about',
  'apply',
  'articles',
  'calendar',
  'contact',
  'events',
  'governance',
  'people',
  'study',
] as const

/** Sections that only a signed-in or private visitor reaches, kept for the docs and the tests. */
export const EXCLUDED_SECTIONS = [
  'spaces',
  'settings',
  'profile',
  'login',
  'forgot',
  'reset',
  'signed-in',
  'admin',
  'api',
  INGEST_PATH.slice(1),
] as const

/** `/en/about` becomes `/about`, `/ar` becomes `/`. A path with no language is kept as it is. */
export const stripLocale = (pathname: string): string => {
  const path = pathname.split(/[?#]/, 1)[0] || '/'
  const segments = path.split('/').filter(Boolean)
  if (segments[0] && (LOCALES as readonly string[]).includes(segments[0])) segments.shift()
  return `/${segments.join('/')}`
}

/** True when analytics may see this page. */
export const isTrackedPath = (pathname: string): boolean => {
  const segments = stripLocale(pathname).split('/').filter(Boolean)
  const section = segments[0] ?? ''
  if (!(TRACKED_SECTIONS as readonly string[]).includes(section)) return false
  return !segments.includes('preview')
}

/** People pages with a person's name in the address are reported without it. */
const PEOPLE_LISTS = new Set(['cilasians', 'fellows'])

/**
 * The path as analytics stores it: the language kept (it tells the two sites
 * apart) and a person's name in the address replaced.
 */
export const reportedPath = (pathname: string): string => {
  const path = pathname.split(/[?#]/, 1)[0] || '/'
  const segments = path.split('/').filter(Boolean)
  const at = (LOCALES as readonly string[]).includes(segments[0] ?? '') ? 1 : 0
  if (segments[at] === 'people' && segments[at + 1] && !PEOPLE_LISTS.has(segments[at + 1]!)) {
    segments.splice(at + 1, segments.length - at - 1, '[person]')
  }
  return `/${segments.join('/')}`
}
