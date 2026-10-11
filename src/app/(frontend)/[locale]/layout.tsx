import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Noto_Sans_Arabic } from 'next/font/google'
import React from 'react'

import '@/components/arc/foundation.css'
import '../styles.css'
import { SiteFooter } from '@/components/site-footer'
import { CILASSiteHeader } from '@/components/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import { DirectionProvider } from '@/components/ui/direction'
import { isRtl, routing } from '@/i18n/routing'

const fontSans = Noto_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  variable: '--font-sans',
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta')
  return { title: t('siteName'), description: t('description') }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const direction = isRtl(locale) ? 'rtl' : 'ltr'

  return (
    // next-themes sets data-theme and the class before React hydrates.
    <html className={fontSans.variable} dir={direction} lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider>
            <DirectionProvider direction={direction}>
              <CILASSiteHeader />
              <main className="mx-auto min-h-[60vh] max-w-300">{children}</main>
              {/* The same width as the page content. */}
              <div className="mx-auto max-w-300">
                <SiteFooter />
              </div>
            </DirectionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
