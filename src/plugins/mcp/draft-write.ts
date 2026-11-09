import { z } from 'zod/v3'
import { randomUUID } from 'node:crypto'
import type { Field } from 'payload'
import { cairoDay, weekdayOf } from '@/lib/cairo-day'
import { expandSchedule, type Schedule } from '@/lib/schedule'
import { timeOfDay, endAfterStart, httpUrl } from '@/fields/validators'
import { ToolInputError } from './errors'
import { fieldsFor, flattenFields, type DraftCollection } from './field-registry'
import { markdownToLexical } from './markdown'
import { adminUrl, assertExist } from './references'
import { inTransaction } from './transaction'
import type { ToolContext } from './types'

export const unmappedSchema = z
  .array(z.object({ field: z.string(), reason: z.string() }).strict())
  .optional()
  .describe(
    'Source facts that have no supported field. Always report these to the person; result is incomplete.',
  )

type Data = z.infer<z.ZodObject<z.ZodRawShape>>
const validate = (value: true | string, path: string) => {
  if (value !== true) throw new ToolInputError(`${path}: ${value}`)
}

export function validateCourse(input: Data) {
  const s = input.schedule as Schedule | undefined
  if (s?.start_date && s.slots?.length && s.start_precision !== 'week') {
    const day = cairoDay(s.start_date)!
    const weekday = weekdayOf(day)
    if (!s.slots.some((slot) => slot.weekday === weekday))
      throw new ToolInputError(
        `Schedule conflict: start date ${day} is ${weekday}, but weekly slots specify ${s.slots.map((slot) => slot.weekday).join(', ')}. Ask the person which is correct. Nothing was saved.`,
      )
  }
  for (const row of [
    ...(s?.slots ?? []),
    ...(input.sessions ?? []).flatMap((session: Data) => session.dates ?? []),
  ]) {
    validate(timeOfDay(row.start_time), 'start_time')
    validate(timeOfDay(row.end_time), 'end_time')
    validate(endAfterStart(row.end_time, row.start_time), 'end_time')
  }
  if (s && s.start_date && !cairoDay(s.start_date))
    throw new ToolInputError('schedule.start_date is not a real date')
  if (s) expandSchedule(s, input.sessions)
  const pricing = input.pricing_override
  if (pricing?.min != null && pricing?.max != null && pricing.max < pricing.min)
    throw new ToolInputError('pricing_override.max must not be below min')
  if (input.registration?.method === 'form' && !input.registration.form)
    throw new ToolInputError('registration.form: Choose a registration form.')
  if (input.registration?.method === 'external' && !input.registration.url)
    throw new ToolInputError('registration.url: Enter the external registration URL.')
  if (input.registration?.url) validate(httpUrl(input.registration.url), 'registration.url')
  if (input.registration?.method === 'external' && input.applicant_questions?.length)
    throw new ToolInputError(
      'Applicant questions are not used with external registration. Remove them or choose a site form.',
    )
}

