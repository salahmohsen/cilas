import type { Metadata } from 'next'

import { currentReader } from '@/lib/reader'
import { CourseApplyPage, courseApplyMetadata } from '../../../../study/[slug]/apply/course-apply-page'

type Props = { params: Promise<{ locale: string; slug: string }> }

/** A course's application for a signed-in reader, with `community` courses (src/proxy.ts). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  return { ...(await courseApplyMetadata(locale, slug, await currentReader())), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  return <CourseApplyPage locale={locale} reader={await currentReader()} slug={slug} />
}
