import { z } from 'zod/v3'

import type { Course } from '@/payload-types'

import { markdownToLexical } from '../markdown'
import { adminPath, assertExist } from '../references'
import {
  COURSE_TYPES,
  id,
  LOCATIONS,
  localizedText,
  markdownText,
  optionalLocalizedText,
  registrationSchema,
  SESSION_UNITS,
  TEACHING_LANGUAGES,
} from '../schemas'
import { adminTool } from '../tool'
import { inTransaction } from '../transaction'
import type { CreatedDraft, Localized, RegistrationInput } from '../types'

type Locale = 'en' | 'ar'
type Side<T> = Partial<Record<Locale, T>>

/** The per-language text fields of a course, for one language. */
const textFor = (
  locale: Locale,
  input: {
    title: Localized
    subtitle?: Side<string>
    summary?: Side<string>
    epigraph?: Side<string>
    language_note?: Side<string>
  },
) => ({
  ...(input.title[locale] ? { title: input.title[locale] } : {}),
  ...(input.subtitle?.[locale] ? { subtitle: input.subtitle[locale] } : {}),
  ...(input.summary?.[locale] ? { summary: input.summary[locale] } : {}),
  ...(input.epigraph?.[locale] ? { epigraph: input.epigraph[locale] } : {}),
  ...(input.language_note?.[locale] ? { language_note: input.language_note[locale] } : {}),
})

/** How a registration choice is stored; `inherit` leaves the field empty. */
export const registrationData = (registration: RegistrationInput) => {
  switch (registration.method) {
    case 'inherit':
      return undefined
    case 'form':
      return { method: 'form' as const, form: registration.form }
    case 'external':
      return { method: 'external' as const, url: registration.url }
    case 'closed':
      return { method: 'closed' as const }
  }
}

export const createCourseDraftTool = adminTool({
  name: 'create_course_draft',
  description:
    'Create a course as a DRAFT. It is never published: a person must review it in the admin and publish it. Look up the cycle and any fellows first and use their real ids. Give Arabic text when the user gives it. Returns the draft id and its admin path.',
  shape: {
    title: localizedText('The course title', 200),
    subtitle: optionalLocalizedText('A second line under the title', 200),
    summary: optionalLocalizedText('One line for cards and search results', 300),
    epigraph: optionalLocalizedText('A short quote or question shown before the description', 300),
    description: markdownText('The course description'),
    course_type: z
      .enum(COURSE_TYPES)
      .describe(
        'The kind of course. Core, Thematic and Lab count toward the Bridge; Workshop and Short do not.',
      ),
    cycle: id('the cycle the course belongs to'),
    fellows: z.array(id('a person who teaches it')).max(10).default([]).describe('Who teaches it.'),
    session_unit: z
      .enum(SESSION_UNITS)
      .default('session')
      .describe('Whether the page numbers its sessions as sessions or as weeks.'),
    teaching_languages: z
      .array(z.enum(TEACHING_LANGUAGES))
      .optional()
      .describe('The languages it is taught in.'),
    location: z.array(z.enum(LOCATIONS)).optional().describe('Where it meets.'),
    language_note: optionalLocalizedText('A note on mixed languages', 200),
    registration: registrationSchema.default({ method: 'inherit' }),
  },
  run: async (input, ctx) => {
    const { payload, req, user } = ctx
    await assertExist(ctx, 'cycles', [input.cycle], 'Cycle')
    await assertExist(ctx, 'people', input.fellows, 'Person')
    if (input.registration.method === 'form') {
      await assertExist(ctx, 'forms', [input.registration.form], 'Form')
    }

    const description = {
      en: input.description?.en
        ? await markdownToLexical(payload, 'default', input.description.en)
        : undefined,
      ar: input.description?.ar
        ? await markdownToLexical(payload, 'default', input.description.ar)
        : undefined,
    }
    const hasArabic = Boolean(
      input.title.ar ||
      input.subtitle?.ar ||
      input.summary?.ar ||
      input.epigraph?.ar ||
      input.language_note?.ar ||
      description.ar,
    )

    const course = await inTransaction(req, async () => {
      const created = await payload.create({
        collection: 'courses',
        locale: 'en',
        draft: true,
        data: {
          _status: 'draft',
          ...textFor('en', input),
          ...(description.en ? { description: description.en } : {}),
          course_type: input.course_type,
          cycle: input.cycle,
          fellows: input.fellows,
          session_unit: input.session_unit,
          ...(input.teaching_languages ? { teaching_languages: input.teaching_languages } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(registrationData(input.registration)
            ? { registration: registrationData(input.registration) }
            : {}),
        } as unknown as Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'sizes'>,
        overrideAccess: false,
        user,
        req,
      })
      if (hasArabic) {
        await payload.update({
          collection: 'courses',
          id: created.id,
          locale: 'ar',
          draft: true,
          data: {
            _status: 'draft',
            ...textFor('ar', input),
            ...(description.ar ? { description: description.ar } : {}),
          } as never,
          overrideAccess: false,
          user,
          req,
        })
      }
      return created
    })

    const result: CreatedDraft & { slug?: string | null } = {
      id: course.id,
      slug: course.slug,
      status: 'draft',
      admin_path: adminPath('courses', course.id),
      locales: hasArabic ? ['en', 'ar'] : ['en'],
      notes: [
        'Not published. A person must review the draft and publish it in the admin.',
        input.registration.method === 'inherit'
          ? 'Registration follows the cycle.'
          : `Registration is set to ${input.registration.method}.`,
        'No schedule or sessions yet; add them in the admin.',
      ],
    }
    return result
  },
})
