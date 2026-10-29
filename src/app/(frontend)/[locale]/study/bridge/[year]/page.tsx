import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { bridgeSlugOf, getBridgeYear, listBridgeYears } from '@/api/programmes.api'
import { BridgeYearView } from '@/components/bridge/bridge-year'
import { redirect } from '@/i18n/navigation'
import { ogImages } from '@/lib/og'
import { pageAlternates } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; year: string }> }

export const revalidate = 3600

const langOf = (locale: string) => (locale === 'ar' ? 'ar' : 'en')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, year: path } = await params
  const year = await getBridgeYear(await getPayload({ config }), langOf(locale), {
    slug: bridgeSlugOf(path),
  })
  if (!year) return {}
  const title = year.programme.title
  return {
    title,
    description: year.programme.tagline,
    alternates: pageAlternates(`/study/bridge/${path}`, locale),
    openGraph: {
      title,
      description: year.programme.tagline ?? undefined,
      images: ogImages(year.cover?.url ?? undefined),
    },
  }
}

/** A past Bridge year, as a record: `/study/bridge/2024-2025`. The current year lives at /study/bridge. */
export default async function BridgeYearPage({ params }: Props) {
  const { locale, year: path } = await params
  const lang = langOf(locale)
  const slug = bridgeSlugOf(path)
  const payload = await getPayload({ config })
  const [year, years] = await Promise.all([
    getBridgeYear(payload, lang, { slug }),
    listBridgeYears(payload, lang),
  ])
  if (!year) notFound()
  if (years[0]?.slug === slug) redirect({ href: '/study/bridge', locale })

  return <BridgeYearView current={false} locale={locale} year={year} years={years} />
}
