import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { foldCookie } from '@/portal/nav/fold'
import { mySpaces } from '@/lib/spaces-data'
import { needsCounts } from '@/portal/needs/needs'
import { portalNav } from '@/portal/nav/portal-nav'
import { PortalShell } from '@/portal/nav/portal-shell'
import { spaceLinks } from '@/portal/nav/space-links'

export const metadata: Metadata = { robots: { index: false } }

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

const NO_SPACES = { communities: [], cohorts: [], courses: [] }

/** Signed-in area: a signed-out reader goes to login, then back to the spaces. */
export default async function SpacesLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  const payload = await getPayload({ config })
  // Started here and never awaited, so the reads overlap `mySpaces` and the first byte does not wait for them.
  const counts = needsCounts(user).catch((err: unknown) => {
    payload.logger.error({ err }, 'portal nav: the counts did not load')
    return null
  })
  const [t, jar, spaces] = await Promise.all([
    getTranslations('Spaces'),
    cookies(),
    // The nav still renders without its spaces (spec, Navigation, Errors).
    mySpaces(payload, user, locale).catch((err: unknown) => {
      payload.logger.error({ err }, 'portal nav: the spaces list did not load')
      return NO_SPACES
    }),
  ])
  return (
    <PortalShell
      nav={portalNav(user)}
      counts={counts}
      spaces={spaceLinks(spaces, t('community'))}
      folded={jar.has(foldCookie(user.id))}
      accountId={user.id}
    >
      {children}
    </PortalShell>
  )
}
