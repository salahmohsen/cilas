import {
  BookOpen,
  FileText,
  House,
  Inbox,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import type { PortalNavIcon } from './portal-nav'

export const NAV_ICONS: Record<PortalNavIcon, LucideIcon> = {
  home: House,
  inbox: Inbox,
  dashboard: LayoutDashboard,
  profile: UserRound,
  articles: FileText,
  courses: BookOpen,
}
