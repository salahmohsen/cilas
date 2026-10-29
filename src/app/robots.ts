import type { MetadataRoute } from 'next'

import { env } from '@/env'

/** Page routes remain crawlable so their noindex directives can be read. */
export default function robots(): MetadataRoute.Robots {
  const origin = env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
