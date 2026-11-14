'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ArcProvider } from '@/components/arc/lib/arc-provider'

/**
 * Arc renders plain `<a>` and `<img>` by default. Here every Arc image goes
 * through next/image, so the browser gets a copy resized to the `sizes` the
 * component sets, not the full upload. Links stay next/link, not next-intl's:
 * callers already pass hrefs with the locale in them.
 */
export function SiteArcProvider({ children }: { children: ReactNode }) {
  return (
    <ArcProvider link={Link} image={Image}>
      {children}
    </ArcProvider>
  )
}