async function prepare(
  fields: Field[],
  input: Data,
  ctx: ToolContext,
  locale: 'en' | 'ar',
): Promise<Data> {
  const result: Data = {}
  for (const field of flattenFields(fields)) {
    if (!('name' in field) || !(field.name! in input)) continue
    const name = field.name!
    let value = input[name]
    if (value === undefined) continue
    const localized = 'localized' in field && field.localized
    if (localized && value !== null) {
      if (value[locale] === undefined) continue
      value = value[locale]
    }
    if (value === null) {
      result[name] = null
      continue
    }
    if (field.type === 'richText')
      value = await markdownToLexical(ctx.payload, name === 'body' ? 'article' : 'default', value)
    else if (field.type === 'array')
      value = await Promise.all(
        value.map(async (row: Data) => ({
          ...(await prepare(field.fields, row, ctx, locale)),
          id: row.id,
        })),
      )
    else if ('fields' in field) value = await prepare(field.fields, value, ctx, locale)
    else if (field.type === 'blocks')
      value = await Promise.all(
        value.map(async (row: Data) => {
          const block = field.blocks.find((b) => typeof b !== 'string' && b.slug === row.blockType)
          return {
            ...(await prepare(typeof block === 'object' ? block.fields : [], row, ctx, locale)),
            id: row.id,
            blockType: row.blockType,
          }
        }),
      )
    else if (field.type === 'relationship' || field.type === 'upload') {
      await assertExist(
        ctx,
        field.relationTo as 'people',
        Array.isArray(value) ? value : [value],
        name,
      )
    }
    if ('validate' in field && typeof field.validate === 'function') {
      const valid = await field.validate(
        value as never,
        { data: input, siblingData: result, req: ctx.req, operation: 'update' } as never,
      )
      if (valid !== undefined) validate(valid, name)
    }
    result[name] = value
  }
  return result
}
function assignIds(value: unknown): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value))
    for (const row of value) {
      if (row && typeof row === 'object') {
        row.id ??= randomUUID()
        assignIds(row)
      }
    }
  else for (const child of Object.values(value)) assignIds(child)
}
function hasArabic(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (Object.hasOwn(value, 'ar') || Object.values(value).some(hasArabic)),
  )
}

const suppliedPaths = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object') return [prefix]
  const entries = Object.entries(value).filter(
    ([key, child]) => key !== 'source_unmapped' && key !== 'id' && child !== undefined,
  )
  return entries.length
    ? entries.flatMap(([key, child]) => suppliedPaths(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
}

export async function writeDraft(
  collection: DraftCollection,
  raw: Data,
  ctx: ToolContext,
  documentId?: number,
) {
  const input = structuredClone(raw)
  const fields = fieldsFor(collection)
  if (collection === 'courses' && !documentId) validateCourse(input)
  for (const [name, value] of Object.entries(input))
    if (name !== 'source_unmapped') assignIds(value)
  const en = await prepare(fields, input, ctx, 'en')
  const ar = hasArabic(input) ? await prepare(fields, input, ctx, 'ar') : undefined
  const { payload, req, user } = ctx
  const doc = await inTransaction(req, async () => {
    if (documentId && collection === 'courses') {
      const current = await payload.findByID({
        collection,
        id: documentId,
        draft: true,
        depth: 0,
        overrideAccess: false,
        req,
        user,
      })
      validateCourse({
        ...current,
        ...en,
        schedule: en.schedule === null ? null : { ...current.schedule, ...en.schedule },
        registration: { ...current.registration, ...en.registration },
      })
    }
    const options = {
      collection,
      locale: 'en' as const,
      draft: true,
      data: { ...en, _status: 'draft' as const },
      overrideAccess: false,
      user,
      req,
    }
    const saved = documentId
      ? await payload.update({
          ...options,
          id: documentId,
          overrideLock: false,
          data: options.data as never,
        })
      : await payload.create({ ...options, data: options.data as never })
    if (ar)
      await payload.update({
        collection,
        id: saved.id,
        locale: 'ar',
        draft: true,
        data: { ...ar, _status: 'draft' } as never,
        overrideLock: false,
        overrideAccess: false,
        user,
        req,
      })
    return saved
  })
  return {
    id: doc.id,
    slug: doc.slug,
    status: 'draft',
    admin_url: adminUrl(collection, doc.id),
    locales: ar ? ['en', 'ar'] : ['en'],
    completeness: input.source_unmapped?.length ? 'incomplete' : 'complete',
    fields: {
      saved: suppliedPaths(raw),
      not_saved: raw.source_unmapped ?? [],
      needs_human_review: [
        { field: '_status', reason: 'A person must review and publish this draft.' },
        ...(input.schedule?.note
          ? [
              {
                field: 'schedule.note',
                reason:
                  'Any per-session delivery split is saved only as a note; check it against the source. There is no structured session delivery field.',
              },
            ]
          : []),
      ],
    },
    notes: ['Not published. A person must review and publish.'],
  }
}
