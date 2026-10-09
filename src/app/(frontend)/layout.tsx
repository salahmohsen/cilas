import { DirectionProvider } from '@/components/ui/direction'
import { Noto_Sans_Arabic } from 'next/font/google'
import React from 'react'
import '@/components/arc/foundation.css'
import './styles.css'
import { CILASSiteHeader } from '@/components/site-header'

export const metadata = {
  description:
    'Cairo Institute of Liberal Arts and Sciences — A pedagogy of discovery and attunement.',
  title: 'CILAS',
}

const fontSans = Noto_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  variable: '--font-sans',
})

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  const direction = 'ltr'
  const lang = 'en'

  return (
    <html className={fontSans.variable} dir={direction} lang={lang} data-theme="light">
      <body>
        <DirectionProvider direction={direction}>
          <CILASSiteHeader />
          <main className="mx-auto max-w-300">{children}</main>
        </DirectionProvider>
      </body>
    </html>
  )
}
