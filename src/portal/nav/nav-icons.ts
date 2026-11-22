import {
  BookOpen,
  CalendarDays,
  FileText,
  House,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import type { PortalNavIcon } from './portal-nav'

export const NAV_ICONS: Record<PortalNavIcon, LucideIcon> = {
  home: House,
  calendar: CalendarDays,
  dashboard: LayoutDashboard,
  profile: UserRound,
  articles: FileText,
  courses: BookOpen,
}
