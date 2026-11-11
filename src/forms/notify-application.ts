import { courseTitles } from './course-titles'
import { fellowNoticesFor, type CourseFellows } from './application-recipients'
import { relId } from '@/lib/relation'
import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'

import { applicantOf } from '@/forms/applicant'
import { notify } from '@/lib/notify'
import { toPersonIds } from '@/lib/fellow-role'
import { adminRecipients, ownerRecipients } from '@/lib/review-mail'
import type { FormSubmission } from '@/payload-types'

export const notifyNewApplication: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !doc.target?.value) return doc
  const { relationTo, value } = doc.target as {
    relationTo: 'courses' | 'programmes' | 'cycles'
    value: number | { id: number }
  }
  const id = relId(value)
  const target = await req.payload
    .findByID({ collection: relationTo, id, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  let title = target?.title ?? relationTo
  if (relationTo === 'cycles') {
    const ids = ((doc as FormSubmission).choices ?? []).map((choice) => relId(choice.course))
    const titles = await courseTitles(req, ids)
    title = ids
      .map((id) => titles.get(id))
      .filter(Boolean)
      .join(', ')
  }
  const admins = await adminRecipients(req)
  const applicant = applicantOf(doc.submissionData)
  const applicantName = 'name' in applicant ? applicant.name : undefined
  await notify(
    req.payload,
    admins.map((a) => a.id),
    {
      kind: 'application',
      description: applicantName
        ? `${applicantName} applied to “${title}”`
        : `An application to “${title}”`,
      link: `/admin/collections/form-submissions/${doc.id}`,
    },
  )

  const courseIds = [
    ...new Set(
      ((doc as FormSubmission).choices ?? [])
        .map((choice) => Number(relId(choice.course)))
        .filter(Number.isFinite),
    ),
  ]
  const courses = await fellowCourses(req, courseIds)
  const notices = fellowNoticesFor(
    admins.map((a) => a.id),
    courses,
  )
  for (const { course, users } of notices) {
    await notify(req.payload, users, {
      kind: 'application',
      description: applicantName
        ? `${applicantName} applied to “${course.title}”`
        : `An application to “${course.title}”`,
      link: `/admin/applicants?course=${course.id}`,
    })
  }
  return doc
}

const fellowCourses = async (req: PayloadRequest, ids: number[]): Promise<CourseFellows[]> => {
  if (!ids.length) return []
  try {
    const { docs } = await req.payload.find({
      collection: 'courses',
      where: { id: { in: ids } },
      select: { title: true, fellows: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    return await Promise.all(
      docs.map(async (course) => ({
        id: course.id,
        title: course.title,
        fellowUsers: (await ownerRecipients(req, toPersonIds(course.fellows))).map((u) => u.id),
      })),
    )
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Fellows not found for application notices' })
    return []
  }
}
