import type { Metadata } from 'next'

import { HomePage, homeMetadata } from '../home-page'

// What is open changes with deadlines: worked out again every five minutes.
export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata()
}

export default async function Page({ params }: Props) {
  const { locale } = await params
  return <HomePage locale={locale} reader={null} />
}
