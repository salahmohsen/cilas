import { adminViewOf, type AdminView } from '@/access'

export type PortalNavGroup = 'top' | 'myWork' | 'teaching' | 'admin'
export type PortalNavIcon =
  | 'home'
  | 'inbox'
  | 'calendar'
  | 'dashboard'
  | 'profile'
  | 'articles'
  | 'courses'

/** One entry of the portal nav. A count comes from `COUNT_OF` (`nav-counts.tsx`), never from the item. `href` has no locale; `external` is a full load (its own root layout). */
export type PortalNavItem = {
  key: 'home' | 'inbox' | 'calendar' | 'articles' | 'courses' | 'openDashboard'
  labelKey: `nav.${string}`
  group: PortalNavGroup
  href: string
  icon: PortalNavIcon
  external: boolean
}

const HOME: PortalNavItem = {
  key: 'home',
  labelKey: 'nav.home',
  group: 'top',
  href: '/spaces',
  icon: 'home',
  external: false,
}

const INBOX: PortalNavItem = {
  key: 'inbox',
  labelKey: 'nav.inbox',
  group: 'top',
  href: '/spaces/inbox',
  icon: 'inbox',
  external: false,
}

const CALENDAR: PortalNavItem = {
  key: 'calendar',
  labelKey: 'nav.calendar',
  group: 'top',
  href: '/spaces/calendar',
  icon: 'calendar',
  external: false,
}

const OPEN_DASHBOARD: PortalNavItem = {
  key: 'openDashboard',
  labelKey: 'nav.openDashboard',
  group: 'admin',
  href: '/admin',
  icon: 'dashboard',
  external: true,
}

const listItem = (key: 'articles' | 'courses', group: PortalNavGroup): PortalNavItem => ({
  key,
  labelKey: `nav.${key}`,
  group,
  href: `/spaces/${key}`,
  icon: key,
  external: false,
})

/** The items after Home, Inbox and Calendar, per admin view (`adminViewOf`). An account with no view gets Home only. */
const ITEMS_BY_VIEW: Record<AdminView, PortalNavItem[]> = {
  student: [listItem('articles', 'myWork')],
  fellow: [listItem('articles', 'myWork'), listItem('courses', 'myWork')],
  admin: [listItem('articles', 'admin'), listItem('courses', 'admin'), OPEN_DASHBOARD],
}

/** What the account can open from the portal nav. Later phases add items here only. */
export const portalNav = (user: Parameters<typeof adminViewOf>[0]): PortalNavItem[] => {
  const view = adminViewOf(user)
  return [HOME, INBOX, CALENDAR, ...(view ? ITEMS_BY_VIEW[view] : [])]
}
