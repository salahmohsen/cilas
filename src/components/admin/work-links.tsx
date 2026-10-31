import Link from 'next/link'
import type { TypedUser } from 'payload'

import { isAdminUser } from '@/access'

/**
 * Admin → Reviews and Subscribers, in the top bar (`admin.components.actions`).
 * The theme's sidebar has no slot for custom links, so `beforeNavLinks` never
 * rendered; the top bar is the one place that shows on every page.
 */
export function WorkLinks({ user }: { user?: TypedUser | null }) {
  if (!isAdminUser(user)) return null
  return (
    <nav aria-label="Admin work" className="cilas-work-links">
      <Link href="/admin/reviews">Reviews and applications</Link>
      <Link href="/admin/subscribers">Newsletter subscribers</Link>
    </nav>
  )
}
