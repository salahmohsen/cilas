import type { TypedUser } from 'payload'

import { isAdminUser } from '@/access'
import { showApplicants } from '@/plugins/role-nav'

export type WorkViewKey = 'applicants' | 'reviews' | 'subscribers'

export type WorkView = { key: WorkViewKey; href: string; label: string }

/**
 * The custom admin views that staff work in, with who may open each one.
 * The top bar (work-links.tsx) and the dashboard tiles (dashboard/quick-actions.tsx)
 * both read this list, so a view is added or hidden in one place.
 */
export function workViewsFor(user: TypedUser | null | undefined, language?: string): WorkView[] {
  const views: WorkView[] = []
  if (showApplicants(user)) {
    views.push({
      key: 'applicants',
      href: '/admin/applicants',
      label: language === 'ar' ? 'المتقدمون' : 'Applicants',
    })
  }
  if (isAdminUser(user)) {
    views.push(
      { key: 'reviews', href: '/admin/reviews', label: 'Reviews' },
      { key: 'subscribers', href: '/admin/subscribers', label: 'Newsletter subscribers' },
    )
  }
  return views
}
