import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import {
  adminPublishes,
  canAuthor,
  adminOnlyField,
  isAdminOrOwn,
  isAdminUser,
  ownList,
  OWNER_EDITS,
  ownsViaAuthors,
  personOf,
  readTiers,
  WITH_OWNER,
} from '@/access'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { slugField } from '@/fields/slug'
import { toPersonIds } from '@/lib/fellow-role'
import { reviewFields } from '@/fields/review'
import { reviewHooks, type ReviewOptions } from '@/lib/review-hooks'
import { articleBodyFeatures } from '@/lexical/article-body'
import type { Article } from '@/payload-types'
import { importFields } from '@/fields/import'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

/**
 * A non-admin's new article always lists them as an author, so they keep
 * access to it. beforeValidate, because `authors` is required and validation
 * runs before beforeChange.
 */
export const addSelfAsAuthor: CollectionBeforeValidateHook<Article> = ({
  data,
  req,
  operation,
}) => {
  const self = personOf(req.user)
  if (!data || operation !== 'create' || isAdminUser(req.user) || self === null) return data
  const authors = toPersonIds(data.authors)
  return authors.includes(self) ? data : { ...data, authors: [...authors, self] }
}

/** On approval an article takes the admin's tier, else the requested one, and a date. */
const approveArticle: ReviewOptions['onApprove'] = ({ data, originalDoc, now }) => {
  const tier = (data.tier ?? originalDoc?.tier) as string | null | undefined
  const requested = (data.requested_tier ?? originalDoc?.requested_tier) as
    | string
    | null
    | undefined
  return {
    tier: tier && tier !== 'owner' ? tier : (requested ?? 'community'),
    published_date: data.published_date ?? originalDoc?.published_date ?? now.toISOString(),
  }
}

const articleReview = reviewHooks({
  noun: 'article',
  collection: 'articles',
  ownersOf: (doc) => toPersonIds(doc.authors as Article['authors']),
  onApprove: approveArticle,
})

/** A piece of writing by members of the community, published after review. */
export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    read: readTiers(ownsViaAuthors, { drafts: true }),
    readVersions: isAdminOrOwn(ownsViaAuthors, { versions: true }),
    // Only an admin publishes: authors get Save draft and Submit for review.
    create: adminPublishes(canAuthor),
    // Authors edit or delete only while the article is with them, not once
    // submitted. `_status` alone would let them delete a submitted article,
    // and the review status alone a published one. Published, their edits are
    // a draft for review beside it.
    update: adminPublishes(isAdminOrOwn(ownsViaAuthors, { while: OWNER_EDITS })),
    delete: isAdminOrOwn(ownsViaAuthors, { draft: true, while: WITH_OWNER }),
  },
  // Autosave feeds the live preview as the editor writes.
  // Save draft shows beside autosave, so an author always has a button to press.
  versions: { drafts: { autosave: { interval: 2000, showSaveDraftButton: true } } },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'authors', 'review.status', 'tier'],
    // A non-admin lists the articles they wrote, not every public one.
    baseFilter: ownList(ownsViaAuthors),
    // Through /api/preview, which checks the editor and turns on draft mode,
    // as courses do.
    livePreview: {
      // The page in the editor's language, so what shows is what the fields hold.
      url: ({ data, locale }) =>
        `/api/preview?collection=articles&slug=${data?.slug ?? ''}&locale=${locale?.code ?? 'en'}`,
    },
  },
  hooks: {
    ...articleReview,
    beforeValidate: [addSelfAsAuthor],
    beforeChange: [...(articleReview.beforeChange ?? []), stampLastEditor],
  },
  fields: [
    lastEditedByField,
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      label: 'Review',
      type: 'collapsible',
      admin: { position: 'sidebar' },
      fields: [
        ...reviewFields('article', { required: true }),
        {
          name: 'requested_tier',
          type: 'select',
          defaultValue: 'community',
          options: [
            { label: 'Community', value: 'community' },
            { label: 'Public', value: 'public' },
          ],
          admin: { description: 'Who you would like to read it. An editor decides.' },
        },
        {
          // Who may see it. Admin-only; approval fills it in.
          name: 'tier',
          type: 'select',
          required: true,
          defaultValue: 'owner',
          options: [
            { label: 'Owner only', value: 'owner' },
            { label: 'Community', value: 'community' },
            { label: 'Public', value: 'public' },
          ],
          access: { create: adminOnlyField, update: adminOnlyField },
          // A copy is a new piece: it goes back through review from owner-only.
          hooks: { beforeDuplicate: [() => 'owner'] },
        },
        {
          name: 'published_date',
          type: 'date',
          access: { create: adminOnlyField, update: adminOnlyField },
          hooks: { beforeDuplicate: [() => null] },
        },
        {
          name: 'featured',
          type: 'checkbox',
          label: 'Feature on home page',
          access: { create: adminOnlyField, update: adminOnlyField },
          // An editor's choice: authors do not see it.
          admin: { condition: (_, __, { user }) => isAdminUser(user) },
          hooks: { beforeDuplicate: [() => false] },
        },
      ],
    },
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Writing',
          fields: [
            {
              name: 'body',
              type: 'richText',
              localized: true,
              // Footnotes and mentions are inline blocks: inserted where they belong in the text.
              editor: lexicalEditor({ features: articleBodyFeatures }),
            },
          ],
        },
        {
          label: 'Credits and relationships',
          fields: [
            {
              name: 'authors',
              type: 'relationship',
              relationTo: 'people',
              hasMany: true,
              required: true,
            },
            creditsField(),
            {
              label: 'Translation',
              type: 'collapsible',
              admin: { initCollapsed: true, description: 'Only for translated articles.' },
              fields: [
                {
                  name: 'translation',
                  type: 'group',
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'original_language',
                          type: 'select',
                          options: [...LANGUAGE_OPTIONS],
                          admin: { width: '30%' },
                        },
                        { name: 'original_title', type: 'text', admin: { width: '70%' } },
                      ],
                    },
                    {
                      name: 'original_authors',
                      type: 'relationship',
                      relationTo: 'people',
                      hasMany: true,
                    },
                    { name: 'original_url', type: 'text' },
                    { name: 'original_source', type: 'text' }, // citation of where it first appeared
                    { name: 'note', type: 'text', localized: true }, // "translated in 2018, not published before"
                  ],
                },
              ],
            },
            {
              label: 'Related',
              type: 'collapsible',
              admin: { initCollapsed: true },
              fields: [
                { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
                {
                  name: 'related_articles',
                  type: 'relationship',
                  relationTo: 'articles',
                  hasMany: true,
                  admin: {
                    description: 'Editor-curated. If empty, articles sharing tags are suggested.',
                  },
                },
                {
                  name: 'publications',
                  type: 'join',
                  collection: 'publications',
                  on: 'articles',
                  admin: { allowCreate: false },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
