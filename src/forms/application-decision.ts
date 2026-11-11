import { isAdminUser, personOf } from '@/access'
import { relId } from '@/lib/relation'
import { randomBytes } from 'node:crypto'

import {
  APIError,
  commitTransaction,
  initTransaction,
  killTransaction,
  type PayloadHandler,
  type PayloadRequest,
} from 'payload'

import { env } from '@/env'
import { getEmailSettings } from '@/emails/settings'
import { acceptanceMail, rejectionMail } from '@/emails/transactional'
import { createPerson } from '@/lib/create-person'
import { courseTitles } from './course-titles'
import { applicantOf, rolesAfterAccept } from './applicant'
import { deriveStatus } from './application-status'

type Kind = 'programmes' | 'courses' | 'cycles'
type Applicant = { name: string; email: string }

/** What a decision leaves for the caller, once its transaction has committed. */
type Done = {
  /** When the submission or course was decided. */
  decided: string
  mail: {
    to: Applicant
    title: string
    kind: 'accepted' | 'rejected'
    newAccount: boolean
  } | null
}

const local = (req: PayloadRequest) => ({ req, overrideAccess: true, depth: 0 }) as const

/** The account and person an acceptance gives the applicant. Made on the first acceptance, found after. */
const ensureAccount = async (req: PayloadRequest, applicant: Applicant, kind: Kind) => {
  const { payload } = req
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: applicant.email } },
    limit: 1,
    ...local(req),
  })
  let user = found.docs[0]
  if (!user) {
    const person = await createPerson(req, applicant.name)
    user = await payload.create({
      collection: 'users',
      data: {
        email: applicant.email,
        // Nobody knows it: they sign in with Google or set one by reset.
        password: randomBytes(24).toString('base64url'),
        roles: rolesAfterAccept([], kind),
        person,
      },
      ...local(req),
    })
    return { user: user.id, person, newAccount: true }
  }
  let person = personOf(user)
  if (person === null) {
    person = await createPerson(req, applicant.name)
    await payload.update({ collection: 'users', id: user.id, data: { person }, ...local(req) })
  }
  const roles = rolesAfterAccept(user.roles, kind)
  if (roles.length !== user.roles.length) {
    await payload.update({ collection: 'users', id: user.id, data: { roles }, ...local(req) })
  }
  return { user: user.id, person, newAccount: false }
}

/** The person's accepted enrollment in the course: an applied one is accepted, a missing one is made. */
const enrollAccepted = async (req: PayloadRequest, person: number, course: number) => {
  const { payload } = req
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ person: { equals: person } }, { course: { equals: course } }] },
    limit: 1,
    ...local(req),
  })
  const enrollment = docs[0]
  if (enrollment?.status === 'applied') {
    await payload.update({
      collection: 'enrollments',
      id: enrollment.id,
      data: { status: 'accepted' },
      ...local(req),
    })
  }
  const id =
    enrollment?.id ??
    (
      await payload.create({
        collection: 'enrollments',
        data: { person, course, status: 'accepted', source: 'registration_form' },
        ...local(req),
      })
    ).id
  return { enrollment: id, created: !enrollment }
}

const applicantOrThrow = (answers: Parameters<typeof applicantOf>[0]): Applicant => {
  const applicant = applicantOf(answers)
  if ('error' in applicant) throw new APIError(applicant.error, 400)
  return applicant
}

/** Accepts a programme application as a whole: a membership. Course applications are decided per course. */
const acceptProgramme = async (req: PayloadRequest, id: number): Promise<Done | null> => {
  const { payload } = req
  const submission = await payload.findByID({ collection: 'form-submissions', id, ...local(req) })
  if (submission.status === 'accepted') return null
  if (submission.target?.relationTo !== 'programmes')
    throw new APIError('Decide each course of this application on its own.', 400)
  const applicant = applicantOrThrow(submission.submissionData)
  const programme = relId(submission.target.value)!
  const account = await ensureAccount(req, applicant, 'programmes')
  const { docs } = await payload.find({
    collection: 'memberships',
    where: { and: [{ person: { equals: account.person } }, { programme: { equals: programme } }] },
    limit: 1,
    ...local(req),
  })
  const membership =
    docs[0]?.id ??
    (
      await payload.create({
        collection: 'memberships',
        data: { person: account.person, programme, role: 'student' },
        ...local(req),
      })
    ).id
  const decided = new Date().toISOString()
  await payload.update({
    collection: 'form-submissions',
    id,
    data: {
      status: 'accepted',
      decided_at: decided,
      result: { user: account.user, person: account.person, membership },
    },
    ...local(req),
  })
  const { title } = await payload.findByID({
    collection: 'programmes',
    id: programme,
    locale: 'en',
    ...local(req),
  })
  return {
    decided,
    mail: { to: applicant, title, kind: 'accepted', newAccount: account.newAccount },
  }
}

