import Link from 'next/link'
import type { TypedUser, PayloadRequest } from 'payload'

import { WorkMenu } from './work-menu'
import { workViewsFor } from './work-views'

/** The top bar: the work views inline on wide screens, in a menu button on narrow ones. */
export function WorkLinks({ user, req }: { user?: TypedUser | null; req?: PayloadRequest }) {
  const views = workViewsFor(user, req?.i18n.language)
  if (!views.length) return null
  return (
    <>
      <nav aria-label="Admin work" className="cilas-work-links">
        {views.map(({ key, href, label }) => (
          <Link key={key} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <WorkMenu views={views} />
    </>
  )
}
