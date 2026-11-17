import config from '@payload-config'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { mode, spacesSettings } from '@/lib/spaces'
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false } }

type Props = {
  children: React.ReactNode
  dialog: React.ReactNode
  params: Promise<{ locale: string }>
}

/** Signed-in area. Off: every space page is not found (spec §10), a refusal, not a detour. */
export default async function SpacesLayout({ children, dialog, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  if (mode(await spacesSettings(await getPayload({ config }))) === 'off') notFound()
  return (
    // Spaces keep the earlier, narrower frame (1200px): their side column
    // grows too wide in the site's wide one.
    <div className="mx-auto w-full max-w-300" data-page="spaces">
      {children}
      {dialog}
    </div>
  )
}
