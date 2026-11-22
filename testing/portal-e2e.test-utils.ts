import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import KNOWN from '../e2e/portal-axe-known.json'
import { pushConfig } from '../src/lib/push/config'
import {
  localePath,
  MESSAGES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type PortalWorld,
} from './portal.fixture'

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** The four shell routes, in the order `portalRoutes` opens them: the shell's axe loop pairs them by index. */
export const ROUTE_SHAPES = [
  ['/spaces', /^\/[a-z]{2}\/spaces$/],
  ['/spaces/course/*', /^\/[a-z]{2}\/spaces\/course\/[^/]+$/],
  ['/spaces/community', /^\/[a-z]{2}\/spaces\/community$/],
  ['/spaces/community/*', /^\/[a-z]{2}\/spaces\/community\/[^/]+$/],
] as const

/** The list routes (phase 1b). They have no known axe problems. */
export const LIST_SHAPES = [
  ['/spaces/articles', /^\/[a-z]{2}\/spaces\/articles$/],
  ['/spaces/courses', /^\/[a-z]{2}\/spaces\/courses$/],
] as const

/** The other portal pages. Their own e2e files run their axe scans. */
export const PAGE_SHAPES = [
  ['/spaces/account', /^\/[a-z]{2}\/spaces\/account$/],
  ['/spaces/inbox', /^\/[a-z]{2}\/spaces\/inbox$/],
] as const

export type RouteShape =
  | (typeof ROUTE_SHAPES)[number][0]
  | (typeof LIST_SHAPES)[number][0]
  | (typeof PAGE_SHAPES)[number][0]
export type Known = Partial<Record<RouteShape, Record<string, Record<string, number>>>>

export const shapeOf = (route: string) => {
  const shape = [...ROUTE_SHAPES, ...LIST_SHAPES, ...PAGE_SHAPES].find(([, pattern]) =>
    pattern.test(route),
  )
  if (!shape) throw new Error(`no route shape for ${route}`)
  return shape[0]
}

/** The most nodes per axe rule that a route may have: base problems taken on main (Deviation 14). */
export const known = (route: string, role: PortalRole, locale: Locale, width: number) =>
  (KNOWN as Known)[shapeOf(route)]?.[`${role} ${locale} ${width}`] ?? {}

export const portalRoutes = (world: PortalWorld, locale: Locale) =>
  ['/en/spaces', world.course.path, '/en/spaces/community', world.community.path].map((path) =>
    localePath(path, locale),
  )

export const axeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('nextjs-portal')
    .analyze()
  return violations
}

/** Each axe rule with more nodes than `allowed` gives it, with those nodes' targets: `{}` when clean. */
export const axeOver = async (page: Page, allowed: Record<string, number>) =>
  Object.fromEntries(
    (await axeViolations(page))
      .filter((v) => v.nodes.length > (allowed[v.id] ?? 0))
      .map((v) => [v.id, v.nodes.map((node) => node.target.join(' '))]),
  )

export const PHONE = WIDTHS.phone

/** Opens the phone More sheet from the bottom bar; returns the open sheet. */
export const openMore = async (page: Page, locale: Locale) => {
  const portal = MESSAGES[locale].Portal
  await page
    .getByRole('navigation', { name: portal.nav.label, exact: true })
    .getByRole('button', { name: portal.nav.more, exact: true })
    .click()
  const sheet = page.getByRole('dialog', { name: portal.nav.more, exact: true })
  await expect(sheet).toBeVisible()
  return sheet
}

/**
 * The nav items each role sees, in nav order: the one table the nav
 * assertions read. A later phase adds rows only. `href` has no locale.
 */
export const NAV_BY_ROLE = {
  admin: [
    { key: 'home', href: '/spaces', group: 'top', external: false },
    { key: 'inbox', href: '/spaces/inbox', group: 'top', external: false },
    { key: 'articles', href: '/spaces/articles', group: 'admin', external: false },
    { key: 'courses', href: '/spaces/courses', group: 'admin', external: false },
    { key: 'openDashboard', href: '/admin', group: 'admin', external: true },
  ],
  fellow: [
    { key: 'home', href: '/spaces', group: 'top', external: false },
    { key: 'inbox', href: '/spaces/inbox', group: 'top', external: false },
    { key: 'articles', href: '/spaces/articles', group: 'myWork', external: false },
    { key: 'courses', href: '/spaces/courses', group: 'myWork', external: false },
  ],
  student: [
    { key: 'home', href: '/spaces', group: 'top', external: false },
    { key: 'inbox', href: '/spaces/inbox', group: 'top', external: false },
    { key: 'articles', href: '/spaces/articles', group: 'myWork', external: false },
  ],
} as const satisfies Record<
  PortalRole,
  readonly { key: string; href: string; group: string; external: boolean }[]
>

/** A nav item's link as the page writes it: in the page's language unless it leaves the portal. */
export const navHref = (item: { href: string; external: boolean }, locale: Locale) =>
  item.external ? item.href : `/${locale}${item.href}`

/** A nav link's name with or without its count: "Inbox" or "Inbox, 3 tasks". */
export const navName = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[,\u060C]|$)`)

/**
 * Stops a write run unless mail and push are off: a world write or a submit then runs its
 * hooks against a database that holds real admin addresses. The runner and the server it
 * talks to both start with the mail, push and search keys empty (`verify.sh`'s env has none).
 */
export const mailOff = (payload: Payload) => {
  if (payload.email.name !== 'console') throw new Error('mail is on: refusing to write')
  if (pushConfig() !== null) throw new Error('push is on: refusing to write')
}
