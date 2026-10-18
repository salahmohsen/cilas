import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import {
  type Role,
  adminPublishes,
  canProposePublication,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminUser,
  ownList,
  ownsViaEditors,
  personOf,
  publishedOrOwn,
} from '@/access'
import { toPersonIds } from '@/lib/fellow-role'
import type { Publication } from '@/payload-types'
import { creditsField } from '@/fields/credits'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'
import { importFields } from '@/fields/import'

/** As `addSelfAsAuthor` on articles: a student keeps access to what they propose. */
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

/** Students edit their own drafts. Publishing is the admin's approval. */
const OWNER_ROLES: { allow: Role[] } = { allow: ['member', 'non_degree_seeking'] }

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
    update: adminPublishes(isAdminOrOwnAndDraft(ownsViaEditors, OWNER_ROLES)),
    delete: isAdminOrOwnAndDraft(ownsViaEditors, OWNER_ROLES),
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'editors', '_status'],
    // A student lists the publications they edit, not every published one.
    baseFilter: ownList(ownsViaEditors),
  },
  hooks: {
    beforeValidate: [addSelfAsEditor],
  },
  fields: [
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
      admin: { position: 'sidebar' },
    },
    {
      // Who may edit it before it is published. Not the printed credits.
      name: 'editors',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'intro', type: 'richText', localized: true },
    {
      name: 'foreword',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'A signed essay, so it is an article.' },
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'In reading order.' },
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
    ...importFields(),
  ],
}
