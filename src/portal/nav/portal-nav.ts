import { isAdminUser } from '@/access'

export type PortalNavGroup = 'top' | 'myWork' | 'teaching' | 'admin'
export type PortalNavIcon = 'home' | 'dashboard' | 'profile'

/** One entry of the portal nav. `href` has no locale; `external` is a full load (its own root layout). */
export type PortalNavItem = {
  key: 'home' | 'openDashboard'
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

const OPEN_DASHBOARD: PortalNavItem = {
  key: 'openDashboard',
  labelKey: 'nav.openDashboard',
  group: 'admin',
  href: '/admin',
  icon: 'dashboard',
  count: null,
  external: true,
}

/** What the account can open from the portal nav. Later phases add items here only. */
export const portalNav = (user: Parameters<typeof isAdminUser>[0]): PortalNavItem[] => [
  HOME,
  ...(isAdminUser(user) ? [OPEN_DASHBOARD] : []),
]
