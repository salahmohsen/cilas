import type { CollectionBeforeChangeHook, Field } from 'payload'

/**
 * Who saved a document last, for the admin dashboard's "Recent changes".
 * Payload keeps no author for a save or a version, so the editor is stamped
 * here. Hidden from the form; a save without a signed-in account (imports,
 * scripts) leaves the earlier editor, and a document never edited since this
 * field arrived has none, which the dashboard shows as "System".
 */
export const lastEditedByField: Field = {
  name: 'last_edited_by',
  type: 'relationship',
  relationTo: 'users',
  admin: { hidden: true },
}

export const stampLastEditor: CollectionBeforeChangeHook = ({ data, req }) =>
  req.user?.collection === 'users' ? { ...data, last_edited_by: req.user.id } : data
