import { isAdminUser, personOf } from '@/access'
import { relId } from '@/lib/relation'
import { sql } from '@payloadcms/db-postgres'

import {
  APIError,
  commitTransaction,
  initTransaction,
  killTransaction,
  type PayloadHandler,
  type PayloadRequest,
} from 'payload'

import { env } from '@/env'
import { localeOf, type Locale } from '@/i18n/routing'
import { getEmailSettings } from '@/emails/settings'
import { acceptanceMail, rejectionMail } from '@/emails/transactional'
import { createPerson } from '@/lib/create-person'
import {
  createAccount,
  hasSignedIn,
  INVITATION_DAYS,
  recordInvitation,
  setPasswordLink,
} from '@/lib/invitation'
import type { FormSubmission } from '@/payload-types'
import { courseTitles } from './course-titles'
import { applicantOf, rolesAfterAccept } from './applicant'
import { deriveStatus } from './application-status'

type Kind = 'programmes' | 'courses' | 'cycles'
type Applicant = { name: string; email: string }
type Verdict = 'accepted' | 'rejected'

type Mail = {
  to: Applicant
  title: string
  kind: Verdict
  /** The language the applicant used on the form. */
  locale: Locale
}

/** What a decision leaves for the caller, once its transaction has committed. */
type Done = {
  /** When the submission or course was decided; null when a decision was undone. */
  decided: string | null
  mail: Mail | null
  /** The course the mail is about, or null for the whole submission. Its `email_failed` records the send. */
  scope: number | null
}

const local = (req: PayloadRequest) => ({ req, overrideAccess: true, depth: 0 }) as const

/**
 * Takes the submission's row lock for the rest of the transaction. Two
 * decisions on one application then run one after the other, and the second
 * reads what the first wrote.
 */
const load = async (req: PayloadRequest, id: number): Promise<FormSubmission> => {
  const { payload } = req
  const sessions = (
    payload.db as unknown as {
      sessions?: Record<string, { db: { execute: (query: unknown) => Promise<unknown> } }>
    }
  ).sessions
  const db = (req.transactionID && sessions?.[String(req.transactionID)]?.db) || null
  if (!db) throw new APIError('Could not lock the application. Try again.', 500)
  await db.execute(sql`select id from form_submissions where id = ${id} for update`)
  return payload.findByID({ collection: 'form-submissions', id, ...local(req) })
}

/** The account and person an acceptance gives the applicant. Made on the first acceptance, found after. */
const ensureAccount = async (req: PayloadRequest, applicant: Applicant, kind: Kind) => {
  const { payload } = req
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: applicant.email } },
    limit: 1,
    ...local(req),
  })
  const user = found.docs[0]
  if (!user) {
    // The acceptance email carries the link to set its password.
    const made = await createAccount(req, {
      email: applicant.email,
      name: applicant.name,
      roles: rolesAfterAccept([], kind),
    })
    return made
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
  return { user: user.id, person }
}

const enrollmentOf = async (req: PayloadRequest, person: number, course: number) =>
  (
    await req.payload.find({
      collection: 'enrollments',
      where: { and: [{ person: { equals: person } }, { course: { equals: course } }] },
      limit: 1,
      ...local(req),
    })
  ).docs[0]

/** The person an application's email belongs to, if the account exists. */
const personOfApplicant = async (req: PayloadRequest, applicant: Applicant) => {
  const user = (
    await req.payload.find({
      collection: 'users',
      where: { email: { equals: applicant.email } },
      limit: 1,
      ...local(req),
    })
  ).docs[0]
  return user ? personOf(user) : null
}

/**
 * The person's accepted enrollment in the course. An enrollment that waits,
 * was withdrawn or rejected is accepted again; one that is paid or done stays.
 */
