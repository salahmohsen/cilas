import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { adminViewOf } from '@/access'
import type { Locale } from '@/i18n/routing'
import { spacesOff } from '@/lib/spaces'
import { mySpaces } from '@/lib/spaces-data'
import type { User } from '@/payload-types'
import { PortalPageHeader } from '@/portal/lists/page-header'
import { spaceLinks } from '@/portal/nav/space-links'
import { latestRows } from '@/portal/needs/latest'
import { needs } from '@/portal/needs/needs'
import { RefreshOnWork } from '@/portal/needs/refresh-on-work'

import { CardBoundary, HomeBoard } from './card-boundary'
import { Greeting } from './greeting'
import { GreetingBoundary } from './greeting-boundary'
import { LatestCard } from './latest-card'
import { NeedsCard } from './needs-card'
import { nextSession, roomsOf } from './next-session'
import { NextSessionCard } from './next-session-card'
import { SpacesCard } from './spaces-card'

type ReaderProps = { user: User; locale: Locale }
type CardProps = ReaderProps & { payload: Payload }

async function NeedsYou({ user, locale }: ReaderProps) {
  return <NeedsCard result={await needs(user, locale)} />
}

async function Next({ payload, user, locale }: CardProps) {
  const session = await nextSession(payload, user, locale)
  const browse = !session && (await canBrowseSpaces(payload, user, locale))
  return (
    <NextSessionCard session={session} view={adminViewOf(user)} browse={browse} locale={locale} />
  )
}

/** "Browse spaces" opens the community page, which is a 404 for a reader with no readable community. */
async function canBrowseSpaces(payload: Payload, user: User, locale: Locale) {
  if (await spacesOff(payload)) return false
  return Boolean((await roomsOf(payload, user, locale))?.communities.length)
}

async function YourSpaces({ payload, user, locale }: CardProps) {
  if (await spacesOff(payload)) return null
  const [spaces, words] = await Promise.all([
    mySpaces(payload, user, locale),
    getTranslations('Spaces'),
  ])
  const summaries = new Map(
    [...spaces.communities, ...spaces.cohorts, ...spaces.courses].map((row) => [row.space.id, row]),
  )
  const cards = spaceLinks(spaces, words('community')).map((link) => {
    const { space, lastActivity } = summaries.get(link.id)!
    return { ...link, kind: space.kind, lastActivity }
  })
  return <SpacesCard spaces={cards} student={adminViewOf(user) === 'student'} locale={locale} />
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
      <GreetingBoundary>
        <Suspense fallback={<PortalPageHeader title={t('greeting')} />}>
          <Greeting {...props} />
        </Suspense>
      </GreetingBoundary>
      <HomeBoard>
        <CardBoundary slot="needs">
          <NeedsYou user={user} locale={locale} />
        </CardBoundary>
        <CardBoundary slot="next">
          <Next {...props} />
        </CardBoundary>
        <CardBoundary slot="spaces">
          <YourSpaces {...props} />
        </CardBoundary>
        <CardBoundary slot="latest">
          <Latest payload={payload} user={user} />
        </CardBoundary>
      </HomeBoard>
    </>
  )
}
