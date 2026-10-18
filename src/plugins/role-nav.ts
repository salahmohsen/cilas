import type { Plugin } from 'payload'

import { adminViewOf, type AdminView } from '@/access'

/**
 * The collections each non-admin panel shows. Everything else, globals
 * included, is hidden from the nav and dashboard. Hidden collections still
 * open in drawers, so a fellow can pick a cycle or upload a cover image.
 */
const VISIBLE: Record<Exclude<AdminView, 'admin'>, readonly string[]> = {
  fellow: ['courses', 'articles', 'enrollments'],
  student: ['articles', 'publications'],
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
const FIRST = ['users']

const rank = (slug: string) => (FIRST.includes(slug) ? FIRST.indexOf(slug) : FIRST.length)

/** Last in `plugins`, so it also covers the collections other plugins add. */
export const roleNav = (): Plugin => (config) => ({
  ...config,
  collections: config.collections
    ?.map((collection) => ({
      ...collection,
      admin: { ...collection.admin, hidden: hiddenFor(collection.slug, collection.admin?.hidden) },
    }))
    // A stable sort: listed slugs move up, everything else stays as it was.
    .sort((a, b) => rank(a.slug) - rank(b.slug)),
  globals: config.globals?.map((global) => ({
    ...global,
    admin: { ...global.admin, hidden: hiddenFor(global.slug, global.admin?.hidden) },
  })),
})
