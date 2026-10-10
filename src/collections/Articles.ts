import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  canAuthor,
  canSetTier,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminOrOwnWhile,
  isAdminUser,
  ownsViaAuthors,
  personOf,
  readTiers,
} from '@/access'
import { creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { slugField } from '@/fields/slug'
import { toPersonIds } from '@/lib/fellow-role'
import { notifyOn, reviewPatch, type ReviewState } from '@/lib/review'
import { adminEmails, authorEmails, sendReviewEmail } from '@/lib/review-mail'
import type { Article } from '@/payload-types'

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

/**
 * Applies the review rules (src/lib/review.ts) to every write. Server calls
 * with no user (seeds, imports) are trusted like an admin.
 */
export const applyReview: CollectionBeforeChangeHook<Article> = ({
  data,
  originalDoc,
  req,
}) => {
  const trusted = !req.user || isAdminUser(req.user)
  const from: ReviewState = originalDoc?.review?.status ?? 'draft'
  const to: ReviewState = data.review?.status ?? from

  const result = reviewPatch({
    from,
    to,
    trusted,
    data: {
      tier: data.tier ?? originalDoc?.tier,
      requested_tier: data.requested_tier ?? originalDoc?.requested_tier,
      published_date: data.published_date ?? originalDoc?.published_date,
    },
    now: new Date(),
  })
  if ('error' in result) throw new APIError(result.error, 403)

  return { ...data, ...result.patch }
}

/** Emails admins on submission and authors on a decision. */
export const notifyReview: CollectionAfterChangeHook<Article> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const state: ReviewState = doc.review?.status ?? 'draft'
  const audience = notifyOn(previousDoc?.review?.status ?? 'draft', state)
  if (!audience) return doc

  const to =
    audience === 'admins'
      ? await adminEmails(req)
      : await authorEmails(req, toPersonIds(doc.authors))
  await sendReviewEmail(req, to, state, doc.title, doc.review?.review_note)
  return doc
}

/** A piece of writing by members of the community, published after review. */
export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    read: readTiers(ownsViaAuthors, { drafts: true }),
    readVersions: isAdminOrOwnVersions(ownsViaAuthors),
    create: canAuthor,
    // Authors edit only while the article is with them, not once submitted.
    update: isAdminOrOwnWhile(ownsViaAuthors, {
      'review.status': { in: ['draft', 'changes_requested'] },
    }),
    delete: isAdminOrOwnAndDraft(ownsViaAuthors),
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'authors', 'review.status', 'tier'],
  },
  hooks: {
    beforeValidate: [addSelfAsAuthor],
    beforeChange: [applyReview],
    afterChange: [notifyReview],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      label: 'Review',
      type: 'collapsible',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'review',
          type: 'group',
          fields: [
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Submitted', value: 'submitted' },
                { label: 'Changes requested', value: 'changes_requested' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ],
              // A draft save only writes a version, so submitting must be a full save:
              // choose Submitted, then save with the main button. It stays unpublished.
              admin: { description: 'Ready for an editor? Choose Submitted, then save.' },
            },
            {
              name: 'review_note',
              type: 'textarea',
              access: { create: canSetTier, update: canSetTier },
            },
          ],
        },
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
          access: { create: canSetTier, update: canSetTier },
        },
        {
          name: 'published_date',
          type: 'date',
          access: { create: canSetTier, update: canSetTier },
        },
        {
          name: 'featured',
          type: 'checkbox',
          label: 'Feature on home page',
          access: { create: canSetTier, update: canSetTier },
        },
      ],
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
            { name: 'original_authors', type: 'relationship', relationTo: 'people', hasMany: true },
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
          admin: { description: 'Editor-curated. If empty, articles sharing tags are suggested.' },
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
}
