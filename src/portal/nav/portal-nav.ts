import { adminViewOf, type AdminView } from '@/access'

export type PortalNavGroup = 'top' | 'myWork' | 'teaching' | 'admin'
export type PortalNavIcon = 'home' | 'calendar' | 'dashboard' | 'profile' | 'articles' | 'courses'

/** One entry of the portal nav. `href` has no locale; `external` is a full load (its own root layout). */
export type PortalNavItem = {
  key: 'home' | 'calendar' | 'articles' | 'courses' | 'openDashboard'
  labelKey: `nav.${string}`
  group: PortalNavGroup
  href: string
  icon: PortalNavIcon
  count: number | null
  external: boolean
}

const HOME: PortalNavItem = {
  key: 'home',
  labelKey: 'nav.home',
  group: 'top',
  href: '/spaces',
  icon: 'home',
  count: null,
  external: false,
}

const CALENDAR: PortalNavItem = {
  key: 'calendar',
  labelKey: 'nav.calendar',
  group: 'top',
  href: '/spaces/calendar',
  icon: 'calendar',
  count: null,
  external: false,
}

const OPEN_DASHBOARD: PortalNavItem = {
  key: 'openDashboard',
  labelKey: 'nav.openDashboard',
  group: 'admin',
  href: '/admin',
  icon: 'dashboard',
  count: null,
  external: true,
}

const listItem = (key: 'articles' | 'courses', group: PortalNavGroup): PortalNavItem => ({
  key,
  labelKey: `nav.${key}`,
  group,
  href: `/spaces/${key}`,
  icon: key,
  count: null,
  external: false,
})

/** The items after Home and Calendar, per admin view (`adminViewOf`). An account with no view gets Home only. */
const ITEMS_BY_VIEW: Record<AdminView, PortalNavItem[]> = {
  student: [listItem('articles', 'myWork')],
  fellow: [listItem('articles', 'myWork'), listItem('courses', 'myWork')],
  admin: [listItem('articles', 'admin'), listItem('courses', 'admin'), OPEN_DASHBOARD],
}

/** What the account can open from the portal nav. Later phases add items here only. */
export const portalNav = (user: Parameters<typeof adminViewOf>[0]): PortalNavItem[] => {
  const view = adminViewOf(user)
  return [HOME, CALENDAR, ...(view ? ITEMS_BY_VIEW[view] : [])]
}
