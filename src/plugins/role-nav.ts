import type { Plugin } from 'payload'

import { adminViewOf, type AdminView } from '@/access'

/**
 * The collections each non-admin panel shows. Everything else, globals
 * included, is hidden from the nav and dashboard. Hidden collections still
 * open in drawers, so a fellow can pick a cycle or upload a cover image.
 */
const VISIBLE: Record<Exclude<AdminView, 'admin'>, readonly string[]> = {
  // People shows a non-admin only their own profile (People's baseFilter);
  // Enrollments only theirs, or those of the courses they teach.
  fellow: ['courses', 'articles', 'publications', 'enrollments', 'people'],
  student: ['articles', 'publications', 'enrollments', 'people'],
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

/** Collections the menu lists first, in this order; the rest keep theirs. */
const GROUPS: Record<string, string> = {
  'form-submissions': 'Admissions',
  enrollments: 'Admissions',
  memberships: 'Admissions',
  forms: 'Admissions',
  courses: 'Teaching',
  cycles: 'Teaching',
  programmes: 'Teaching',
  places: 'Teaching',
  articles: 'Publishing',
  publications: 'Publishing',
  press: 'Publishing',
  newsletters: 'Communications',
  'mailing-lists': 'Communications',
  people: 'People',
  users: 'People',
  governance: 'People',
  media: 'Site',
  redirects: 'Site',
  'site-settings': 'Site',
  'email-settings': 'Site',
}

const FIRST = Object.keys(GROUPS)

const rank = (slug: string) => (FIRST.includes(slug) ? FIRST.indexOf(slug) : FIRST.length)

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
    // A stable sort: listed slugs move up, everything else stays as it was.
    .sort((a, b) => rank(a.slug) - rank(b.slug)),
  globals: config.globals?.map((global) => ({
    ...global,
    admin: {
      ...global.admin,
      ...(GROUPS[global.slug] ? { group: GROUPS[global.slug] } : {}),
      hidden: hiddenFor(global.slug, global.admin?.hidden),
    },
  })),
})
