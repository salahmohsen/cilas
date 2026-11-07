import { BRIDGE_PATH } from '@/lib/paths'
import { localeOf } from '@/i18n/routing'
import config from '@payload-config'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getBridgeYear, listBridgeYears } from '@/api/programmes.api'
import { BridgeYearView } from '@/components/bridge/bridge-year'
import { ogImages } from '@/lib/og'
import { pageAlternates } from '@/lib/seo'
import { currentReader } from '@/lib/reader'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ programme?: string }> }

// Registration open/closed is computed from today's date, so rebuild hourly.
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Bridge' })
  const year = await getBridgeYear(await getPayload({ config }), localeOf(locale))
  const title = year?.programme.title ?? t('metaTitle')
  const description = year?.programme.tagline ?? t('metaDescription')
  return {
    title,
    description,
    alternates: pageAlternates(BRIDGE_PATH, locale),
    openGraph: { title, description, images: ogImages(year?.cover?.url ?? undefined) },
  }
}

/**
 * The Bridge Programme: the current year, and how to join it. In the admin's
 * live preview (draft mode, from /api/preview) it shows the programme being
 * edited, as drafted, whichever year it is.
 */
export default async function BridgePage({ params, searchParams }: Props) {
  const { locale } = await params
  const lang = localeOf(locale)
  const { isEnabled: isPreview } = await draftMode()
  const previewSlug = isPreview ? (await searchParams).programme : undefined
  const payload = await getPayload({ config })
  const [year, years] = await Promise.all([
    getBridgeYear(
      payload,
      lang,
      previewSlug ? { slug: previewSlug, draft: true, user: await currentReader() } : {},
    ),
    listBridgeYears(payload, lang),
  ])
  if (!year) notFound()
  // A previewed draft is the current year only when it is the latest published one (or none is).
  const current = !previewSlug || !years.length || years[0]!.slug === previewSlug

  return (
    <BridgeYearView
      current={current}
      locale={locale}
      preview={isPreview}
      year={year}
      years={years}
    />
  )
}