const enrollAccepted = async (req: PayloadRequest, person: number, course: number) => {
  const enrollment = await enrollmentOf(req, person, course)
  if (enrollment && ['applied', 'withdrawn', 'rejected'].includes(enrollment.status)) {
    await req.payload.update({
      collection: 'enrollments',
      id: enrollment.id,
      data: { status: 'accepted' },
      ...local(req),
    })
  }
  const id =
    enrollment?.id ??
    (
      await req.payload.create({
        collection: 'enrollments',
        data: { person, course, status: 'accepted', source: 'registration_form' },
        ...local(req),
      })
    ).id
  return { enrollment: id, created: !enrollment }
}

/** Moves the applicant's enrollment when a course is rejected or the decision is undone. Paid or finished ones are never touched. */
const moveEnrollment = async (
  req: PayloadRequest,
  applicant: Applicant,
  course: number,
  from: string[],
  to: 'rejected' | 'applied',
) => {
  const person = await personOfApplicant(req, applicant)
  const enrollment = person === null ? undefined : await enrollmentOf(req, person, course)
  if (!enrollment) return
  if (['confirmed', 'completed'].includes(enrollment.status))
    throw new APIError(
      'This applicant has a confirmed enrollment in the course. Change it in Enrollments first.',
      400,
    )
  if (from.includes(enrollment.status)) {
    await req.payload.update({
      collection: 'enrollments',
      id: enrollment.id,
      data: { status: to },
      ...local(req),
    })
  }
}

const applicantOrThrow = (answers: Parameters<typeof applicantOf>[0]): Applicant => {
  const applicant = applicantOf(answers)
  if ('error' in applicant) throw new APIError(applicant.error, 400)
  return applicant
}

/** The submission's course choice. Programme and unknown courses are not found. */
const choiceOf = (submission: FormSubmission, course: number) => {
  const choices = submission.choices ?? []
  const choice = choices.find((c) => relId(c.course) === course)
  if (!submission.target || submission.target.relationTo === 'programmes' || !choice)
    throw new APIError('This application has no such course.', 404)
  return { choices, choice, kind: submission.target.relationTo }
}

const programmeOf = (submission: FormSubmission) => {
  if (submission.target?.relationTo !== 'programmes')
    throw new APIError('Decide each course of this application on its own.', 400)
  return relId(submission.target.value)!
}

/** The language of a submission's emails. Rows from before the field was added read as English. */
const mailLocale = (submission: FormSubmission): Locale => localeOf(submission.locale)

/** The title in the applicant's language, or the English one where there is no translation. */
const programmeTitle = async (req: PayloadRequest, id: number, locale: Locale) =>
  (
    await req.payload.findByID({
      collection: 'programmes',
      id,
      locale,
      fallbackLocale: 'en',
      ...local(req),
    })
  ).title

const courseTitle = async (req: PayloadRequest, id: number, locale: Locale) =>
  (await courseTitles(req, [id], locale)).get(id) ?? ''

/** Accepts a programme application as a whole: a membership. Course applications are decided per course. */
const acceptProgramme = async (req: PayloadRequest, id: number): Promise<Done | null> => {
  const { payload } = req
  const submission = await load(req, id)
  const programme = programmeOf(submission)
  if (submission.status === 'accepted') return null
  const applicant = applicantOrThrow(submission.submissionData)
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
  return {
    decided,
    scope: null,
    mail: {
      to: applicant,
      title: await programmeTitle(req, programme, mailLocale(submission)),
      kind: 'accepted',
      locale: mailLocale(submission),
    },
  }
}

const rejectProgramme = async (req: PayloadRequest, id: number): Promise<Done> => {
  const submission = await load(req, id)
  const programme = programmeOf(submission)
  if (submission.status !== 'new') throw new APIError('Only a new submission can be rejected.', 400)
  const applicant = applicantOrThrow(submission.submissionData)
  const decided = new Date().toISOString()
  await req.payload.update({
    collection: 'form-submissions',
    id,
    data: { status: 'rejected', decided_at: decided },
    ...local(req),
  })
  return {
    decided,
    scope: null,
    mail: {
      to: applicant,
      title: await programmeTitle(req, programme, mailLocale(submission)),
      kind: 'rejected',
      locale: mailLocale(submission),
    },
  }
}

