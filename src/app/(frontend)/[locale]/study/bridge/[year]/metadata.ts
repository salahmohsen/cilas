import { getBridgeYear } from '@/api/programmes.api'
import { localeOf } from '@/i18n/routing'
import { BRIDGE_PATH, bridgeSlugOf } from '@/lib/paths'
import { buildPageMetadata } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'

/** A past Bridge year's metadata. Shared with its share card. */
export async function bridgeYearMetadata(locale: string, path: string): Promise<Metadata> {
  const year = await getBridgeYear(await getPayload({ config }), localeOf(locale), {
    slug: bridgeSlugOf(path),
  })
  if (!year) return {}
  return buildPageMetadata({
    title: year.programme.title,
    description: year.programme.tagline,
    image: year.cover?.url,
    path: `${BRIDGE_PATH}/${path}`,
    locale,
  })
}
