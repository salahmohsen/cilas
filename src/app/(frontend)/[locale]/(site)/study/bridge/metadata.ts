import { getBridgeYear } from '@/api/programmes.api'
import { localeOf } from '@/i18n/routing'
import { BRIDGE_PATH } from '@/lib/paths'
import { buildPageMetadata } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

/** The Bridge page's metadata: the current year's. Shared with its share card. */
export async function bridgeMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Bridge' })
  const year = await getBridgeYear(await getPayload({ config }), localeOf(locale))
  return buildPageMetadata({
    title: year?.programme.title ?? t('metaTitle'),
    description: year?.programme.tagline ?? t('metaDescription'),
    image: year?.cover?.url,
    path: BRIDGE_PATH,
    locale,
  })
}