/** A rejected programme application goes back to new. An accepted one has a membership: remove it in Memberships. */
const reopenProgramme = async (req: PayloadRequest, id: number): Promise<Done> => {
  const submission = await load(req, id)
  programmeOf(submission)
  if (submission.status !== 'rejected')
    throw new APIError('Only a rejected application can be reopened.', 400)
  await req.payload.update({
    collection: 'form-submissions',
    id,
    data: { status: 'new', decided_at: null, email_failed: false },
    ...local(req),
  })
  return { decided: null, mail: null, scope: null }
}

/**
 * Decides one course of an application. The first acceptance makes the
 * account; each one enrolls the applicant in that course. A rejection marks
 * the applicant's enrollment in it rejected. Either way the submission's
 * status follows from all its decisions (application-status.ts).
 */
const decideCourse = async (
  req: PayloadRequest,
  id: number,
  course: number,
  verdict: Verdict,
): Promise<Done> => {
  const { payload } = req
  const submission = await load(req, id)
  const { choices, choice, kind } = choiceOf(submission, course)
  if ((choice.decision ?? 'pending') !== 'pending')
    throw new APIError('This course already has a decision.', 400)
  const applicant = applicantOrThrow(submission.submissionData)

  const decided = new Date().toISOString()
  let result = {}
  if (verdict === 'accepted') {
    const account = await ensureAccount(req, applicant, kind)
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
  } else {
    await moveEnrollment(req, applicant, course, ['applied', 'accepted'], 'rejected')
  }
  const next = choices.map((c) =>
    c === choice ? { ...c, decision: verdict, decided_at: decided, email_failed: false } : c,
  )
  await payload.update({
    collection: 'form-submissions',
    id,
    data: { choices: next, ...deriveStatus(next), ...result },
    ...local(req),
  })
  return {
    decided,
    scope: course,
    mail: {
      to: applicant,
      title: await courseTitle(req, course, mailLocale(submission)),
      kind: verdict,
      locale: mailLocale(submission),
    },
  }
}

/** Undoes a course's decision: it waits again, and the applicant's enrollment goes back to applied. No email goes out. */
const reopenCourse = async (req: PayloadRequest, id: number, course: number): Promise<Done> => {
  const submission = await load(req, id)
  const { choices, choice } = choiceOf(submission, course)
  if ((choice.decision ?? 'pending') === 'pending')
    throw new APIError('This course has no decision to undo.', 400)
  const applicant = applicantOrThrow(submission.submissionData)
  await moveEnrollment(req, applicant, course, ['accepted', 'rejected'], 'applied')
  const next = choices.map((c) =>
    c === choice
      ? { ...c, decision: 'pending' as const, decided_at: null, email_failed: false }
      : c,
  )
  await req.payload.update({
    collection: 'form-submissions',
    id,
    data: { choices: next, ...deriveStatus(next) },
    ...local(req),
  })
  return { decided: null, mail: null, scope: course }
}

/** Builds the email again for a decision that is already made. */
const resendMail = async (
  req: PayloadRequest,
  id: number,
  course: number | null,
): Promise<Done> => {
  const submission = await req.payload.findByID({
    collection: 'form-submissions',
    id,
    ...local(req),
  })
  const applicant = applicantOrThrow(submission.submissionData)
  const verdict = course === null ? submission.status : choiceOf(submission, course).choice.decision
  if (verdict !== 'accepted' && verdict !== 'rejected')
    throw new APIError('There is no decision to send an email for.', 400)
  const title =
    course === null
      ? await programmeTitle(req, programmeOf(submission), mailLocale(submission))
      : await courseTitle(req, course, mailLocale(submission))
  return {
    decided: null,
    scope: course,
    mail: {
      to: applicant,
      title,
      kind: verdict,
      locale: mailLocale(submission),
    },
  }
}

/**
 * The decision email. An acceptance to an account that has not signed in yet
 * (made by this or an earlier acceptance) carries a fresh set-password link,
 * on the first send and on every send again.
 */
