import { APIError, type PayloadHandler, type PayloadRequest } from 'payload'

import { env } from '@/env'
import { fileAllowed, maxBytes, maxCount, type FileRule } from '@/lib/form-files'
import { relId } from '@/lib/relation'
import type { FormSubmission } from '@/payload-types'
import { checkTurnstile, TURNSTILE_VERIFIED } from '@/lib/turnstile'
import { PUBLIC_APPLICATION_SUBMISSION, validateApplication } from './application-validation'
import { choiceFileField, type ApplicationInput } from './application-input'

type FileQuestion = FileRule & { blockType: 'fileUpload'; name: string; required?: boolean | null }
type Sent = ApplicationInput & {
  form: number
  submissionData: Array<{ field: string; value: string }>
}
type FileAnswer = { key: string; question: FileQuestion; set: (value: string) => void }

const fail = (error: string, status = 400) => Response.json({ error }, { status })

const fileQuestionsOf = async (req: PayloadRequest, sent: Sent): Promise<FileAnswer[]> => {
  const local = { depth: 0, overrideAccess: true, req } as const
  const form = await req.payload.findByID({ collection: 'forms', id: sent.form, ...local })
  const shared = (form.fields ?? []).filter((q) => q.blockType === 'fileUpload') as FileQuestion[]
  const sharedAnswer = (key: string, question: FileQuestion): FileAnswer => ({
    key,
    question,
    set: (value) => {
      sent.submissionData = [
        ...sent.submissionData.filter((a) => a.field !== key),
        { field: key, value },
      ]
    },
  })
  const questions = shared.map((q) => sharedAnswer(q.name, q))
  for (const choice of sent.choices ?? []) {
    const id = relId(choice?.course)
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
      throw new APIError('Choose a valid course and try submitting again.', 400)
    const course = await req.payload.findByID({
      collection: 'courses',
      id,
      disableErrors: true,
      ...local,
    })
    if (!course)
      throw new APIError(
        'One of your chosen courses is no longer available. Choose courses again.',
        400,
      )
    for (const question of course.applicant_questions ?? []) {
      if (question.blockType !== 'fileUpload') continue
      questions.push({
        key: choiceFileField(course.id, question.name),
        question,
        set: (value) => {
          choice.answers = [
            ...(choice.answers ?? []).filter((a) => a.name !== question.name),
            { name: question.name, value },
          ]
        },
      })
    }
  }
  return questions
}

export const submitWithFiles: PayloadHandler = async (req) => {
  if (!(await checkTurnstile(req, env.TURNSTILE_SECRET_KEY))) {
    return fail('The spam check failed. Reload the page and try again.', 403)
  }
  const data = await (req as unknown as Request).formData().catch(() => null)
  const sent = (() => {
    try {
      return JSON.parse(String(data?.get('payload') ?? '')) as Sent
    } catch {
      return null
    }
  })()
  if (
    !data ||
    !sent?.form ||
    !Array.isArray(sent.submissionData) ||
    (sent.choices != null && !Array.isArray(sent.choices))
  )
    return fail('The form could not be read.')

  const stored: number[] = []
  try {
    const questions = await fileQuestionsOf(req, sent)
    const files = new Map<string, File[]>()
    for (const [key, value] of data.entries()) {
      if (!key.startsWith('file:') || typeof value === 'string') continue
      const name = key.slice(5)
      files.set(name, [...(files.get(name) ?? []), value])
    }
    for (const name of files.keys()) {
      if (!questions.some((q) => q.key === name)) return fail(`No question “${name}” takes files.`)
    }
    for (const { key, question, set } of questions) {
      const sentFiles = files.get(key) ?? []
      if (question.required && !sentFiles.length) return fail(`“${question.name}” needs a file.`)
      if (sentFiles.length > maxCount(question))
        return fail(`Too many files for “${question.name}”.`)
      for (const f of sentFiles) {
        if (f.size > maxBytes(question)) return fail(`“${f.name}” is too large.`)
        if (!fileAllowed(question, f))
          return fail(`“${f.name}” is not a kind of file this question takes.`)
      }
      // Validate required answers before storing anything; client download links are never trusted.
      set(sentFiles.length ? 'pending upload' : '')
    }
    await validateApplication(req, sent)
    for (const { key, set } of questions) {
      const links: string[] = []
      for (const f of files.get(key) ?? []) {
        const doc = await req.payload.create({
          collection: 'submission-files',
          data: { field: key },
          file: {
            data: Buffer.from(await f.arrayBuffer()),
            mimetype: f.type,
            name: f.name,
            size: f.size,
          },
          overrideAccess: true,
          req,
        })
        stored.push(doc.id)
        links.push(`${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}${doc.url}`)
      }
      set(links.join('\n'))
    }
    await req.payload.create({
      collection: 'form-submissions',
      data: {
        form: sent.form,
        target: sent.target as FormSubmission['target'],
        choices: sent.choices,
        submissionData: sent.submissionData,
      },
      context: { [TURNSTILE_VERIFIED]: true, [PUBLIC_APPLICATION_SUBMISSION]: true },
      req,
    })
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    for (const id of stored) {
      await req.payload
        .delete({ collection: 'submission-files', id, overrideAccess: true, req })
        .catch((cleanupError) =>
          req.payload.logger.error({
            err: cleanupError,
            msg: `Could not remove submission file ${id}`,
          }),
        )
    }
    if (error instanceof APIError) return fail(error.message, error.status)
    req.payload.logger.error({ err: error, msg: 'A form submission with files failed' })
    return fail('The form could not be sent. Your answers are still here; please try again.', 500)
  }
}
