import 'server-only'
import type { Payload, TypedUser, Where } from 'payload'
import { isAdminUser, isFellowUser, personOf } from '@/access'
import { relId } from '@/lib/relation'

import { mediaImage, mediaPopulate } from '@/lib/media-image'
import { courseRegistration } from '@/lib/registration'
import type { User } from '@/payload-types'
import { deriveStatus, type ChoiceDecision } from './application-status'

export type ApplicantViewer = { kind: 'admin' } | { kind: 'fellow'; person: number }

export function applicantViewer(user?: TypedUser | User | null): ApplicantViewer | null {
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

/** The courses a viewer reviews applicants for: an admin all of them, a fellow the courses they teach. */
const viewerCoursesWhere = (viewer: ApplicantViewer): Where | undefined =>
  viewer.kind === 'fellow' ? { fellows: { contains: viewer.person } } : undefined

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
      where: viewerCoursesWhere(viewer),
    })
  ).docs
  const ids = courses.map((c) => c.id)
  // An admin also reviews programme applications, which have no courses.
  if (!ids.length && !admin) return { courses: [], applications: [] }
  const own = new Map(courses.map((c) => [c.id, c]))
  const submissions = (
    await payload.find({
      collection: 'form-submissions',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      sort: '-createdAt',
      where: admin
        ? {
            or: [
              ...(ids.length ? [{ 'choices.course': { in: ids } }] : []),
              { 'target.relationTo': { equals: 'programmes' } },
            ],
          }
        : { 'choices.course': { in: ids } },
    })
  ).docs
  const programmeIds = [
    ...new Set(
      submissions.flatMap((s) =>
        s.target?.relationTo === 'programmes' ? [Number(relId(s.target.value))] : [],
      ),
    ),
  ]
  const programmes = new Map(
    (programmeIds.length
      ? (
          await payload.find({
            collection: 'programmes',
            overrideAccess: true,
            depth: 1,
            populate: { media: mediaPopulate },
            pagination: false,
            where: { id: { in: programmeIds } },
            locale,
          })
        ).docs
      : []
    ).map((p) => [p.id, p]),
  )
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
          decision: (c.decision ?? 'pending') as ChoiceDecision,
          decided: c.decided_at ?? null,
          emailFailed: c.email_failed === true,
          cover: mediaImage(typeof course.cover_image === 'object' ? course.cover_image : null),
          cycle: cycle ? { id: cycle.id, title: cycle.title } : null,
          fields: withRetired(course.applicant_questions ?? [], answers),
          answers,
          // Contributions are for admins: a fellow's view has no amounts to show.
          contribution: admin ? courseRegistration(course, cycle).price : null,
          ...(admin ? { amount: c.amount, need_reduction: c.need_reduction } : {}),
        }
      })
    const programme =
      s.target?.relationTo === 'programmes' ? programmes.get(Number(relId(s.target.value))) : null
    if (!choices.length && !programme) return []
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
        // A fellow sees only their courses, so their status follows those decisions.
        ...(admin
          ? { status: s.status || 'new', decided: s.decided_at ?? null }
          : (() => {
              const own = deriveStatus(
                choices.map((c) => ({ decision: c.decision, decided_at: c.decided })),
              )
              return { status: own.status, decided: own.decided_at }
            })()),
        target: s.target?.relationTo ?? null,
        /** A programme application is decided as a whole: its decision is the application's. */
        programme: programme
          ? {
              id: programme.id,
              title: programme.title,
              cover: mediaImage(typeof programme.cover === 'object' ? programme.cover : null),
              decision: (s.status === 'new' || !s.status ? 'pending' : s.status) as ChoiceDecision,
              decided: s.decided_at ?? null,
              emailFailed: s.email_failed === true,
            }
          : null,
        formId: Number(relId(s.form)),
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

export type WaitingChoice = { submission: number; course: number }

/**
 * The choices that wait on a decision, in the courses the viewer reviews: an admin every
 * course, a fellow the courses they teach. The count is the length of this list, so a
 * test can read the same rule for its own rows.
 */
export async function waitingApplicantChoices(
  payload: Payload,
  user: TypedUser | User | null | undefined,
): Promise<WaitingChoice[]> {
  const viewer = applicantViewer(user)
  if (!viewer) return []
  // A choice's foreign key already limits admins to courses that exist. Only fellows need an ID list.
  let courseIds: Set<number> | null = null
  if (viewer.kind === 'fellow') {
    const { docs: courses } = await payload.find({
      collection: 'courses',
      where: viewerCoursesWhere(viewer),
      select: {}, // the id only
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    courseIds = new Set(courses.map((course) => course.id))
    if (courseIds.size === 0) return []
  }
  const { docs } = await payload.find({
    collection: 'form-submissions',
    where: {
      and: [
        { 'choices.course': courseIds ? { in: [...courseIds] } : { exists: true } },
        {
          or: [
            { 'choices.decision': { equals: 'pending' } },
            { 'choices.decision': { exists: false } },
          ],
        },
      ],
    },
    select: { choices: { course: true, decision: true } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs.flatMap((submission) =>
    (submission.choices ?? []).flatMap((choice) => {
      const course = relId(choice.course)
      const waits = !choice.decision || choice.decision === 'pending'
      return course != null && waits && (courseIds === null || courseIds.has(Number(course)))
        ? [{ submission: submission.id, course: Number(course) }]
        : []
    }),
  )
}

/**
 * Count the viewer's course choices with no decision or a pending decision.
 * A programme application contributes zero. Return only the total for the Inbox and nav.
 */
export async function countWaitingApplicants(
  payload: Payload,
  user: TypedUser | User | null | undefined,
): Promise<{ total: number; courses: number[] }> {
  const waiting = await waitingApplicantChoices(payload, user)
  return { total: waiting.length, courses: [...new Set(waiting.map((choice) => choice.course))] }
}

export type ApplicantsData = Awaited<ReturnType<typeof applicantsFor>>
export type Applicant = ApplicantsData['applications'][number]
