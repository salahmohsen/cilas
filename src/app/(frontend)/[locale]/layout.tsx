import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import React from 'react'

import '@/components/arc/foundation.css'
import '../styles.css'
import { PushRegistrar } from '@/components/push/push-registrar'
import { SiteArcProvider } from '@/components/site-arc-provider'
import { SiteToasts } from '@/components/site-toasts'
import { ThemeProvider } from '@/components/theme-provider'
import { DirectionProvider } from '@radix-ui/react-direction'
import { isRtl, routing } from '@/i18n/routing'
import { env } from '@/env'
import { fontVariables } from '@/lib/fonts'
import { pushConfig } from '@/lib/push/config'

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
    // A page with no card of its own shares the site's (opengraph-image.tsx).
    openGraph: { siteName: t('siteName') },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const direction = isRtl(locale) ? 'rtl' : 'ltr'

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
        <ThemeProvider>
          <NextIntlClientProvider>
            <DirectionProvider dir={direction}>
              <SiteArcProvider>
                <SiteToasts rtl={direction === 'rtl'}>
                  {/* Only when VAPID keys are set; the worker then registers after sign-in. */}
                  {pushConfig() && <PushRegistrar />}
                  {children}
                </SiteToasts>
              </SiteArcProvider>
            </DirectionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