const sendMail = async (req: PayloadRequest, mail: Mail) => {
  const settings = await getEmailSettings(req.payload, req, mail.locale)
  if (mail.kind === 'rejected') {
    const message = await rejectionMail(settings, { ...mail.to, title: mail.title })
    await req.payload.sendEmail({ to: mail.to.email, ...message })
    return
  }
  const account = (
    await req.payload.find({
      collection: 'users',
      where: { email: { equals: mail.to.email } },
      limit: 1,
      ...local(req),
    })
  ).docs[0]
  const invitee = account && !hasSignedIn(account) ? { id: account.id, email: account.email } : null
  const message = await acceptanceMail(settings, {
    ...mail.to,
    title: mail.title,
    setPassword: invitee
      ? { url: await setPasswordLink(req, invitee, mail.locale), days: INVITATION_DAYS }
      : null,
    site: env.NEXT_PUBLIC_SERVER_URL,
  })
  await req.payload.sendEmail({ to: mail.to.email, ...message })
  if (invitee) await recordInvitation(req, invitee.id)
}

/** Records on the application whether its decision email went out, so the admin can see it and send it again. */
const recordSend = async (
  req: PayloadRequest,
  id: number,
  scope: number | null,
  failed: boolean,
) => {
  const { payload } = req
  if (scope === null) {
    await payload.update({
      collection: 'form-submissions',
      id,
      data: { email_failed: failed },
      overrideAccess: true,
      depth: 0,
    })
    return
  }
  const submission = await payload.findByID({
    collection: 'form-submissions',
    id,
    overrideAccess: true,
    depth: 0,
  })
  await payload.update({
    collection: 'form-submissions',
    id,
    data: {
      choices: (submission.choices ?? []).map((c) =>
        relId(c.course) === scope ? { ...c, email_failed: failed } : c,
      ),
    },
    overrideAccess: true,
    depth: 0,
  })
}

const decide =
  (run: (req: PayloadRequest) => Promise<Done | null>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id))
      return Response.json({ error: 'No such submission.' }, { status: 404 })
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
    if (!done) return Response.json({ ok: true, emailed: null, decided: null })
    // After the commit, so a failed send never undoes the decision.
    let emailed: boolean | null = null
    if (done.mail) {
      try {
        await sendMail(req, done.mail)
        emailed = true
      } catch (error) {
        emailed = false
        req.payload.logger.error({
          err: error,
          msg: `Email for a ${done.mail.kind} decision on submission ${id} failed`,
        })
      }
      await recordSend(req, id, done.scope, !emailed)
    }
    return Response.json({ ok: true, emailed, decided: done.decided })
  }

const param = (req: PayloadRequest, name: string) => {
  const value = Number(req.routeParams?.[name])
  if (!Number.isInteger(value)) throw new APIError('No such submission.', 404)
  return value
}

const endpoint = (path: string, run: (req: PayloadRequest) => Promise<Done | null>) => ({
  path,
  method: 'post' as const,
  handler: decide(run),
})

export const applicationEndpoints = [
  // A programme application is decided as a whole.
  endpoint('/:id/accept', (req) => acceptProgramme(req, param(req, 'id'))),
  endpoint('/:id/reject', (req) => rejectProgramme(req, param(req, 'id'))),
  endpoint('/:id/reopen', (req) => reopenProgramme(req, param(req, 'id'))),
  endpoint('/:id/resend', (req) => resendMail(req, param(req, 'id'), null)),
  // A course application is decided course by course.
  endpoint('/:id/courses/:course/accept', (req) =>
    decideCourse(req, param(req, 'id'), param(req, 'course'), 'accepted'),
  ),
  endpoint('/:id/courses/:course/reject', (req) =>
    decideCourse(req, param(req, 'id'), param(req, 'course'), 'rejected'),
  ),
  endpoint('/:id/courses/:course/reopen', (req) =>
    reopenCourse(req, param(req, 'id'), param(req, 'course')),
  ),
  endpoint('/:id/courses/:course/resend', (req) =>
    resendMail(req, param(req, 'id'), param(req, 'course')),
  ),
]
