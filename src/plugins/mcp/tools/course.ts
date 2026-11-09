import { z } from 'zod/v3'

import { slugify } from '@/lib/slugify'
import type { Course } from '@/payload-types'

import { ToolInputError } from '../errors'
import { markdownToLexical } from '../markdown'
import { adminUrl, assertExist } from '../references'
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
import type { CreatedDraft, Localized, RegistrationInput, ToolContext } from '../types'

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

/** The course that already has this web address, if any (live or draft). */
const courseWithSlug = async ({ payload, req }: ToolContext, slug: string) =>
  (
    await payload.find({
      collection: 'courses',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      draft: false,
      select: { title: true },
      locale: 'en',
      fallbackLocale: false,
      overrideAccess: true,
      req,
    })
  ).docs[0]

const MAX_SLUG = 100

/**
 * The web address of a new course. An admin who gave one gets exactly it, or
 * is told it is taken. Otherwise it comes from the title, and when another
 * course (say the same title in another cycle) already has it, the cycle's
 * name is added, then a number. No one has to know what a slug is.
 */
const chooseSlug = async (
  ctx: ToolContext,
  title: string,
  cycle: number,
  wanted: string | undefined,
): Promise<{ slug: string; changed: boolean }> => {
  if (wanted) {
    const slug = slugify(wanted).slice(0, MAX_SLUG)
    if (!slug) throw new ToolInputError('That web address has no usable letters. Give another.')
    const taken = await courseWithSlug(ctx, slug)
    if (taken) {
      throw new ToolInputError(
        `The web address "${slug}" is already used by course ${taken.id} (${adminUrl('courses', Number(taken.id))}). Nothing was created. Give a different slug, or leave it out and one is made from the title.`,
      )
    }
    return { slug, changed: false }
  }
  const base = slugify(title).slice(0, MAX_SLUG) || 'course'
  if (!(await courseWithSlug(ctx, base))) return { slug: base, changed: false }
  const found = await ctx.payload.findByID({
    collection: 'cycles',
    id: cycle,
    depth: 0,
    select: { slug: true },
    overrideAccess: true,
    req: ctx.req,
  })
  const withCycle = found.slug ? `${base}-${found.slug}`.slice(0, MAX_SLUG) : base
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const slug = attempt === 1 ? withCycle : `${withCycle}-${attempt}`
    if (slug !== base && !(await courseWithSlug(ctx, slug))) return { slug, changed: true }
  }
  throw new ToolInputError(
    'Could not find a free web address from the title. Give a slug of your own.',
  )
}

export const createCourseDraftTool = adminTool({
  name: 'create_course_draft',
  description:
    'Create a course as a DRAFT. It is never published: a person must review it in the admin and publish it. Look up the cycle and any fellows first and use their real ids. Give Arabic text when the user gives it. Returns the draft id and a link to it in the admin.',
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
    slug: z
      .string()
      .trim()
      .max(MAX_SLUG)
      .optional()
      .describe(
        'The last part of the course’s web address. Leave it out: it is made from the title, and made different from other courses that have the same title.',
      ),
  },
  run: async (input, ctx) => {
    const { payload, req, user } = ctx
    await assertExist(ctx, 'cycles', [input.cycle], 'Cycle')
    await assertExist(ctx, 'people', input.fellows, 'Person')
    if (input.registration.method === 'form') {
      await assertExist(ctx, 'forms', [input.registration.form], 'Form')
    }

    const { slug, changed: slugChanged } = await chooseSlug(
      ctx,
      input.title.en,
      input.cycle,
      input.slug,
    )

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
          slug,
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
      admin_url: adminUrl('courses', course.id),
      locales: hasArabic ? ['en', 'ar'] : ['en'],
      notes: [
        'Not published. A person must review the draft and publish it in the admin.',
        input.registration.method === 'inherit'
          ? 'Registration follows the cycle.'
          : `Registration is set to ${input.registration.method}.`,
        'No schedule or sessions yet; add them in the admin.',
        ...(slugChanged
          ? [
              `Another course already used the web address from the title, so this one is "${slug}". A person can change it in the draft.`,
            ]
          : []),
      ],
    }
    return result
  },
})
