import type { FormSubmission } from '@/payload-types'

export type ApplicationChoice = NonNullable<FormSubmission['choices']>[number]

export type ApplicationInput = {
  form?: unknown
  target?: { relationTo: 'cycles' | 'courses' | 'programmes'; value: unknown } | null
  choices?: ApplicationChoice[] | null
  submissionData?: FormSubmission['submissionData']
}

export const choiceFileField = (course: number, name: string): string => `choice:${course}:${name}`
