import { tierField } from '@/fields/tier'
import { previewUrl } from '@/lib/preview-url'
import { addSelfAs } from '@/lib/review-ownership'
import type { CollectionConfig } from 'payload'

import {
  adminPublishes,
  canAuthor,
  adminOnlyField,
  isAdminOrOwn,
  isAdminUser,
  ownList,
  OWNER_EDITS,
  ownsViaAuthors,
  readTiers,
  WITH_OWNER,
} from '@/access'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { slugField } from '@/fields/slug'
import { reviewFields } from '@/fields/review'
import { reviewHooks, type ReviewOptions } from '@/lib/review-hooks'
import { articleBodyFeatures } from '@/lexical/article-body'
import { importFields } from '@/fields/import'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

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

const articleNoun = 'article' as const
const articleReview = reviewHooks(articleNoun, { onApprove: approveArticle })

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
  versions: { drafts: { autosave: { interval: 2000, showSaveDraftButton: true } } },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'authors', 'review.status', 'tier'],
    // A non-admin lists the articles they wrote, not every public one.
    baseFilter: ownList(ownsViaAuthors),
    // Through /api/preview, which checks the editor and turns on draft mode,
    // as courses do.
    livePreview: {
      url: previewUrl('articles'),
    },
  },
  hooks: {
    ...articleReview,
    beforeValidate: [addSelfAs('authors')],
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
        ...reviewFields(articleNoun, { required: true }),
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
        tierField({ duplicate: true }),
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
