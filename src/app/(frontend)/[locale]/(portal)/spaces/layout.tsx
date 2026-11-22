import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { foldCookie } from '@/portal/nav/fold'
import { needsCounts } from '@/portal/needs/needs'
import { portalNav } from '@/portal/nav/portal-nav'
import { PortalShell } from '@/portal/nav/portal-shell'
import { portalSpaces } from '@/portal/nav/portal-spaces'
import { spaceLinks } from '@/portal/nav/space-links'

export const metadata: Metadata = { robots: { index: false } }

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

/** Signed-in area: a signed-out reader goes to login, then back to the spaces. */
export default async function SpacesLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  const [t, jar, spaces] = await Promise.all([
    getTranslations('Spaces'),
    cookies(),
    portalSpaces(user, locale),
  ])
  const counts = needsCounts(user).catch(async (err: unknown) => {
    const payload = await getPayload({ config })
    payload.logger.error({ err }, 'portal nav: the counts did not load')
    return null
  })
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
