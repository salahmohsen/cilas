import config from '@payload-config'
import { getPayload } from 'payload'

import { getOpenNow } from '@/api/home.api'
import { DeadlineBar } from '@/components/deadline-bar'

/** The deadline bar's data: whatever is open now with a last day to register. */
export async function SiteDeadlines({ locale }: { locale: 'en' | 'ar' }) {
  const payload = await getPayload({ config })
  const open = await getOpenNow(payload, locale)
  return (
    <DeadlineBar
      items={open.flatMap((item) =>
        item.deadline
          ? [{ id: item.href, title: item.title, href: item.href, deadline: item.deadline }]
          : [],
      )}
    />
  )
}
