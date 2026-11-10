import type { PayloadRequest } from 'payload'
import { courseTitles } from './course-titles'
import { relId } from '@/lib/relation'
import type { FormSubmission } from '@/payload-types'

export async function submissionChoices(req: PayloadRequest, choices: FormSubmission['choices']) {
  const ids = (choices ?? []).map((choice) => relId(choice.course))
  const titles = await courseTitles(req, ids)
  return (choices ?? []).map((choice, i) => ({
    ...choice,
    course: ids[i],
    title: titles.get(ids[i]) ?? '',
    href: `/admin/collections/courses/${ids[i]}`,
  }))
}
