import config from '@payload-config'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { mode, spacesSettings } from '@/lib/spaces'

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

/** Signed-in area. Off: every space page is not found (spec §10), a refusal, not a detour. */
export default async function SpacesLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  if (mode(await spacesSettings(await getPayload({ config }))) === 'off') notFound()
  return <div data-page="spaces">{children}</div>
}