const rejectProgramme = async (req: PayloadRequest, id: number): Promise<Done> => {
  const submission = await req.payload.findByID({
    collection: 'form-submissions',
    id,
    ...local(req),
  })
  if (submission.status !== 'new') throw new APIError('Only a new submission can be rejected.', 400)
  if (submission.target?.relationTo !== 'programmes')
    throw new APIError('Decide each course of this application on its own.', 400)
  const decided = new Date().toISOString()
  await req.payload.update({
    collection: 'form-submissions',
    id,
    data: { status: 'rejected', decided_at: decided },
    ...local(req),
  })
  return { decided, mail: null }
}

/**
 * Decides one course of an application. The first acceptance makes the
 * account; each one enrolls the applicant in that course. A rejection only
 * records the decision (an enrollment has no rejected status). Either way the
 * submission's status follows from all its decisions (application-status.ts).
 */
const decideCourse = async (
  req: PayloadRequest,
  id: number,
  course: number,
  verdict: 'accepted' | 'rejected',
): Promise<Done> => {
  const { payload } = req
  const submission = await payload.findByID({ collection: 'form-submissions', id, ...local(req) })
  const choices = submission.choices ?? []
  const choice = choices.find((c) => relId(c.course) === course)
  if (!submission.target || submission.target.relationTo === 'programmes' || !choice)
    throw new APIError('This application has no such course.', 404)
  if ((choice.decision ?? 'pending') !== 'pending')
    throw new APIError('This course already has a decision.', 400)
  const applicant = applicantOrThrow(submission.submissionData)

  const decided = new Date().toISOString()
  let result = {}
  let newAccount = false
  if (verdict === 'accepted') {
    const account = await ensureAccount(req, applicant, submission.target.relationTo)
    newAccount = account.newAccount
    const outcome = await enrollAccepted(req, account.person, course)
    const prior = submission.result
    result = {
      result: {
        user: account.user,
        person: account.person,
        membership: relId(prior?.membership) ?? undefined,
        enrollments: [
          ...new Set([...(prior?.enrollments ?? []).map((e) => relId(e)!), outcome.enrollment]),
        ],
        enrollment_outcomes: [
          ...(prior?.enrollment_outcomes ?? []).map((o) => ({
            enrollment: relId(o.enrollment)!,
            created: o.created ?? false,
          })),
          outcome,
        ],
      },
    }
  }
  const next = choices.map((c) =>
    c === choice ? { ...c, decision: verdict, decided_at: decided } : c,
  )
  await payload.update({
    collection: 'form-submissions',
    id,
    data: { choices: next, ...deriveStatus(next), ...result },
    ...local(req),
  })
  const title = (await courseTitles(req, [course], 'en')).get(course) ?? ''
  return { decided, mail: { to: applicant, title, kind: verdict, newAccount } }
}

const decide =
  (run: (req: PayloadRequest) => Promise<Done | null>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const owns = await initTransaction(req)
    let done: Done | null
    try {
      done = await run(req)
      if (owns) await commitTransaction(req)
    } catch (error) {
      if (owns) await killTransaction(req)
      if (error instanceof APIError)
        return Response.json({ error: error.message }, { status: error.status })
      throw error
    }
    if (!done) return Response.json({ ok: true, emailed: null })
    // After the commit, so a failed send never undoes the decision.
    let emailed: boolean | null = null
    const { mail } = done
    if (mail) {
      try {
        const settings = await getEmailSettings(req.payload, req)
        const message =
          mail.kind === 'accepted'
            ? await acceptanceMail(settings, {
                ...mail.to,
                title: mail.title,
                newAccount: mail.newAccount,
                site: env.NEXT_PUBLIC_SERVER_URL,
              })
            : await rejectionMail(settings, { ...mail.to, title: mail.title })
        await req.payload.sendEmail({ to: mail.to.email, ...message })
        emailed = true
      } catch (error) {
        emailed = false
        req.payload.logger.error({
          err: error,
          msg: `Email for a ${mail.kind} decision on submission ${req.routeParams?.id} failed`,
        })
      }
    }
    return Response.json({ ok: true, emailed, decided: done.decided })
  }

const param = (req: PayloadRequest, name: string) => {
  const value = Number(req.routeParams?.[name])
  if (!Number.isInteger(value)) throw new APIError('No such submission.', 404)
  return value
}

export const applicationEndpoints = [
  {
    path: '/:id/accept',
    method: 'post' as const,
    handler: decide((req) => acceptProgramme(req, param(req, 'id'))),
  },
  {
    path: '/:id/reject',
    method: 'post' as const,
    handler: decide((req) => rejectProgramme(req, param(req, 'id'))),
  },
  {
    path: '/:id/courses/:course/accept',
    method: 'post' as const,
    handler: decide((req) => decideCourse(req, param(req, 'id'), param(req, 'course'), 'accepted')),
  },
  {
    path: '/:id/courses/:course/reject',
    method: 'post' as const,
    handler: decide((req) => decideCourse(req, param(req, 'id'), param(req, 'course'), 'rejected')),
  },
]
