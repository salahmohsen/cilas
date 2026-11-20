import type { Metadata } from 'next'

import { currentReader } from '@/lib/reader'
import { HomePage, homeMetadata } from '../home-page'

type Props = { params: Promise<{ locale: string }> }

/** The home page for a signed-in reader, with `community` courses open now (src/proxy.ts). */
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await homeMetadata()), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <HomePage locale={locale} reader={await currentReader()} />
}
