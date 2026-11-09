import type { Metadata } from 'next'

import { personMetadata } from '@/app/(frontend)/[locale]/people/[slug]/metadata'
import { PersonPage } from '@/components/person/person-page'
import { currentReader } from '@/lib/reader'
import { withShareCard } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; slug: string }> }

/**
 * A person's page for a signed-in reader, rendered per request, with their
 * `community` articles. The visitor keeps the /people/[slug] address:
 * src/proxy.ts rewrites here when the request carries Payload's cookie.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  // Only reached through the rewrite; the public address is the canonical one.
  return { ...withShareCard(await personMetadata(locale, slug)), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  return <PersonPage {...await params} user={await currentReader()} />
}
