import { randomBytes } from 'node:crypto'

import {
  APIError,
  commitTransaction,
  initTransaction,
  killTransaction,
  type CollectionBeforeChangeHook,
  type Field,
  type FieldAccess,
  type PayloadHandler,
  type PayloadRequest,
} from 'payload'

import { isAdminUser, personOf, type Role } from '@/access'
import { env } from '@/env'
import { getEmailSettings } from '@/emails/settings'
import { acceptanceMail } from '@/emails/transactional'
import { slugify } from '@/lib/slugify'
import { registrationStatus } from '@/lib/registration'
import type { FormSubmission } from '@/payload-types'

/**
 * Applications: form submissions for a programme or a course. An admin
 * accepts one from the submission, which finds or makes the applicant's
 * account and person, and gives them a membership (programme) or an
 * enrollment (course).
 */

export type TargetKind = 'programmes' | 'courses'

const isAdminField: FieldAccess = ({ req }) => isAdminUser(req.user)

export const applicationFields: Field[] = [
  {
    // Set by the apply page; checked against the target's form on create.
    name: 'target',
    type: 'relationship',
    relationTo: ['programmes', 'courses'],
    index: true,
    access: { update: isAdminField },
    admin: { position: 'sidebar', readOnly: true, description: 'What the applicant applied to.' },
  },
  {
    name: 'status',
    type: 'select',
    defaultValue: 'new',
    index: true,
    options: [
      { label: 'New', value: 'new' },
      { label: 'Accepted', value: 'accepted' },
      { label: 'Rejected', value: 'rejected' },
    ],
    access: { create: isAdminField, update: isAdminField },
    admin: { position: 'sidebar', readOnly: true },
  },
  {
    name: 'decision',
    type: 'ui',
    admin: {
      position: 'sidebar',
      components: { Field: '/components/admin/submission-decision#SubmissionDecision' },
    },
  },
  {
    name: 'decided_at',
    type: 'date',
    access: { create: isAdminField, update: isAdminField },
    admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
  },
  {
    // What accepting made or found.
    name: 'result',
    type: 'group',
    access: { create: isAdminField, update: isAdminField },
    admin: { position: 'sidebar', readOnly: true },
    fields: [
      { name: 'user', type: 'relationship', relationTo: 'users' },
      { name: 'person', type: 'relationship', relationTo: 'people' },
      { name: 'membership', type: 'relationship', relationTo: 'memberships' },
      { name: 'enrollment', type: 'relationship', relationTo: 'enrollments' },
    ],
  },
]

const idOf = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  const id = (value as { id?: unknown } | null)?.id
  return typeof id === 'number' ? id : null
}

/** A submission names a target only when that target registers through this form. */
export const checkTarget: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data.target) return data
  const { relationTo, value } = data.target as { relationTo: TargetKind; value: unknown }
  const id = idOf(value)
  const target =
    id === null
      ? null
      : await req.payload
          .findByID({ collection: relationTo, id, depth: 1, overrideAccess: true, req })
          .catch(() => null)
  // A course without its own form uses its cycle's.
  const cycle =
    target && 'cycle' in target && typeof target.cycle === 'object' ? target.cycle : null
  const form = target?.registration?.form ?? cycle?.registration?.form
  if (!target || idOf(form) !== idOf(data.form)) {
    throw new APIError('This form is not the registration form of what it names.', 400)
  }
  // The page hides the button at the deadline; this repeats the rule where
  // the API cannot skip it. Local callers (seeds, backfills) may still add
  // one, the way they may add a historic submission at all.
  if (
    req.payloadAPI !== 'local' &&
    registrationStatus(target.registration, cycle?.registration) !== 'open'
  ) {
    throw new APIError('This is not open for applications.', 400)
  }
  return data
}

/** The roles an account gets for an acceptance. Existing roles stay. */
export const rolesAfterAccept = (roles: Role[], kind: TargetKind): Role[] => {
  if (kind === 'programmes') return roles.includes('member') ? roles : [...roles, 'member']
  const student = roles.includes('member') || roles.includes('non_degree_seeking')
  return student ? roles : [...roles, 'non_degree_seeking']
}

/** The applicant's name and email, from the form's `name` and `email` fields. */
export const applicantOf = (
  answers: FormSubmission['submissionData'],
): { name: string; email: string } | { error: string } => {
  const answer = (field: string) => answers?.find((a) => a.field === field)?.value?.trim() ?? ''
  const name = answer('name')
  const email = answer('email').toLowerCase()
  if (!name) return { error: 'The submission has no "name" answer.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'The submission has no valid "email" answer.' }
  }
  return { name, email }
}

type Accepted = {
  user: number
  person: number
  membership?: number
  enrollment?: number
  /** For the email, sent once the transaction commits. */
  mail: { name: string; email: string; title: string; newAccount: boolean; site: string }
}

