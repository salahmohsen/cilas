import config from '@payload-config'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { CourseLivePreview } from './CourseLivePreview'
import { CourseView } from './CourseView'
import type { Course } from '@/payload-types'

type Params = { params: Promise<{ slug: string }> }

// Registration open/closed is computed from today's date, so rebuild hourly.
export const revalidate = 3600

/**
 * Pre-renders every public course at build time. The route stays dynamic
 * (`dynamicParams`) so a course published after the build is still reachable
 * without a redeploy.
 */
export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: { tier: { equals: 'public' } },
    limit: 0,
    select: { slug: true },
    depth: 0,
  })

  return docs.map((doc) => ({ slug: doc.slug }))
}

export default async function CoursePage({ params }: Params) {
  const { slug } = await params
  const { isEnabled: isPreview } = await draftMode()
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    // Must match the `depth` given to `useLivePreview` in CourseLivePreview,
    // or populated relationships will not survive the live merge.
    depth: 2,
    // Joins are admin views (a course's enrollments, a cycle's courses); never
    // ship them to the page, where a previewing fellow would see assessments.
    joins: false,
    overrideAccess: isPreview,
  })

  const course: Course | undefined = docs[0]

  if (!course) notFound()

  if (!isPreview) {
    return <CourseView course={course} />
  }

  /*
   * In preview, `draft: true` is what returns the in-progress version. It reads
   * from the versions table, and a document that has never been saved as a draft
   * has no row there — the published document is the only record. So fall back
   * to the published read, otherwise previewing any freshly published course
   * 404s until something triggers a version write.
   */
  const { docs: drafts } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    joins: false,
    overrideAccess: true,
    draft: true,
  })

  return (
    <>
      <RefreshRouteOnSave />
      <CourseLivePreview initialData={drafts[0] ?? course} />
    </>
  )
}
