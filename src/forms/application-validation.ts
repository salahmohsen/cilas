import { isValidPhoneNumber, PHONE_NUMBER_ERROR } from '@/lib/phone'
import type { CollectionBeforeChangeHook } from 'payload'
import { courseRegistration } from '@/lib/registration'
import { loadApplicationTarget } from './application-target'
import type { Reader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import type { Course, Cycle } from '@/payload-types'
import { APIError, type PayloadRequest } from 'payload'
import type { ApplicationChoice, ApplicationInput } from './application-input'
import { isOpenCourseInCycle } from './open-courses'

export const PUBLIC_APPLICATION_SUBMISSION = 'publicApplicationSubmission'

type Loaded = {
  destination: Awaited<ReturnType<typeof loadApplicationTarget>>
  courses: Course[]
}

export const checkApplication = (
  input: ApplicationInput,
  loaded: Loaded,
  reader: Reader = null,
  local = false,
  now: Date = new Date(),
): { choices: ApplicationChoice[] } | { error: string } => {
  const choices = input.choices ?? []
  if (!Array.isArray(choices)) return { error: 'Choose courses again and try submitting.' }
  if (!input.target) {
    return choices.length ? { error: 'Choose what you are applying to.' } : { choices: [] }
  }
  const { destination, courses } = loaded
  if (!destination || relId(destination.formId) !== relId(input.form)) {
    return {
      error:
        'This form is not the registration form of what it names. Reload the application page.',
    }
  }
  const { target, cycle } = destination
  const kind = input.target.relationTo
  if (!local && (!destination.open || !destination.published)) {
    return { error: `${target.title ?? 'This application'} is not open for applications.` }
  }
  if (kind === 'programmes') {
    return choices.length
      ? { error: 'Course choices do not belong on this programme application.' }
      : { choices: [] }
  }
  if (kind === 'cycles' && !choices.length) return { error: 'Choose at least one course.' }
  if (kind === 'cycles' && target.registration?.method !== 'form') {
    return { error: 'This cycle does not take applications through a site form.' }
  }
  if (kind === 'courses') {
    const course = target as Course
    if (!local && (course.registration?.mode !== 'own' || course.registration?.method !== 'form')) {
      return { error: `${course.title} is no longer open for applications through this form.` }
    }
    if (choices.length !== 1 || relId(choices[0]?.course) !== course.id) {
      return { error: `Choose only ${course.title} on this application.` }
    }
  }
  const seen = new Set<number>()
  const normalized: ApplicationChoice[] = []
  for (const choice of choices) {
    const id = relId(choice?.course)
    const course = courses.find((c) => c.id === id)
    if (!course)
      return { error: 'One of your chosen courses is no longer available. Choose courses again.' }
    if (seen.has(course.id)) return { error: `Choose ${course.title} only once.` }
    seen.add(course.id)
    if (!local && kind === 'cycles' && !isOpenCourseInCycle(course, target as Cycle, reader, now)) {
      return { error: `${course.title} is no longer open for applications.` }
    }
    const questions = course.applicant_questions ?? []
    const answers = choice.answers ?? []
    if (!Array.isArray(answers)) return { error: `Answer the questions for ${course.title} again.` }
    const names = new Set<string>()
    const snapshots: NonNullable<ApplicationChoice['answers']> = []
    for (const answer of answers) {
      const question = questions.find((q) => q.name === answer?.name)
      if (!question || names.has(answer.name)) {
        return {
          error: `Remove the unrecognized or repeated answer for ${course.title} and try again.`,
        }
      }
      if (answer.value != null && typeof answer.value !== 'string') {
        return { error: `Answer “${question.label ?? question.name}” for ${course.title} again.` }
      }
      if (question.blockType === 'phone' && answer.value && !isValidPhoneNumber(answer.value))
        return { error: PHONE_NUMBER_ERROR }
      names.add(answer.name)
      snapshots.push({
        name: answer.name,
        label: question.label ?? question.name,
        value: answer.value ?? '',
      })
    }
    for (const question of questions) {
      const value = snapshots.find((a) => a.name === question.name)?.value?.trim()
      if (question.required && (!value || (question.blockType === 'checkbox' && value === 'No'))) {
        return { error: `Answer “${question.label ?? question.name}” for ${course.title}.` }
      }
    }
    const price = courseRegistration(
      course,
      kind === 'cycles' ? (target as Cycle) : cycle,
      now,
    ).price
    const options = price?.options ?? []
    if (options.length ? !options.some((o) => o.amount === choice.amount) : choice.amount != null) {
      return {
        error: options.length
          ? `Choose one of the contribution amounts for ${course.title}.`
          : `Remove the contribution amount for ${course.title}; it has no contribution options.`,
      }
    }
    if (choice.need_reduction && !price?.need_based_deductions) {
      return { error: `${course.title} does not offer need-based deductions.` }
    }
    normalized.push({ ...choice, course: course.id, answers: snapshots })
  }
  return { choices: normalized }
}

export const validateApplication = async (
  req: PayloadRequest,
  input: ApplicationInput,
  local = false,
): Promise<ApplicationChoice[]> => {
  const form = await req.payload.findByID({
    collection: 'forms',
    id: Number(relId(input.form)),
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (form.template) throw new APIError('A template cannot receive submissions.', 400)
  for (const question of form.fields ?? []) {
    if (question.blockType !== 'phone') continue
    const value = input.submissionData?.find((a) => a.field === question.name)?.value
    if ((question.required && !value) || (value && !isValidPhoneNumber(value)))
      throw new APIError(PHONE_NUMBER_ERROR, 400)
  }
  const kind = input.target?.relationTo
  if (kind && !['cycles', 'courses', 'programmes'].includes(kind)) {
    throw new APIError('Choose what you are applying to.', 400)
  }
  const id = relId(input.target?.value)
  const destination =
    kind && typeof id === 'number' ? await loadApplicationTarget(req.payload, kind, id, req) : null
  const ids = Array.isArray(input.choices)
    ? input.choices
        .map((c) => relId(c?.course))
        .filter((id): id is number => typeof id === 'number')
    : []
  const courses = ids.length
    ? (
        await req.payload.find({
          collection: 'courses',
          where: { id: { in: ids } },
          depth: 0,
          limit: 0,
          overrideAccess: true,
          req,
        })
      ).docs
    : []
  const checked = checkApplication(
    input,
    { destination, courses },
    req.user?.collection === 'users' ? req.user : null,
    local,
  )
  if ('error' in checked) throw new APIError(checked.error, 400)
  // Whoever submits, every course waits for its decision (application-decision.ts).
  return checked.choices.map((choice) => ({
    ...choice,
    decision: 'pending' as const,
    decided_at: null,
  }))
}

export const checkTarget: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  data.choices = await validateApplication(
    req,
    data,
    req.payloadAPI === 'local' && !req.context[PUBLIC_APPLICATION_SUBMISSION],
  )
  return data
}
