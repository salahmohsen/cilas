import { z } from 'zod'

import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import {
  LOCATION_OPTIONS,
  SESSION_UNIT_OPTIONS,
  TEACHING_LANGUAGE_OPTIONS,
} from '@/fields/course-options'
import { LANGUAGE_OPTIONS } from '@/fields/language'

/** `z.enum` wants a non-empty tuple; the option lists are `as const` arrays of objects. */
const values = <T extends ReadonlyArray<{ value: string }>>(options: T) =>
  options.map((option) => option.value) as [T[number]['value'], ...T[number]['value'][]]

export const COURSE_TYPES = values(COURSE_TYPE_OPTIONS)
export const LOCATIONS = values(LOCATION_OPTIONS)
export const TEACHING_LANGUAGES = values(TEACHING_LANGUAGE_OPTIONS)
export const SESSION_UNITS = values(SESSION_UNIT_OPTIONS)
export const ORIGINAL_LANGUAGES = values(LANGUAGE_OPTIONS)

export const id = (what: string) =>
  z.number().int().positive().describe(`The id of ${what}, from the lookup tool. Never invent one.`)

/** English is required, so a draft always has something to show; Arabic is optional. */
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

export const markdownText = (what: string) =>
  z
    .object({
      en: z.string().trim().min(1).max(60_000).optional().describe(`${what} in English, Markdown.`),
      ar: z.string().trim().min(1).max(60_000).optional().describe(`${what} in Arabic, Markdown.`),
    })
    .optional()
    .describe(
      `${what} as Markdown (headings, lists, quotes, bold, italic, links). Links may start with https:, http: or mailto: only.`,
    )

export const httpUrlText = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/, 'Enter a full URL starting with https:// or http://')

/** How people apply. `inherit` leaves the course on its cycle's setting. */
export const registrationSchema = z
  .discriminatedUnion('method', [
    z.object({ method: z.literal('inherit') }),
    z.object({
      method: z.literal('form'),
      form: id('the registration form'),
    }),
    z.object({
      method: z.literal('external'),
      url: httpUrlText.describe('The full external registration URL.'),
    }),
    z.object({ method: z.literal('closed') }),
  ])
  .describe(
    'How people apply. inherit: use the cycle’s setting. form: a site form (give its id). external: an outside link (give the url). closed: no applications.',
  )
