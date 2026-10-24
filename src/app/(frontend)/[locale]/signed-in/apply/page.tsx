import type { Metadata } from 'next'

import { currentReader } from '@/lib/reader'
import { OpenPage, openMetadata } from '../../apply/open-page'

type Props = { params: Promise<{ locale: string }> }

/** Open for registration for a signed-in reader, with `community` courses (src/proxy.ts). */
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await openMetadata()), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <OpenPage locale={locale} reader={await currentReader()} />
}