const accept = async (req: PayloadRequest, id: number): Promise<Accepted | null> => {
  const { payload } = req
  const local = { req, overrideAccess: true, depth: 0 } as const
  const submission = await payload.findByID({ collection: 'form-submissions', id, ...local })
  if (submission.status === 'accepted') return null
  if (!submission.target)
    throw new APIError('This submission is not for a programme or a course.', 400)
  const applicant = applicantOf(submission.submissionData)
  if ('error' in applicant) throw new APIError(applicant.error, 400)

  const kind = submission.target.relationTo
  const targetId = idOf(submission.target.value)!

  // The account: matched by email, never by name.
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: applicant.email } },
    limit: 1,
    ...local,
  })
  let user = found.docs[0]
  const newAccount = !user
  let result: Omit<Accepted, 'mail'>
  // The person: the account's own, or a new hidden one named from the
  // application. The name comes from the answer, not the email — the Users
  // hook would name one from the email, so it is created here first, linked
  // into the same write.
  const createPerson = async () => {
    const created = await payload.create({
      collection: 'people',
      // A hidden person has no page, so a unique slug is enough.
      data: {
        name: applicant.name,
        slug: `${slugify(applicant.name) || 'applicant'}-${randomBytes(3).toString('hex')}`,
        visible: false,
      },
      ...local,
    })
    return created.id
  }
  if (!user) {
    const personId = await createPerson()
    user = await payload.create({
      collection: 'users',
      data: {
        email: applicant.email,
        // Nobody knows it: they sign in with Google or set one by reset.
        password: randomBytes(24).toString('base64url'),
        roles: rolesAfterAccept([], kind),
        person: personId,
      },
      ...local,
    })
    result = { user: user.id, person: personId }
  } else {
    let personId = personOf(user)
    if (personId === null) {
      personId = await createPerson()
      await payload.update({ collection: 'users', id: user.id, data: { person: personId }, ...local })
    }
    result = { user: user.id, person: personId }
    const roles = rolesAfterAccept(user.roles, kind)
    if (roles.length !== user.roles.length) {
      user = await payload.update({ collection: 'users', id: user.id, data: { roles }, ...local })
    }
  }
  if (kind === 'programmes') {
    const { docs } = await payload.find({
      collection: 'memberships',
      where: { and: [{ person: { equals: result.person } }, { programme: { equals: targetId } }] },
      limit: 1,
      ...local,
    })
    result.membership =
      docs[0]?.id ??
      (
        await payload.create({
          collection: 'memberships',
          data: { person: result.person, programme: targetId, role: 'student' },
          ...local,
        })
      ).id
  } else {
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { and: [{ person: { equals: result.person } }, { course: { equals: targetId } }] },
      limit: 1,
      ...local,
    })
    const enrollment = docs[0]
    if (enrollment?.status === 'applied') {
      await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        data: { status: 'accepted' },
        ...local,
      })
    }
    result.enrollment =
      enrollment?.id ??
      (
        await payload.create({
          collection: 'enrollments',
          data: { person: result.person, course: targetId, status: 'accepted', source: 'registration_form' },
          ...local,
        })
      ).id
  }

  await payload.update({
    collection: 'form-submissions',
    id,
    data: { status: 'accepted', decided_at: new Date().toISOString(), result },
    ...local,
  })

  // All mail is in English.
  const target = await payload.findByID({ collection: kind, id: targetId, locale: 'en', ...local })
  return {
    ...result,
    mail: { ...applicant, title: target.title ?? '', newAccount, site: env.NEXT_PUBLIC_SERVER_URL },
  }
}

const reject = async (req: PayloadRequest, id: number): Promise<null> => {
  const local = { req, overrideAccess: true, depth: 0 } as const
  const submission = await req.payload.findByID({ collection: 'form-submissions', id, ...local })
  if (submission.status !== 'new') throw new APIError('Only a new submission can be rejected.', 400)
  await req.payload.update({
    collection: 'form-submissions',
    id,
    data: { status: 'rejected', decided_at: new Date().toISOString() },
    ...local,
  })
  return null
}

/** One decision in one transaction: everything is made, or nothing is. */
const decide =
  (run: (req: PayloadRequest, id: number) => Promise<Accepted | null>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id))
      return Response.json({ error: 'No such submission.' }, { status: 404 })
    const owns = await initTransaction(req)
    let done: Accepted | null
    try {
      done = await run(req, id)
      if (owns) await commitTransaction(req)
    } catch (error) {
      if (owns) await killTransaction(req)
      if (error instanceof APIError)
        return Response.json({ error: error.message }, { status: error.status })
      throw error
    }
    // After the commit, so a failed send never undoes the acceptance.
    let emailed = false
    if (done) {
      try {
        const mail = await acceptanceMail(await getEmailSettings(req.payload, req), done.mail)
        await req.payload.sendEmail({ to: done.mail.email, ...mail })
        emailed = true
      } catch (error) {
        req.payload.logger.error({
          err: error,
          msg: `Acceptance email for submission ${id} failed`,
        })
      }
    }
    return Response.json({ ok: true, emailed })
  }

export const applicationEndpoints = [
  { path: '/:id/accept', method: 'post' as const, handler: decide(accept) },
  { path: '/:id/reject', method: 'post' as const, handler: decide(reject) },
]
