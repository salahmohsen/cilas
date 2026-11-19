import type { CollectionSlug, Field, FieldHook, RowField } from 'payload'
import { slugField as payloadSlugField } from 'payload'

import { adminWritesOnly } from '@/access'
import { slugify } from '@/lib/slugify'

type SlugHookArgs = Parameters<FieldHook>[0]

const slugOf = (value: unknown) => slugify(typeof value === 'string' ? value : '') || null

const otherRowHolds = async (slug: string, { collection, originalDoc, req }: SlugHookArgs) =>
  collection !== null &&
  (
    await req.payload.count({
      collection: collection.slug as CollectionSlug,
      where: {
        slug: { equals: slug },
        ...(originalDoc?.id === undefined ? {} : { id: { not_equals: originalDoc.id } }),
      },
      overrideAccess: true,
      req,
    })
  ).totalDocs > 0

/**
 * The slug follows the title while the document has never been published.
 * The `generateSlug` checkbox holds that state: it stays true until the first
 * publish, or until an admin writes a slug by hand. A collection without
 * drafts has no publish step, so its slug is fixed when the document is
 * created. The slug follows the title of the default locale only: an edit
 * in another locale leaves it as it is. A document with no title in the
 * default locale gets no new slug, and an update that would take a slug that
 * another row holds keeps the current one (the slug is unique). The hook has
 * no publish check: a draft save skips the main table, so two drafts can hold
 * one slug, and the unique index refuses the second publish with a field error
 * on `slug` (Payload turns the violation into a ValidationError). An admin
 * recovers by setting a different slug. This replaces Payload's own hook,
 * which stops following the title after two versions.
 */
const followTitleUntilPublished =
  (useAsSlug: string): FieldHook =>
  async (args) => {
    const { collection, data, operation, originalDoc, req, value } = args
    if (!data) return value
    const given: unknown = data.slug
    const changed = typeof given === 'string' && given !== '' && given !== originalDoc?.slug
    const publishing = data._status === 'published'
    const { localization } = req.payload.config
    if (operation === 'update' && localization && req.locale !== localization.defaultLocale)
      return changed || publishing ? false : value
    const fromTitle = slugOf(data[useAsSlug] ?? originalDoc?.[useAsSlug])
    if ((changed && given !== fromTitle) || (operation === 'update' && !value)) return false
    if (fromTitle && fromTitle !== originalDoc?.slug) {
      const taken = operation === 'update' && (await otherRowHolds(fromTitle, args))
      data.slug = taken ? originalDoc?.slug : fromTitle
    }
    return Boolean(collection?.versions?.drafts) && !publishing
  }

const lock = (row: RowField, useAsSlug: string): RowField => ({
  ...row,
  fields: row.fields.map((field): Field => {
    const locked = { ...field, access: adminWritesOnly } as Field
    if (locked.type !== 'checkbox' || locked.name !== 'generateSlug') return locked
    return {
      ...locked,
      hooks: { ...locked.hooks, beforeChange: [followTitleUntilPublished(useAsSlug)] },
    }
  }),
})

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
export const slugField: typeof payloadSlugField = (args = {}) =>
  payloadSlugField({
    // Payload calls this with `{ valueToSlugify, data, req }`; our helper is
    // plain and synchronous, so unwrap the source value. Return undefined
    // (not '') when there is nothing to slugify: two draft rows with slug ''
    // would hit the unique index.
    slugify: ({ valueToSlugify }) => slugify(valueToSlugify) || undefined,
    ...args,
    overrides: (row) =>
      lock(args.overrides?.(row) ?? row, args.fieldToUse ?? args.useAsSlug ?? 'title'),
  })
