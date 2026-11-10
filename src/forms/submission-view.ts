import type { Payload, PayloadRequest } from 'payload'
import { relId } from '@/lib/relation'
import type { FormSubmission } from '@/payload-types'

export async function submissionChoices(
  payload: Payload,
  choices: FormSubmission['choices'],
  req?: PayloadRequest,
) {
  return Promise.all(
    (choices ?? []).map(async (choice) => {
      const id = relId(choice.course)!
      const course = await payload.findByID({ collection: 'courses', id, depth: 0, req })
      return {
        ...choice,
        course: id,
        title: course.title,
        href: `/admin/collections/courses/${id}`,
      }
    }),
  )
}
