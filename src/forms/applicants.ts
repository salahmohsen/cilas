import 'server-only'
import type { Payload, TypedUser, Where } from 'payload'
import { isAdminUser, isFellowUser, personOf } from '@/access'
import { relId } from '@/lib/relation'

const financialAnswer = (name: string) =>
  /amount|contribution|reduction|pricing|payment/i.test(name)

export async function applicantsForFellow(
  payload: Payload,
  user?: TypedUser | null,
  locale: 'en' | 'ar' = 'en',
) {
  const admin = isAdminUser(user)
  const person = personOf(user)
  if (!admin && (!isFellowUser(user) || person === null)) return { courses: [], applications: [] }
  const courses = (
    await payload.find({
      collection: 'courses',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      locale,
      ...(admin ? {} : { where: { fellows: { contains: person } } }),
    })
  ).docs
  const ids = courses.map((c) => c.id)
  if (!ids.length) return { courses: [], applications: [] }
  const own = new Map(courses.map((c) => [c.id, c]))
  const where: Where = {
    or: [
      { 'choices.course': { in: ids } },
      { and: [{ 'target.relationTo': { equals: 'courses' } }, { 'target.value': { in: ids } }] },
    ],
  }
  const submissions = (
    await payload.find({
      collection: 'form-submissions',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      sort: '-createdAt',
      where,
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
        return [
          id,
          new Map(
            (form.fields ?? []).flatMap((f) =>
              'name' in f
                ? [
                    [
                      f.name,
                      'label' in f && typeof f.label === 'string' ? f.label : f.name,
                    ] as const,
                  ]
                : [],
            ),
          ),
        ] as const
      }),
    ),
  )
  const applications = submissions.flatMap((s) => {
    const legacy =
      !s.choices?.length && s.target?.relationTo === 'courses'
        ? own.get(Number(relId(s.target.value)))
        : undefined
    const choices = (s.choices ?? [])
      .filter((c) => own.has(Number(relId(c.course))))
      .map((c) => ({
        course: Number(relId(c.course)),
        title: own.get(Number(relId(c.course)))!.title,
        accepted: c.accepted === true,
        answers: (c.answers ?? []).map((a) => ({ label: a.label || a.name, value: a.value || '' })),
        ...(admin ? { amount: c.amount, need_reduction: c.need_reduction } : {}),
      }))
    if (legacy)
      choices.push({
        course: legacy.id,
        title: legacy.title,
        accepted: s.status === 'accepted',
        answers: (s.submissionData ?? [])
          .filter((a) => a.field.startsWith('course_') && (admin || !financialAnswer(a.field)))
          .map((a) => ({
            label:
              legacy.applicant_questions?.find((q) => 'name' in q && q.name === a.field.slice(7))
                ?.label || a.field.slice(7),
            value: a.value,
          })),
      })
    if (!choices.length) return []
    const answer = (field: string) => s.submissionData?.find((a) => a.field === field)?.value || ''
    return [
      {
        id: s.id,
        name: answer('name'),
        email: answer('email'),
        submitted: s.createdAt,
        status: s.status || 'new',
        answers: (s.submissionData ?? [])
          .filter((a) => !a.field.startsWith('course_') && (admin || !financialAnswer(a.field)))
          .map((a) => ({
            label: forms.get(Number(relId(s.form)))?.get(a.field) || a.field,
            value: a.value,
          })),
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
