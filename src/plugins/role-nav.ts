import type { Plugin } from 'payload'
import { REVIEWED } from '@/lib/reviewed-collections'

import { adminViewOf, isAdminUser, isFellowUser, type AdminView } from '@/access'

/**
 * The collections each non-admin panel shows. Everything else, globals
 * included, is hidden from the nav and dashboard. Hidden collections still
 * open in drawers, so a fellow can pick a cycle or upload a cover image.
 */
const VISIBLE: Record<Exclude<AdminView, 'admin'>, readonly string[]> = {
  // People shows a non-admin only their own profile (People's baseFilter);
  // Enrollments only theirs, or those of the courses they teach.
  fellow: [
    ...REVIEWED.filter((item) => (item.roles as readonly string[]).includes('fellow')).map(
      (item) => item.collection,
    ),
    'enrollments',
    'people',
  ],
  student: [
    ...REVIEWED.filter((item) => (item.roles as readonly string[]).includes('student')).map(
      (item) => item.collection,
    ),
    'enrollments',
    'people',
  ],
}

/** Collections and globals type `user` differently; both carry `roles`. */
type HiddenArgs = { user: Parameters<typeof adminViewOf>[0] }

/** Admins keep the entity's own rule (Governance is super_admin only). */
const hiddenFor =
  <A extends HiddenArgs>(slug: string, own: boolean | ((args: A) => boolean) | undefined) =>
  (args: A): boolean => {
    const view = adminViewOf(args.user)
    if (view === 'admin') return typeof own === 'function' ? own(args) : Boolean(own)
    return view === null || !VISIBLE[view].includes(slug)
  }

/**
 * The admin sidebar, in order: each group and its entries. The theme lists a
 * group's collections first, then its globals, so each list is written that way.
 * Groups appear in the order of their first collection.
 */
const NAV: [group: string, slugs: string[]][] = [
  ['Admissions', ['forms', 'form-submissions', 'enrollments', 'memberships']],
  ['Teaching', ['courses', 'programmes', 'cycles', 'places']],
  ['Publishing', ['articles', 'publications', 'events', 'press']],
  ['Community', ['spaces', 'space-posts', 'space-comments', 'space-introduction', 'space-rules']],
  ['Communications', ['newsletters', 'mailing-lists']],
  ['People', ['people', 'users', 'governance']],
  ['Site', ['media', 'redirects', 'site-settings', 'email-settings', 'registration-defaults']],
  ['AI', ['llms-txt-settings']],
]

/**
 * The AI group's collections come from plugins that run after this one
 * (src/plugins/mcp), so they name the group themselves.
 */
export const AI_GROUP = 'AI'

const GROUPS: Record<string, string> = Object.fromEntries(
  NAV.flatMap(([group, slugs]) => slugs.map((slug) => [slug, group])),
)

const ORDER = NAV.flatMap(([, slugs]) => slugs)

const rank = (slug: string) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length)

/** Last in `plugins`, so it also covers the collections other plugins add. */
export const roleNav = (): Plugin => (config) => ({
  ...config,
  collections: config.collections
    ?.map((collection) => ({
      ...collection,
      admin: {
        ...collection.admin,
        ...(GROUPS[collection.slug] ? { group: GROUPS[collection.slug] } : {}),
        hidden: hiddenFor(collection.slug, collection.admin?.hidden),
      },
    }))
    .sort((a, b) => rank(a.slug) - rank(b.slug)),
  globals: config.globals
    ?.map((global) => ({
      ...global,
      admin: {
        ...global.admin,
        ...(GROUPS[global.slug] ? { group: GROUPS[global.slug] } : {}),
        hidden: hiddenFor(global.slug, global.admin?.hidden),
      },
    }))
    .sort((a, b) => rank(a.slug) - rank(b.slug)),
})

export const showApplicants = (user: Parameters<typeof adminViewOf>[0]) =>
  isAdminUser(user) || isFellowUser(user)
