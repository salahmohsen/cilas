import type { PayloadRequest } from 'payload'
import { answerTexts } from './answer-text'
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

/** The choices for the admin view, each answer shown with its options' current labels. */
export async function readableChoices(req: PayloadRequest, choices: FormSubmission['choices']) {
  const views = await submissionChoices(req, choices)
  if (!views.length) return views
  const { docs } = await req.payload.find({
    collection: 'courses',
    where: { id: { in: [...new Set(views.map((c) => c.course))] } },
    select: { applicant_questions: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const text = new Map(docs.map((c) => [c.id, answerTexts(c.applicant_questions)]))
  return views.map((c) => ({
    ...c,
    answers: c.answers?.map((a) => ({
      ...a,
      value: text.get(c.course)?.(a.name, a.value ?? '') ?? a.value,
    })),
  }))
}

/** The shared answers for the admin view, with their questions' labels and option labels. */
export async function readableAnswers(
  req: PayloadRequest,
  form: FormSubmission['form'] | undefined,
  answers: FormSubmission['submissionData'],
) {
  const id = relId(form)
  const fields = id
    ? ((
        await req.payload.findByID({ collection: 'forms', id, depth: 0, overrideAccess: true, req })
      ).fields ?? [])
    : []
  const text = answerTexts(fields)
  const labels = new Map(
    fields.flatMap((f) => ('name' in f && 'label' in f && f.label ? [[f.name, f.label]] : [])),
  )
  return (answers ?? []).map((a) => ({
    id: a.id,
    label: labels.get(a.field) ?? a.field,
    value: text(a.field, a.value),
  }))
}
