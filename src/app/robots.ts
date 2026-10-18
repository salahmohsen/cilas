import type { MetadataRoute } from 'next'

import { env } from '@/env'

/** Crawlers read the public site; the admin, the API and account pages stay out. */
export default function robots(): MetadataRoute.Robots {
  const origin = env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/en/login', '/ar/login', '/en/signed-in', '/ar/signed-in', '/en/study/*/apply', '/ar/study/*/apply'],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
