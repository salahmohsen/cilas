import { courseTitles } from './course-titles'
import { relId } from '@/lib/relation'
import type { CollectionAfterChangeHook } from 'payload'

import { applicantOf } from '@/forms/applicant'
import { notify } from '@/lib/notify'
import { adminRecipients } from '@/lib/review-mail'
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
  return doc
}
