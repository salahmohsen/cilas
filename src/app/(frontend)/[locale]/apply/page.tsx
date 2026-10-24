import type { Metadata } from 'next'

import { OpenPage, openMetadata } from './open-page'

// What is open follows deadlines: worked out every five minutes, as /api/open is.
export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return openMetadata()
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <OpenPage locale={locale} reader={null} />
}
