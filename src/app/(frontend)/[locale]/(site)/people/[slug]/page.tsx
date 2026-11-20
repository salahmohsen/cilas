import type { Metadata } from 'next'

import { PersonPage } from '@/components/person/person-page'
import { withShareCard } from '@/lib/seo'

import { personMetadata } from './metadata'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  return withShareCard(await personMetadata(locale, slug))
}

export default async function Page({ params }: Props) {
  return <PersonPage {...await params} user={null} />
}
