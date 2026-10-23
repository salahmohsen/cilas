import type { PayloadHandler, PayloadRequest } from 'payload'

import { SUBMISSION_FILE_LIMIT } from '@/collections/SubmissionFiles'
import { env } from '@/env'
import { fileAllowed, maxBytes, maxCount, type FileRule } from '@/lib/form-files'
import { registrationStatus } from '@/lib/registration'
import { TURNSTILE_HEADER, verifyTurnstile } from '@/lib/turnstile'

/** Set on the submission this endpoint makes, whose Turnstile token it has already spent. */
export const TURNSTILE_VERIFIED = 'turnstileVerified'

type FileQuestion = FileRule & { blockType: 'fileUpload'; name: string; required?: boolean | null }
type Sent = {
  form: number
  target?: { relationTo: 'courses' | 'programmes'; value: number }
  submissionData: Array<{ field: string; value: string }>
}

const fail = (error: string, status = 400) => Response.json({ error }, { status })

/** The file questions a submission may answer: the form's, then a course's own, prefixed. */
const fileQuestionsOf = async (req: PayloadRequest, sent: Sent): Promise<FileQuestion[]> => {
  const local = { depth: 0, overrideAccess: true } as const
  const form = await req.payload
    .findByID({ collection: 'forms', id: sent.form, ...local })
    .catch(() => null)
  if (!form) return []
  const own = (form.fields ?? []).filter(
    (b) => b.blockType === 'fileUpload',
  ) as unknown as FileQuestion[]
  if (sent.target?.relationTo !== 'courses') return own
  const course = await req.payload
    .findByID({ collection: 'courses', id: sent.target.value, ...local })
    .catch(() => null)
  const extra = ((course?.applicant_questions ?? []) as unknown as FileQuestion[])
    .filter((q) => q.blockType === 'fileUpload')
    .map((q) => ({ ...q, name: `course_${q.name}` }))
  return [...own, ...extra]
}

/**
 * A form submission with files, in one multipart request: the Turnstile
 * check runs once (a token passes only once, so files cannot go ahead on
 * their own), each file is checked against its question (kind, size, how
 * many), stored privately, and the answer becomes its download links. If
 * anything fails, the stored files are removed again.
 */
export const submitWithFiles: PayloadHandler = async (req) => {
  const secret = env.TURNSTILE_SECRET_KEY
  if (secret) {
    const token = req.headers.get(TURNSTILE_HEADER)
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (!token || !(await verifyTurnstile(token, secret, ip))) {
      return fail('The spam check failed. Reload the page and try again.', 403)
    }
  }

  const data = await (req as unknown as Request).formData().catch(() => null)
  const sent = (() => {
    try {
      return JSON.parse(String(data?.get('payload') ?? '')) as Sent
    } catch {
      return null
    }
  })()
  if (!data || !sent?.form || !Array.isArray(sent.submissionData))
    return fail('The form could not be read.')

  // The same closed-registration rule the plain submissions' hook applies.
  // This endpoint writes through the Local API, which that hook skips, so
  // the rule repeats here, and before any file row exists to clean up.
  if (sent.target) {
    const target = await req.payload
      .findByID({
        collection: sent.target.relationTo,
        id: sent.target.value,
        depth: 1,
        overrideAccess: true,
      })
      .catch(() => null)
    const cycle =
      target && 'cycle' in target && typeof target.cycle === 'object' ? target.cycle : null
    if (target && registrationStatus(target.registration, cycle?.registration) !== 'open') {
      return fail('Applications are closed.')
    }
  }

  const questions = await fileQuestionsOf(req, sent)
  const files = new Map<string, File[]>()
  for (const [key, value] of data.entries()) {
    if (!key.startsWith('file:') || typeof value === 'string') continue
    const name = key.slice(5)
    files.set(name, [...(files.get(name) ?? []), value])
  }
  for (const name of files.keys()) {
    if (!questions.some((q) => q.name === name)) return fail(`No question “${name}” takes files.`)
  }
  for (const q of questions) {
    const sentFiles = files.get(q.name) ?? []
    if (q.required && !sentFiles.length) return fail(`“${q.name}” needs a file.`)
    if (sentFiles.length > maxCount(q)) return fail(`Too many files for “${q.name}”.`)
    for (const f of sentFiles) {
      if (f.size > Math.min(maxBytes(q), SUBMISSION_FILE_LIMIT))
        return fail(`“${f.name}” is too large.`)
      if (!fileAllowed(q, f)) return fail(`“${f.name}” is not a kind of file this question takes.`)
    }
  }

  const stored: number[] = []
  try {
    const links = new Map<string, string[]>()
    for (const [name, list] of files) {
      for (const f of list) {
        const doc = await req.payload.create({
          collection: 'submission-files',
          data: { field: name },
          file: {
            data: Buffer.from(await f.arrayBuffer()),
            mimetype: f.type,
            name: f.name,
            size: f.size,
          },
          overrideAccess: true,
        })
        stored.push(doc.id)
        const url = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}${doc.url}`
        links.set(name, [...(links.get(name) ?? []), url])
      }
    }
    const submissionData = sent.submissionData.map((a) =>
      links.has(a.field) ? { field: a.field, value: links.get(a.field)!.join('\n') } : a,
    )
    await req.payload.create({
      collection: 'form-submissions',
      data: { form: sent.form, target: sent.target, submissionData },
      context: { [TURNSTILE_VERIFIED]: true },
    })
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    for (const id of stored) {
      await req.payload
        .delete({ collection: 'submission-files', id, overrideAccess: true })
        .catch(() => {})
    }
    req.payload.logger.error({ err: error, msg: 'A form submission with files failed' })
    return fail((error as Error).message || 'The form could not be sent.', 500)
  }
}
