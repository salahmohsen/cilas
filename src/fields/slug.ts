import { slugify } from '@/lib/slugify'
import { slugField as payloadSlugField } from 'payload'

/**
 * Payload's built-in slug field, bound to this project's slugify.
 *
 * The built-in already provides everything a slug needs: a lock/unlock toggle so
 * an editor can override the generated value, a `generateSlug` checkbox that
 * stops regeneration once a slug is hand-written, a unique index and an index
 * for lookups. The only thing it needs from us is a slugify that survives
 * Arabic titles, which the default (ASCII `\w` only) does not.
 *
 * @see https://payloadcms.com/docs/fields/text#slug-field
 */
export const slugField: typeof payloadSlugField = (args = {}) =>
  payloadSlugField({
    // Payload calls this with `{ valueToSlugify, data, req }`; our helper is
    // plain and synchronous, so unwrap the source value.
    slugify: ({ valueToSlugify }) => {
      // Return null (not '') when there is nothing to slugify: autosaved
      // drafts are created before any title exists, and two draft rows with
      // slug '' would hit the unique index. Multiple NULLs are allowed.
      return slugify(valueToSlugify) || undefined
    },
    ...args,
  })
