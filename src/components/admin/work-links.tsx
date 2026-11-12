import Link from 'next/link'
import type { TypedUser, PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { showApplicants } from '@/plugins/role-nav'

export function WorkLinks({ user, req }: { user?: TypedUser | null; req?: PayloadRequest }) {
  if (!showApplicants(user)) return null
  return (
    <nav aria-label="Admin work" className="cilas-work-links">
      <Link href="/admin/applicants">
        {req?.i18n.language === 'ar' ? 'المتقدمون' : 'Applicants'}
      </Link>
      {isAdminUser(user) && (
        <>
          <Link href="/admin/reviews">Reviews</Link>
          <Link href="/admin/subscribers">Newsletter subscribers</Link>
        </>
      )}
    </nav>
  )
}
