import type { Metadata } from 'next'

import { CourseApplyPage, courseApplyMetadata } from './course-apply-page'

type Props = { params: Promise<{ locale: string; slug: string }> }

// Open or closed follows today's date, so rebuild hourly.
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  return courseApplyMetadata(locale, slug, null)
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  return <CourseApplyPage locale={locale} reader={null} slug={slug} />
}
