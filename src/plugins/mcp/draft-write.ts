import { z } from 'zod/v3'
import { randomUUID } from 'node:crypto'
import type { Field } from 'payload'
import { validateCourse } from './course-validation'
import { ToolInputError } from './errors'
import { fieldsFor, flattenFields, type DraftCollection } from './field-registry'
import { resolveArticleMentions } from './article-mentions'
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
async function prepare(
  fields: Field[],
  input: Data,
  ctx: ToolContext,
  locale: 'en' | 'ar',
  validateFields = true,
  data: Data = input,
): Promise<Data> {
  const result: Data = {}
  for (const field of flattenFields(fields)) {
    if (!('name' in field) || !(field.name! in input)) continue
    const name = field.name!
    let value = input[name]
    if (value === undefined) continue
    const localized = 'localized' in field && field.localized
    const shouldValidate =
      validateFields &&
      (!field.admin?.condition ||
        field.admin.condition(data, input, {
          user: ctx.user,
          blockData: input,
          operation: 'update',
          path: [name],
        }))
    if (localized && value !== null) {
      if (value[locale] === undefined) continue
      value = value[locale]
    }
    if (value === null) {
      result[name] = null
      continue
    }
    if (field.type === 'richText') {
      value = await markdownToLexical(ctx.payload, name === 'body' ? 'article' : 'default', value)
      if (name === 'body') value = await resolveArticleMentions(value, ctx)
    } else if (field.type === 'array')
      value = await Promise.all(
        value.map(async (row: Data) => ({
          ...(await prepare(field.fields, row, ctx, locale, shouldValidate, data)),
          id: row.id,
        })),
      )
    else if ('fields' in field)
      value = await prepare(field.fields, value, ctx, locale, shouldValidate, data)
    else if (field.type === 'blocks')
      value = await Promise.all(
        value.map(async (row: Data) => {
          const block = field.blocks.find((b) => typeof b !== 'string' && b.slug === row.blockType)
          return {
            ...(await prepare(
              typeof block === 'object' ? block.fields : [],
              row,
              ctx,
              locale,
              shouldValidate,
              data,
            )),
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
    if (shouldValidate && 'validate' in field && typeof field.validate === 'function') {
      const valid = await field.validate(
        value as never,
        { data: input, siblingData: result, req: ctx.req, operation: 'update' } as never,
      )
      if (valid !== undefined && valid !== true) throw new ToolInputError(`${name}: ${valid}`)
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

const hasNull = (value: unknown): boolean =>
  value === null ||
  Boolean(value && typeof value === 'object' && Object.values(value).some(hasNull))

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
  for (const [name, value] of Object.entries(input))
    if (name !== 'source_unmapped') assignIds(value)
  const { payload, req, user } = ctx
  let ar: Data | undefined
  const doc = await inTransaction(req, async () => {
    const current =
      documentId && collection === 'courses'
        ? await payload.findByID({
            collection,
            id: documentId,
            draft: true,
            depth: 0,
            overrideAccess: false,
            req,
            user,
          })
        : null
    const data = {
      ...current,
      ...input,
      registration: { ...current?.registration, ...input.registration },
    }
    const en = await prepare(fields, input, ctx, 'en', true, data)
    ar =
      hasArabic(input) || hasNull(input)
        ? await prepare(fields, input, ctx, 'ar', true, data)
        : undefined
    if (current) {
      validateCourse({
        ...current,
        ...en,
        schedule: en.schedule === null ? null : { ...current.schedule, ...en.schedule },
        registration: {
          ...current.registration,
          ...en.registration,
          mode: en.registration?.mode ?? current.registration?.mode ?? 'follow_cycle',
        },
        pricing_override:
          en.pricing_override === null
            ? null
            : {
                ...current.pricing_override,
                ...en.pricing_override,
                options:
                  en.pricing_override?.options === undefined
                    ? current.pricing_override?.options
                    : en.pricing_override.options,
              },
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
      ],
    },
    notes: ['Not published. A person must review and publish.'],
  }
}
