import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { adminViewOf } from '@/access'
import type { Locale } from '@/i18n/routing'
import { spacesOff } from '@/lib/spaces'
import { COMMUNITY_COVER, mySpaces } from '@/lib/spaces-data'
import type { User } from '@/payload-types'
import { PortalPageHeader } from '@/portal/lists/page-header'
import { spaceLinks } from '@/portal/nav/space-links'
import { latestRows } from '@/portal/needs/latest'
import { needs } from '@/portal/needs/needs'
import { RefreshOnWork } from '@/portal/needs/refresh-on-work'

import { CardBoundary } from './card-boundary'
import { Greeting } from './greeting'
import styles from './home.module.css'
import { LatestCard } from './latest-card'
import { NeedsCard } from './needs-card'
import { nextSession } from './next-session'
import { NextSessionCard } from './next-session-card'
import { SpacesCard } from './spaces-card'

type ReaderProps = { user: User; locale: Locale }
type CardProps = ReaderProps & { payload: Payload }

async function NeedsYou({ user, locale }: ReaderProps) {
  return <NeedsCard result={await needs(user, locale)} />
}

async function Next({ payload, user, locale }: CardProps) {
  const session = await nextSession(payload, user, locale)
  const off = !session && (await spacesOff(payload))
  return (
    <NextSessionCard session={session} view={adminViewOf(user)} spacesOff={off} locale={locale} />
  )
}

async function YourSpaces({ payload, user, locale }: CardProps) {
  if (await spacesOff(payload)) return null
  const [spaces, words] = await Promise.all([
    mySpaces(payload, user, locale),
    getTranslations('Spaces'),
  ])
  const communities = spaces.communities.map((space) => ({ ...space, cover: COMMUNITY_COVER }))
  return (
    <SpacesCard
      spaces={spaceLinks({ ...spaces, communities }, words('community'))}
      student={adminViewOf(user) === 'student'}
      locale={locale}
    />
  )
}

async function Latest({ payload, user }: Pick<CardProps, 'payload' | 'user'>) {
  const { rows } = await latestRows(payload, user, 5)
  return <LatestCard rows={rows} />
}

export async function HomePage({ user, locale }: ReaderProps) {
  const [payload, t] = await Promise.all([getPayload({ config }), getTranslations('Portal.home')])
  const props = { payload, user, locale }
  return (
    <>
      <RefreshOnWork />
      <Suspense fallback={<PortalPageHeader title={t('greeting')} />}>
        <Greeting {...props} />
      </Suspense>
      <div className={styles.board}>
        <CardBoundary>
          <NeedsYou user={user} locale={locale} />
        </CardBoundary>
        <CardBoundary>
          <Next {...props} />
        </CardBoundary>
        <CardBoundary>
          <YourSpaces {...props} />
        </CardBoundary>
        <CardBoundary>
          <Latest payload={payload} user={user} />
        </CardBoundary>
      </div>
    </>
  )
}
