import { z } from 'zod/v3'
import { slugify } from '@/lib/slugify'
import { ToolInputError } from '../errors'
import { adminUrl } from '../references'
import { COURSE_TYPES, id, localizedText } from '../schemas'
import { draftShape } from '../field-registry'
import { writeDraft, unmappedSchema } from '../draft-write'
import { validateCourse } from '../course-validation'
import { draftInputError } from '../draft-result'
import { adminTool } from '../tool'
import type { ToolContext } from '../types'

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
      overrideAccess: false,
      user: req.user,
      req,
    })
  ).docs[0]

const MAX_SLUG = 100

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
    overrideAccess: false,
    user: ctx.user,
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

const courseShape = draftShape('courses')
export const createCourseDraftTool = adminTool({
  name: 'create_course_draft',
  description:
    'Create a course draft with structured schedule and course flow. Never publishes. Read cilas://guides/course first.',
  inputError: draftInputError,
  shape: {
    ...courseShape,
    title: localizedText('Course title', 200),
    course_type: z.enum(COURSE_TYPES),
    cycle: id('cycle'),
    source_unmapped: unmappedSchema,
  },
  run: async (input, ctx) => {
    validateCourse(input)
    const { slug, changed } = await chooseSlug(
      ctx,
      input.title.en,
      input.cycle,
      (input as Record<string, unknown>).slug as string | undefined,
    )
    const result = await writeDraft('courses', { ...input, slug }, ctx)
    if (changed)
      result.notes.push(
        `Another course already used the web address from the title, so this one is "${slug}".`,
      )
    return result
  },
})
export const updateCourseDraftTool = adminTool({
  name: 'update_course_draft',
  description:
    'Correct an existing course draft by id. Omitted fields stay unchanged. Null clears optional fields; arrays replace the whole field. A published course gets a draft beside its unchanged live version.',
  inputError: draftInputError,
  shape: { ...courseShape, id: id('course'), source_unmapped: unmappedSchema },
  run: async ({ id, ...input }, ctx) => writeDraft('courses', input, ctx, id),
})
