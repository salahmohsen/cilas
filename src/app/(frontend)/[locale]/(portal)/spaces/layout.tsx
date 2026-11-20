import { redirect } from 'next/navigation'

import { SiteFrame } from '@/components/site-frame'
import { currentReader } from '@/lib/reader'
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false } }

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

/** Signed-in area: a signed-out reader goes to login, then back to the spaces. */
export default async function SpacesLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  return (
    <SiteFrame>
      {/* Spaces keep the earlier, narrower frame (1200px): their side column
          grows too wide in the site's wide one. */}
      <div className="mx-auto w-full max-w-300" data-page="spaces">
        {children}
      </div>
    </SiteFrame>
  )
}
