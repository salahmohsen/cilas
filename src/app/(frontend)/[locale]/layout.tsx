import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import React from 'react'

import '@/components/arc/foundation.css'
import '../styles.css'
import { SiteDeadlines } from '@/components/site-deadlines'
import { getNavigation, getSocialLinks } from '@/api/social.api'
import { SiteFooter } from '@/components/site-footer'
import { PushRegistrar } from '@/components/push/push-registrar'
import { SiteToasts } from '@/components/site-toasts'
import config from '@payload-config'
import { getPayload } from 'payload'

import { getCurrentPlace } from '@/api/place.api'
import { CILASSiteHeader } from '@/components/site-header'
import { Schema } from '@/components/schema'
import { ThemeProvider } from '@/components/theme-provider'
import { DirectionProvider } from '@/components/ui/direction'
import { isRtl, routing } from '@/i18n/routing'
import { env } from '@/env'
import { fontVariables } from '@/lib/fonts'
import { newsletterList } from '@/lib/newsletter-list'
import { DEFAULT_OG_IMAGE } from '@/lib/og'
import { pushConfig } from '@/lib/push/config'
import { organizationSchema, websiteSchema } from '@/lib/schema'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Matches the manifest's theme colour (src/app/manifest.ts).
export const viewport: Viewport = { themeColor: '#18181b' }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta')
  return {
    // Absolute URLs for shared images and links.
    metadataBase: new URL(env.NEXT_PUBLIC_SERVER_URL),
    title: t('siteName'),
    description: t('description'),
    // The logo in white, centred on a square at its own proportions.
    // iOS shows a transparent icon on black, so Apple gets the opaque one.
    icons: {
      icon: '/assets/images/favicon.png',
      apple: '/assets/icons/apple-touch-icon.png',
    },
    // Home-screen web app on iOS; the manifest covers the rest.
    appleWebApp: { capable: true, title: t('siteName'), statusBarStyle: 'default' },
    // A page with no image of its own shares the default one.
    openGraph: { siteName: t('siteName'), images: [DEFAULT_OG_IMAGE] },
    twitter: { card: 'summary_large_image', images: [DEFAULT_OG_IMAGE.url] },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const direction = isRtl(locale) ? 'rtl' : 'ltr'
  const [t, socials, place, list, nav] = await Promise.all([
    getTranslations('Meta'),
    getSocialLinks(),
    getCurrentPlace(locale === 'ar' ? 'ar' : 'en'),
    // The footer's signup shows only when there is a list to join.
    getPayload({ config }).then((payload) => newsletterList(payload)),
    getNavigation(),
  ])

  return (
    // next-themes sets data-theme and the class before React hydrates.
    <html
      className={fontVariables}
      // Smooth in-page jumps; Next turns smoothing off for route changes.
      data-scroll-behavior="smooth"
      dir={direction}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        {/* Search engines read this, not people: the institute and the site. */}
        <Schema
          data={[
            organizationSchema({
              siteName: t('siteName'),
              description: t('description'),
              location: place ? { address: place.address, mapUrl: place.mapUrl } : undefined,
              sameAs: socials.map((s) => s.url),
            }),
            websiteSchema({ siteName: t('siteName'), locale }),
          ]}
        />
        <ThemeProvider>
          <NextIntlClientProvider>
            <DirectionProvider direction={direction}>
              <SiteToasts rtl={direction === 'rtl'}>
                {/* Open deadlines, across the whole width, above the header. */}
                <SiteDeadlines locale={locale as 'en' | 'ar'} />
                <CILASSiteHeader nav={nav} />
                {/* Only when VAPID keys are set; the worker then registers after sign-in. */}
                {pushConfig() && <PushRegistrar />}
                <main className="mx-auto min-h-[60vh] max-w-300">{children}</main>
                {/* The same width as the page content. */}
                <div className="mx-auto max-w-300">
                  <SiteFooter
                    nav={nav}
                    newsletter={Boolean(list)}
                    place={place}
                    socials={socials}
                  />
                </div>
              </SiteToasts>
            </DirectionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
