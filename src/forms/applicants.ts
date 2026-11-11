import 'server-only'
import type { Payload, TypedUser } from 'payload'
import { isAdminUser, isFellowUser, personOf } from '@/access'
import { relId } from '@/lib/relation'

import { mediaImage, mediaPopulate } from '@/lib/media-image'
import { courseRegistration } from '@/lib/registration'

export type ApplicantViewer = { kind: 'admin' } | { kind: 'fellow'; person: number }

export function applicantViewer(user?: TypedUser | null): ApplicantViewer | null {
  if (isAdminUser(user)) return { kind: 'admin' }
  const person = personOf(user)
  return isFellowUser(user) && person !== null ? { kind: 'fellow', person } : null
}

/**
 * The questions an application is shown with. An answer whose question was
 * since removed from the form stays visible, as a plain text question.
 */
export const withRetired = <T extends { blockType: string }>(
  questions: T[],
  answers: { name: string; label: string }[],
): T[] => [
  ...questions,
  ...answers
    .filter((a) => !questions.some((q) => 'name' in q && q.name === a.name))
    .map((a) => ({ blockType: 'textarea', name: a.name, label: a.label }) as unknown as T),
]

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
      depth: 1,
      populate: {
        media: mediaPopulate,
        cycles: { title: true, registration: true, pricing: true },
      },
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
          depth: 1,
          populate: { media: mediaPopulate },
          locale,
        })
        return [id, form.fields ?? []] as const
      }),
    ),
  )
  const applications = submissions.flatMap((s) => {
    const choices = (s.choices ?? [])
      .filter((c) => own.has(Number(relId(c.course))))
      .map((c) => {
        const course = own.get(Number(relId(c.course)))!
        const cycle = typeof course.cycle === 'object' ? course.cycle : null
        const answers = (c.answers ?? []).map((a) => ({
          name: a.name,
          label: a.label || a.name,
          value: a.value || '',
        }))
        return {
          course: course.id,
          title: course.title,
          accepted: c.accepted === true,
          cover: mediaImage(typeof course.cover_image === 'object' ? course.cover_image : null),
          cycle: cycle ? { id: cycle.id, title: cycle.title } : null,
          fields: withRetired(course.applicant_questions ?? [], answers),
          answers,
          // Contributions are for admins: a fellow's view has no amounts to show.
          contribution: admin ? courseRegistration(course, cycle).price : null,
          ...(admin ? { amount: c.amount, need_reduction: c.need_reduction } : {}),
        }
      })
    if (!choices.length) return []
    const formFields = forms.get(Number(relId(s.form))) ?? []
    const answers = (s.submissionData ?? []).map((a) => {
      const question = formFields.find((q) => 'name' in q && q.name === a.field)
      return {
        name: a.field,
        label: question && 'label' in question ? question.label || a.field : a.field,
        value: a.value,
      }
    })
    const answer = (field: string) => s.submissionData?.find((a) => a.field === field)?.value || ''
    return [
      {
        id: s.id,
        name: answer('name'),
        email: answer('email'),
        submitted: s.createdAt,
        status: s.status || 'new',
        decided: s.decided_at ?? null,
        target: s.target?.relationTo ?? null,
        formId: Number(relId(s.form)),
        canAccept:
          Boolean(s.target) &&
          (s.target?.relationTo === 'programmes' || choices.some((c) => c.accepted)),
        fields: withRetired(formFields, answers),
        answers,
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

export type ApplicantsData = Awaited<ReturnType<typeof applicantsFor>>
export type Applicant = ApplicantsData['applications'][number]
