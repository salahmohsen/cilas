import {
  MetaTitleField,
  MetaDescriptionField,
  MetaImageField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { cairoDay } from '@/lib/cairo-day'
import { z } from 'zod/v3'
import type { Field } from 'payload'
import acceptedFields from './accepted-fields.json'
import { Courses } from '@/collections/Courses'
import { Articles } from '@/collections/Articles'

const SYSTEM_FIELDS = {
  id: 'System identity',
  createdAt: 'System timestamp',
  updatedAt: 'System timestamp',
  _status: 'Tool forces draft; publishing is excluded',
  '*.id': 'Array row identity, accepted only to retain rows on update',
  '*.blockName': 'Auto-generated block label',
} as const

export const FIELD_REGISTRY = {
  courses: {
    fields: Courses.fields,
    accepted: acceptedFields.courses,
    excluded: {
      ...SYSTEM_FIELDS,
      last_edited_by: 'System-managed editor stamp',
      submit_for_review: 'Admin UI',
      review: 'Admin review decision',
      tier: 'Admin visibility decision',
      legacy_url: 'Import provenance',
      generateSlug: 'Auto-generated slug control',
      effective_settings: 'Admin UI',
      enrollments: 'Join',
      'schedule.end_date': 'Computed by the shared schedule expansion',
      'meta.overview': 'Admin UI',
      'meta.preview': 'Admin UI',
    },
  },
  articles: {
    fields: Articles.fields,
    accepted: acceptedFields.articles,
    excluded: {
      ...SYSTEM_FIELDS,
      last_edited_by: 'System-managed editor stamp',
      submit_for_review: 'Admin UI',
      review: 'Admin review decision',
      tier: 'Admin visibility decision',
      legacy_url: 'Import provenance',
      generateSlug: 'Auto-generated slug control',
      'meta.overview': 'Admin UI',
      'meta.preview': 'Admin UI',
      featured: 'Admin editorial decision',
      published_date: 'Admin publication decision',
      publications: 'Join',
    },
  },
} as const
export type DraftCollection = keyof typeof FIELD_REGISTRY

export const flattenFields = (fields: Field[]): Field[] =>
  fields.flatMap((field) => {
    if (field.type === 'tabs') return field.tabs.flatMap((tab) => flattenFields(tab.fields))
    if (!('name' in field) && 'fields' in field) return flattenFields(field.fields)
    return [field]
  })
export const fieldsFor = (collection: DraftCollection): Field[] => [
  ...flattenFields(FIELD_REGISTRY[collection].fields),
  {
    name: 'meta',
    type: 'group',
    fields: [
      OverviewField({}),
      MetaTitleField({}),
      MetaDescriptionField({}),
      MetaImageField({ relationTo: 'media' }),
      PreviewField({}),
    ],
  },
]

export const excludedField = (collection: DraftCollection, path: string): boolean =>
  Object.keys(FIELD_REGISTRY[collection].excluded).some((key) =>
    key.startsWith('*.') ? path.endsWith(key.slice(1)) : path === key || path.startsWith(`${key}.`),
  )

const leafSchema = (field: Field, collection: DraftCollection, path: string): z.ZodTypeAny => {
  let schema: z.ZodTypeAny
  if ('fields' in field) schema = z.object(shapeFor(field.fields, collection, path)).strict()
  else if (field.type === 'blocks') {
    const blocks = field.blocks
      .filter((b) => typeof b !== 'string')
      .map((block) =>
        z
          .object({
            blockType: z.literal(block.slug),
            ...shapeFor(block.fields, collection, `${path}.${block.slug}`),
            id: z.string().optional(),
          })
          .strict(),
      )
    schema = z.array(z.union(blocks as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]))
  } else if (field.type === 'select') {
    const choices = field.options.map((o) => (typeof o === 'string' ? o : String(o.value)))
    schema = z.enum(choices as [string, ...string[]])
    if (field.hasMany) schema = field.required ? z.array(schema).min(1) : z.array(schema)
  } else if (field.type === 'relationship' || field.type === 'upload') {
    schema = z.number().int().positive()
    if ('hasMany' in field && field.hasMany)
      schema = field.required ? z.array(schema).min(1) : z.array(schema)
  } else if (field.type === 'number') {
    let number = z.number().finite()
    if (field.min !== undefined) number = number.min(field.min)
    if (field.max !== undefined) number = number.max(field.max)
    schema = number
  } else if (field.type === 'checkbox') schema = z.boolean()
  else if (field.type === 'date')
    schema = z
      .string()
      .refine(
        (v) =>
          /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) &&
          cairoDay(v.slice(0, 10)) !== null &&
          cairoDay(v) !== null,
        'Use an ISO date with a valid calendar day',
      )
  else
    schema =
      'required' in field && field.required
        ? z
            .string()
            .trim()
            .min(1)
            .max(field.type === 'richText' ? 60000 : 10000)
        : z.string().max(field.type === 'richText' ? 60000 : 10000)
  if (field.type === 'array')
    schema = z.array(
      z.object({ ...shapeFor(field.fields, collection, path), id: z.string().optional() }).strict(),
    )
  if ('localized' in field && field.localized)
    schema = z
      .object({ en: schema.nullable().optional(), ar: schema.nullable().optional() })
      .strict()
      .refine(
        (value) => !('required' in field && field.required) || value.en != null || value.ar != null,
        'Supply at least one language',
      )
  schema = schema.describe(
    `${path}${field.type === 'richText' ? ': Markdown' : ''}${'localized' in field && field.localized ? '; localized { en?, ar? }' : ''}. ${field.admin && 'description' in field.admin && typeof field.admin.description === 'string' ? field.admin.description : ''}`,
  )
  return 'required' in field && field.required ? schema : schema.nullable().optional()
}
const shapeFor = (fields: Field[], collection: DraftCollection, prefix = ''): z.ZodRawShape =>
  Object.fromEntries(
    flattenFields(fields).flatMap((field) => {
      if (!('name' in field) || !field.name) return []
      const path = prefix ? `${prefix}.${field.name}` : field.name
      if (
        excludedField(collection, path) ||
        !(FIELD_REGISTRY[collection].accepted as readonly string[]).includes(path)
      )
        return []
      return [[field.name, leafSchema(field, collection, path)]]
    }),
  )
export const draftShape = (collection: DraftCollection): z.ZodRawShape =>
  Object.fromEntries(
    Object.entries(
      shapeFor(
        fieldsFor(collection).filter(
          (field) =>
            'name' in field &&
            (FIELD_REGISTRY[collection].accepted as readonly string[]).includes(field.name!),
        ),
        collection,
      ),
    ).map(([name, schema]) => [name, schema.optional()]),
  )
