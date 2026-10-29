import Link from 'next/link'
import type { TypedUser } from 'payload'

import { isAdminUser } from '@/access'

export function WorkLinks({ user }: { user?: TypedUser | null }) {
  if (!isAdminUser(user)) return null
  return (
    <div style={{ display: 'grid', gap: '12px', marginBlockEnd: '24px' }}>
      <Link href="/admin/reviews">Reviews and applications</Link>
      <Link href="/admin/subscribers">Newsletter subscribers</Link>
    </div>
  )
}
