import 'server-only'
import type { Payload, TypedUser } from 'payload'
import { isAdminUser, isFellowUser, personOf } from '@/access'
import { relId } from '@/lib/relation'

import { answerTexts } from './answer-text'

export type ApplicantViewer = { kind: 'admin' } | { kind: 'fellow'; person: number }

export function applicantViewer(user?: TypedUser | null): ApplicantViewer | null {
  if (isAdminUser(user)) return { kind: 'admin' }
  const person = personOf(user)
  return isFellowUser(user) && person !== null ? { kind: 'fellow', person } : null
}

export async function applicantsFor(
  payload: Payload,
  viewer: ApplicantViewer | null,
  locale: 'en' | 'ar' = 'en',
) {
  if (!viewer) return { courses: [], applications: [] }
  const admin = viewer.kind === 'admin'
  const courses = (
    await payload.find({
      collection: 'courses',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      locale,
      ...(viewer.kind === 'fellow' ? { where: { fellows: { contains: viewer.person } } } : {}),
    })
  ).docs
  const ids = courses.map((c) => c.id)
  if (!ids.length) return { courses: [], applications: [] }
  const own = new Map(courses.map((c) => [c.id, c]))
  const submissions = (
    await payload.find({
      collection: 'form-submissions',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      sort: '-createdAt',
      where: { 'choices.course': { in: ids } },
    })
  ).docs
  const forms = new Map(
    await Promise.all(
      [...new Set(submissions.map((s) => Number(relId(s.form))))].map(async (id) => {
        const form = await payload.findByID({
          collection: 'forms',
          id,
          overrideAccess: true,
          depth: 0,
          locale,
        })
        const fields = form.fields ?? []
        return [
          id,
          {
            labels: new Map(
              fields.flatMap((f) =>
                'name' in f
                  ? [[f.name, 'label' in f && typeof f.label === 'string' ? f.label : f.name]]
                  : [],
              ),
            ),
            text: answerTexts(fields),
          },
        ] as const
      }),
    ),
  )
  const courseText = new Map(courses.map((c) => [c.id, answerTexts(c.applicant_questions)]))
  const applications = submissions.flatMap((s) => {
    const choices = (s.choices ?? [])
      .filter((c) => own.has(Number(relId(c.course))))
      .map((c) => ({
        course: Number(relId(c.course)),
        title: own.get(Number(relId(c.course)))!.title,
        accepted: c.accepted === true,
        answers: (c.answers ?? []).map((a) => ({
          label: a.label || a.name,
          value: courseText.get(Number(relId(c.course)))!(a.name, a.value || ''),
        })),
        ...(admin ? { amount: c.amount, need_reduction: c.need_reduction } : {}),
      }))
    if (!choices.length) return []
    const answer = (field: string) => s.submissionData?.find((a) => a.field === field)?.value || ''
    return [
      {
        id: s.id,
        name: answer('name'),
        email: answer('email'),
        submitted: s.createdAt,
        status: s.status || 'new',
        answers: (s.submissionData ?? []).map((a) => {
          const form = forms.get(Number(relId(s.form)))
          return {
            label: form?.labels.get(a.field) || a.field,
            value: form ? form.text(a.field, a.value) : a.value,
          }
        }),
        choices,
      },
    ]
  })
  return {
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      count: applications.filter((a) => a.choices.some((choice) => choice.course === c.id)).length,
    })),
    applications,
  }
}
