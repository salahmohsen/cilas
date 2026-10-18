'use client'

import { VisualEditing } from '@payload-inline-visual-editor/react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import React from 'react'

import { CourseView, type RelatedCourse } from './CourseView'
import { useInAdminFrame } from '@/components/admin-frame-only'
import { clientEnv as env } from '@/env.client'
import type { Course } from '@/payload-types'

/**
 * Live-preview wrapper around `CourseView`, per
 * https://payloadcms.com/docs/live-preview/client.
 *
 * The server component fetches the course and passes it as `initialData`; this
 * hook merges the admin's in-progress form state over it on every change, so
 * edits appear as they are typed rather than only after autosave. The markup
 * itself lives in `CourseView`, which is shared with the public page.
 *
 * `depth` must match the depth of the server component's query exactly, or
 * relationships and uploads will not populate.
 */
export const CourseLivePreview: React.FC<{ initialData: Course; related?: RelatedCourse[] }> = ({
  initialData,
  related,
}) => {
  const { data } = useLivePreview<Course>({
    initialData,
    // Read from env, not `window.location.origin`: these pages are statically
    // prerendered at build time, where `window` does not exist.
    serverURL: env.NEXT_PUBLIC_SERVER_URL,
    depth: 2,
  })

  // Rendered only in draft mode (page.tsx), so the editor marks the fields
  // and edits the draft; the marks only inside the admin, as draft mode
  // outlives the preview.
  const inAdmin = useInAdminFrame()
  return (
    <>
      {inAdmin ? <VisualEditing draft serverURL={env.NEXT_PUBLIC_SERVER_URL} /> : null}
      <CourseView course={data} editable={inAdmin} related={related} />
    </>
  )
}
