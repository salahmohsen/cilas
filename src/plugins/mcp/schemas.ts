import { z } from 'zod/v3'

import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
/** `z.enum` wants a non-empty tuple; the option lists are `as const` arrays of objects. */
const values = <T extends ReadonlyArray<{ value: string }>>(options: T) =>
  options.map((option) => option.value) as [T[number]['value'], ...T[number]['value'][]]

export const COURSE_TYPES = values(COURSE_TYPE_OPTIONS)

export const id = (what: string) =>
  z.number().int().positive().describe(`The id of ${what}, from the lookup tool. Never invent one.`)

export const localizedText = (what: string, max: number) =>
  z
    .object({
      en: z.string().trim().min(1).max(max).describe(`${what} in English.`),
      ar: z.string().trim().min(1).max(max).optional().describe(`${what} in Arabic.`),
    })
    .describe(`${what}, in English and, when the user gives it, Arabic.`)

export const optionalLocalizedText = (what: string, max: number) =>
  z
    .object({
      en: z.string().trim().min(1).max(max).optional().describe(`${what} in English.`),
      ar: z.string().trim().min(1).max(max).optional().describe(`${what} in Arabic.`),
    })
    .optional()
    .describe(`${what}, in English and/or Arabic. Leave out what the user did not give.`)
