import type { CollectionSlug, Field, FieldHook, RowField } from 'payload'
import { slugField as payloadSlugField } from 'payload'

import { adminWritesOnly } from '@/access'
import { slugify } from '@/lib/slugify'

type SlugHookArgs = Parameters<FieldHook>[0]

const slugOf = (value: unknown) => slugify(typeof value === 'string' ? value : '') || null

const SUFFIX_LIMIT = 50

const otherDocs = (key: string, { originalDoc }: SlugHookArgs) =>
  originalDoc?.id === undefined ? {} : { [key]: { not_equals: originalDoc.id } }

const heldInTable = async (slug: string, args: SlugHookArgs) =>
  args.collection !== null &&
  (
    await args.req.payload.count({
      collection: args.collection.slug as CollectionSlug,
      where: { slug: { equals: slug }, ...otherDocs('id', args) },
      overrideAccess: true,
      req: args.req,
    })
  ).totalDocs > 0

// A draft save skips the main table, so the latest version is where a draft keeps its slug.
const heldInLatestVersion = async (slug: string, args: SlugHookArgs) =>
  Boolean(args.collection?.versions) &&
  (
    await args.req.payload.countVersions({
      collection: args.collection!.slug as CollectionSlug,
      where: {
        'version.slug': { equals: slug },
        latest: { equals: true },
        ...otherDocs('parent', args),
      },
      overrideAccess: true,
      req: args.req,
    })
  ).totalDocs > 0

/**
 * The one collision rule. A document that has a slug keeps it when the new one
 * is taken. A document with none takes the first free `<slug>`, `<slug>-2`, ...
 * and past the limit falls back to the unique index, which refuses the save.
 */
const claimSlug = async (wanted: string, args: SlugHookArgs) => {
  const current: unknown = args.operation === 'update' ? args.originalDoc?.slug : undefined
  if (current) return (await heldInTable(wanted, args)) ? current : wanted
  for (let n = 1; n <= SUFFIX_LIMIT; n += 1) {
    const candidate = n === 1 ? wanted : `${wanted}-${n}`
    if (!(await heldInTable(candidate, args)) && !(await heldInLatestVersion(candidate, args)))
      return candidate
  }
  return wanted
}

/**
 * Replaces Payload's hook, which stops following the title after two versions.
 * It sits on the slug field, not on the checkbox: Payload validates a field
 * right after its own hooks, so a hook on the checkbox would race the
 * `required` check on the slug.
 * There is no publish check: a draft save skips the main table, so two drafts
 * can hold one slug, and the unique index refuses the second publish with a
 * field error on `slug`. An admin recovers by setting another slug.
 * The default locale alone drives the slug.
 */
const followTitleUntilPublished =
  (useAsSlug: string, checkbox: string): FieldHook =>
  async (args) => {
    const { collection, data, operation, originalDoc, req, siblingData, value } = args
    if (!data) return value
    const given = typeof value === 'string' ? value : ''
    const current: unknown = originalDoc?.slug
    const follows: unknown = siblingData[checkbox]
    const handWritten = given !== '' && given !== current
    const publishing = data._status === 'published'
    const { localization } = req.payload.config
    if (operation === 'update' && localization && req.locale !== localization.defaultLocale) {
      siblingData[checkbox] = handWritten || publishing ? false : follows
      return value
    }
    const fromTitle = slugOf(data[useAsSlug] ?? originalDoc?.[useAsSlug])
    if ((handWritten && given !== fromTitle) || (operation === 'update' && !follows)) {
      siblingData[checkbox] = false
      return value
    }
    siblingData[checkbox] = Boolean(collection?.versions?.drafts) && !publishing
    if (fromTitle) return fromTitle === current ? current : await claimSlug(fromTitle, args)
    return given === '' ? current : value
  }

const lock = (row: RowField, useAsSlug: string): RowField => {
  const checkbox = row.fields.find((field) => field.type === 'checkbox')
  if (checkbox?.type !== 'checkbox') throw new Error('slugField: Payload built no checkbox')
  return {
    ...row,
    fields: row.fields.map((field): Field => {
      const locked = { ...field, access: adminWritesOnly } as Field
      if (locked.type === 'checkbox')
        return { ...locked, hooks: { ...locked.hooks, beforeChange: [] } }
      if (locked.type !== 'text') return locked
      return {
        ...locked,
        hooks: {
          ...locked.hooks,
          beforeChange: [followTitleUntilPublished(useAsSlug, checkbox.name)],
        },
      }
    }),
  }
}

// Payload resolves `fieldToUse`/`useAsSlug` and passes the result to the
// admin slug component; read it back there so the choice lives in one place.
const sourceFieldOf = (row: RowField): string => {
  for (const field of row.fields) {
    const component = field.type === 'text' ? field.admin?.components?.Field : undefined
    const props = typeof component === 'object' ? component.clientProps : undefined
    const source = props && 'useAsSlug' in props ? props.useAsSlug : undefined
    if (typeof source === 'string') return source
  }
  throw new Error('slugField: Payload did not set the source field on the slug field')
}

/**
 * Payload's built-in slug field, bound to this project's slugify.
 *
 * The built-in gives the lock/unlock toggle in the admin, the `generateSlug`
 * checkbox, a unique index and an index for lookups. This project adds a
 * slugify that survives Arabic titles (the default keeps ASCII `\w` only),
 * the rule of when the slug follows the title (followTitleUntilPublished),
 * and field access: only an admin writes the slug or its checkbox, so an
 * owner cannot claim a URL by hand.
 *
 * @see https://payloadcms.com/docs/fields/text#slug-field
 */
export const slugField: typeof payloadSlugField = (args = {}) => {
  const built = payloadSlugField({
    // Payload calls this with `{ valueToSlugify, data, req }`; our helper is
    // plain and synchronous, so unwrap the source value. Return undefined
    // (not '') when there is nothing to slugify: two draft rows with slug ''
    // would hit the unique index.
    slugify: ({ valueToSlugify }) => slugify(valueToSlugify) || undefined,
    ...args,
    overrides: undefined,
  })
  const useAsSlug = sourceFieldOf(built)
  return lock(args.overrides?.(built) ?? built, useAsSlug)
}
