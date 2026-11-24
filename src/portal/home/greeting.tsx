import { getTranslations } from 'next-intl/server'
import type { Payload } from 'payload'

import { personOf } from '@/access'
import { otherLocale, type Locale } from '@/i18n/routing'
import type { User } from '@/payload-types'
import { PortalPageHeader } from '@/portal/lists/page-header'

export async function Greeting({
  payload,
  user,
  locale,
}: {
  payload: Payload
  user: User
  locale: Locale
}) {
  const t = await getTranslations('Portal.home')
  const person = personOf(user)
  const name =
    person === null
      ? undefined
      : (
          await payload.find({
            collection: 'people',
            where: { id: { equals: person } },
            depth: 0,
            limit: 1,
            select: { name: true },
            locale,
            fallbackLocale: otherLocale(locale),
            user,
            overrideAccess: false,
          })
        ).docs[0]?.name
  const first = name?.trim().split(/\s+/u, 1)[0]
  return (
    <PortalPageHeader
      title={
        first
          ? t.rich('greetingName', { name: first, person: (text) => <bdi>{text}</bdi> })
          : t('greeting')
      }
    />
  )
}
