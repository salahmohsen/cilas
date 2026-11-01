import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import {
  adminPublishes,
  canProposePublication,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminOrOwnWhile,
  isAdminUser,
  ownList,
  OWNER_EDITS,
  ownsViaEditors,
  personOf,
  publishedOrOwn,
  type Role,
  WITH_OWNER,
} from '@/access'
import { toPersonIds } from '@/lib/fellow-role'
import { reviewHooks } from '@/lib/review-hooks'
import type { Publication } from '@/payload-types'
import { creditsField } from '@/fields/credits'
import { reviewFields } from '@/fields/review'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'
import { importFields } from '@/fields/import'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

/** As `addSelfAsAuthor` on articles: a student or fellow keeps access to what they propose. */
export const addSelfAsEditor: CollectionBeforeValidateHook<Publication> = ({
  data,
  req,
  operation,
}) => {
  const self = personOf(req.user)
  if (!data || operation !== 'create' || isAdminUser(req.user) || self === null) return data
  const editors = toPersonIds(data.editors)
  return editors.includes(self) ? data : { ...data, editors: [...editors, self] }
}

/** A student or fellow submits a publication; an admin approves (publishes) it. */
const publicationReview = reviewHooks({
  noun: 'publication',
  collection: 'publications',
  ownersOf: (doc) => toPersonIds(doc.editors as Publication['editors']),
})

/** Students and fellows edit their own drafts. Publishing is the admin's approval. */
const OWNER_ROLES: { allow: Role[] } = { allow: ['member', 'non_degree_seeking', 'fellow'] }

/**
 * An edited collection of articles, often produced by a course or lab
 * (CONTEXT.md). Its texts are articles; no PDF is stored (ADR 0004).
 */
export const Publications: CollectionConfig = {
  slug: 'publications',
  access: {
    read: publishedOrOwn(ownsViaEditors),
    readVersions: isAdminOrOwnVersions(ownsViaEditors),
    create: adminPublishes(canProposePublication),
    // An owner edits while it is with them; submitted, it waits for the admin.
    // Published, their edits are a draft for review beside it.
    update: adminPublishes(isAdminOrOwnWhile(ownsViaEditors, OWNER_EDITS, OWNER_ROLES)),
    delete: isAdminOrOwnAndDraft(ownsViaEditors, { ...OWNER_ROLES, while: WITH_OWNER }),
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'editors', '_status'],
    // A student lists the publications they edit, not every published one.
    baseFilter: ownList(ownsViaEditors),
  },
  hooks: {
    ...publicationReview,
    beforeValidate: [addSelfAsEditor],
    beforeChange: [...(publicationReview.beforeChange ?? []), stampLastEditor],
  },
  fields: [
    lastEditedByField,
    {
      label: 'Review',
      type: 'collapsible',
      admin: { position: 'sidebar' },
      fields: reviewFields('publication'),
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Introduction',
          fields: [
            { name: 'subtitle', type: 'text', localized: true },
            { name: 'intro', type: 'richText', localized: true },
            {
              name: 'kind',
              type: 'select',
              required: true,
              options: [
                { label: 'Essay collection', value: 'essay_collection' },
                { label: 'Translation booklet', value: 'translation_booklet' },
                { label: 'Research', value: 'research' },
                { label: 'Other', value: 'other' },
              ],
              admin: {},
            },
          ],
        },
        {
          label: 'Reading order',
          fields: [
            {
              name: 'articles',
              type: 'relationship',
              relationTo: 'articles',
              hasMany: true,
              admin: { description: 'In reading order.' },
            },
          ],
        },
        {
          label: 'Credits and provenance',
          fields: [
            {
              // Who may edit it before it is published. Not the printed credits.
              name: 'editors',
              type: 'relationship',
              relationTo: 'people',
              hasMany: true,
              admin: {},
            },
            creditsField(),
            {
              label: 'Provenance',
              type: 'collapsible',
              fields: [
                { name: 'produced_by', type: 'relationship', relationTo: 'courses', hasMany: true },
                {
                  name: 'license',
                  type: 'select',
                  options: [
                    { label: 'CC BY-NC-SA', value: 'cc_by_nc_sa' },
                    { label: 'CC BY-SA', value: 'cc_by_sa' },
                    { label: 'CC BY', value: 'cc_by' },
                    { label: 'All rights reserved', value: 'all_rights_reserved' },
                  ],
                },
                {
                  // A link to the designed print edition, e.g. a Wayback copy. No file is stored.
                  name: 'print_edition_url',
                  type: 'text',
                  validate: (value: unknown) => (value ? httpUrl(value) : true),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
