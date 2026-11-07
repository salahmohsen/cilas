import type { Metadata } from 'next'

import { currentReader } from '@/lib/reader'
import { withShareCard } from '@/lib/seo'
import { CoursePage, courseMetadata } from '../../../study/[slug]/course-page'

type Params = { params: Promise<{ locale: string; slug: string }> }

/** A course page for a signed-in reader, with `community` courses (src/proxy.ts). */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale } = await params
  return {
    ...withShareCard(await courseMetadata(locale, slug, await currentReader())),
    robots: { index: false },
  }
}

export default async function Page({ params }: Params) {
  const { slug, locale } = await params
  return <CoursePage locale={locale} reader={await currentReader()} slug={slug} />
}
