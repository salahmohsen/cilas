import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Where,
} from 'payload'
import { APIError } from 'payload'

import {
  canAuthor,
  canSetTier,
  isAdminOrOwnVersions,
  isAdminOrOwnWhile,
  isAdminUser,
  ownList,
  ownsViaAuthors,
  personOf,
  readTiers,
} from '@/access'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

import { CardStack } from '@/blocks/card-stack'
import { Footnote } from '@/blocks/footnote'
import { Mention } from '@/blocks/mention'
import { creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { slugField } from '@/fields/slug'
import { toPersonIds } from '@/lib/fellow-role'
import { notifyOn, reviewPatch, type ReviewState } from '@/lib/review'
import { adminEmails, authorEmails, sendReviewEmail } from '@/lib/review-mail'
import type { Article } from '@/payload-types'
import { importFields } from '@/fields/import'

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

const DRAFT_SAVE = 'articleDraftSave'

/**
 * Records whether this write is a draft save ("Save draft", `draft: true`).
 * Payload decides that from the operation args before any hook runs, and
 * beforeChange never sees it, so it is passed on through `req.context`.
 * Mirrors Payload's own test: on update a draft write that sets `_status:
 * 'published'` is a publish, not a draft save.
 */
export const recordDraftSave: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return
  const { data, draft } = args as { data?: { _status?: unknown }; draft?: boolean }
  req.context[DRAFT_SAVE] =
    operation === 'create' ? Boolean(draft) : Boolean(draft) && data?._status !== 'published'
}

/**
 * Applies the review rules (src/lib/review.ts) to every write. Server calls
 * with no user (seeds, imports) are trusted like an admin.
 */
export const applyReview: CollectionBeforeChangeHook<Article> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const trusted = !req.user || isAdminUser(req.user)
  // On create, `originalDoc` is the duplicate source (if any), not this
  // article's history. A new article always starts from draft.
  const from: ReviewState =
    operation === 'create' ? 'draft' : (originalDoc?.review?.status ?? 'draft')
  const to: ReviewState = data.review?.status ?? from

  // A draft save writes only a version: the main document keeps its old
  // review status and _status, while emails would announce the new one. An
  // author could also keep editing a "submitted" article whose main doc still
  // reads draft. So the review status only changes on a full save.
  if (to !== from && req.context?.[DRAFT_SAVE]) {
    throw new APIError('Change the review status with the main save button, not Save draft.', 400)
  }

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

/**
 * Emails admins on submission and authors on a decision. Only for writes made
 * by a signed-in account: trusted server writes (seed, archive import) are
 * silent, and a caller can also opt out with `context.skipReviewEmail`.
 */
export const notifyReview: CollectionAfterChangeHook<Article> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!req.user || req.context?.skipReviewEmail) return doc
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

/** Review states in which the article is still with its author. */
const WITH_AUTHOR: Where = { 'review.status': { in: ['draft', 'changes_requested'] } }

/** A piece of writing by members of the community, published after review. */
export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    read: readTiers(ownsViaAuthors, { drafts: true }),
    readVersions: isAdminOrOwnVersions(ownsViaAuthors),
    create: canAuthor,
    // Authors edit or delete only while the article is with them, not once
    // submitted. `_status` alone would let them delete a submitted article.
    update: isAdminOrOwnWhile(ownsViaAuthors, WITH_AUTHOR),
    delete: isAdminOrOwnWhile(ownsViaAuthors, WITH_AUTHOR),
  },
  versions: { drafts: true },
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
    beforeOperation: [recordDraftSave],
    beforeValidate: [addSelfAsAuthor],
    beforeChange: [applyReview],
    afterChange: [notifyReview],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      name: 'body',
      type: 'richText',
      localized: true,
      // Footnotes and mentions are inline blocks: inserted where they belong in the text.
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          // Card stacks are blocks of their own, between paragraphs.
          BlocksFeature({ blocks: [CardStack], inlineBlocks: [Footnote, Mention] }),
        ],
      }),
    },
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
              // A draft save only writes a version, so applyReview rejects one that
              // changes this field: submit with the main button. It stays unpublished.
              admin: {
                description:
                  'Ready for an editor? Choose Submitted, then save with the main button. Save draft cannot change this.',
              },
              // A copy goes through review again.
              hooks: { beforeDuplicate: [() => 'draft'] },
            },
            {
              name: 'review_note',
              type: 'textarea',
              access: { create: canSetTier, update: canSetTier },
              hooks: { beforeDuplicate: [() => null] },
              admin: {
                description:
                  'The editor’s note to the author when asking for changes, e.g. “Shorten the second section.”',
              },
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
          // A copy is a new piece: it goes back through review from owner-only.
          hooks: { beforeDuplicate: [() => 'owner'] },
        },
        {
          name: 'published_date',
          type: 'date',
          access: { create: canSetTier, update: canSetTier },
          hooks: { beforeDuplicate: [() => null] },
        },
        {
          name: 'featured',
          type: 'checkbox',
          label: 'Feature on home page',
          access: { create: canSetTier, update: canSetTier },
          hooks: { beforeDuplicate: [() => false] },
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
    ...importFields(),
  ],
}
