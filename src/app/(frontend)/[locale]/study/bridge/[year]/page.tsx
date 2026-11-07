import { BRIDGE_PATH } from '@/lib/paths'
import { localeOf } from '@/i18n/routing'
import { bridgeSlugOf } from '@/lib/paths'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getBridgeYear, listBridgeYears } from '@/api/programmes.api'
import { BridgeYearView } from '@/components/bridge/bridge-year'
import { redirect } from '@/i18n/navigation'
import { buildPageMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; year: string }> }

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, year: path } = await params
  const year = await getBridgeYear(await getPayload({ config }), localeOf(locale), {
    slug: bridgeSlugOf(path),
  })
  if (!year) return {}
  const title = year.programme.title
  const { twitter: _twitter, ...metadata } = buildPageMetadata({
    title,
    description: year.programme.tagline,
    image: year.cover?.url,
    path: `${BRIDGE_PATH}/${path}`,
    locale,
  })
  return metadata
}

/** A past Bridge year, as a record: `/study/bridge/2024-2025`. The current year lives at /study/bridge. */
export default async function BridgeYearPage({ params }: Props) {
  const { locale, year: path } = await params
  const lang = localeOf(locale)
  const slug = bridgeSlugOf(path)
  const payload = await getPayload({ config })
  const [year, years] = await Promise.all([
    getBridgeYear(payload, lang, { slug }),
    listBridgeYears(payload, lang),
  ])
  if (!year) notFound()
  if (years[0]?.slug === slug) redirect({ href: BRIDGE_PATH, locale })

  return <BridgeYearView current={false} locale={locale} year={year} years={years} />
}
