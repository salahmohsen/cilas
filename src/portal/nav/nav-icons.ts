import { House, LayoutDashboard, UserRound, type LucideIcon } from 'lucide-react'

import type { PortalNavIcon } from './portal-nav'

export const NAV_ICONS: Record<PortalNavIcon, LucideIcon> = {
  home: House,
  dashboard: LayoutDashboard,
  profile: UserRound,
}
