import {
  canSetTier,
  isAdmin,
  isAdminOrOwnAndDraft,
  isAdminUser,
  isAuthenticated,
  ownsViaAuthors,
  readTiers,
} from '@/access'
import { slugField } from '@/fields/slug'
import type { CollectionConfig, PayloadRequest, Where } from 'payload'

export const Articles: CollectionConfig = {
  slug: 'articles',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      label: 'Content',
      type: 'group',
      fields: [{ name: 'body', type: 'richText', localized: true }],
    },
    {
      name: 'cover_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
      },
    },
    {
      label: 'Metadata',
      type: 'group',
      fields: [
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
          required: true,
          admin: {
            position: 'sidebar',
          },
        },
        {
          name: 'published_date',
          type: 'date',
          admin: {
            position: 'sidebar',
          },
        },
      ],
    },
    {
      label: 'Visibility',
      type: 'group',
      fields: [
        {
          name: 'tier',
          type: 'select',
          defaultValue: 'owner',
          options: [
            { label: 'Owner only', value: 'owner' },
            { label: 'Community', value: 'community' },
            { label: 'Public', value: 'public' },
          ],
          admin: {
            position: 'sidebar',
          },
          access: { create: canSetTier, update: canSetTier },
        },
        {
          name: 'featured',
          type: 'checkbox',
          label: 'Feature on home page',
          admin: {
            position: 'sidebar',
            condition: (_, siblingData) => isAdminUser(siblingData.author),
          },
          access: { create: canSetTier, update: canSetTier },
        },
      ],
    },
    {
      label: 'Relations',
      type: 'group',
      fields: [
        {
          name: 'tags',
          type: 'array',
          fields: [{ name: 'tag', type: 'text' }],
          admin: {
            position: 'sidebar',
          },
        },
        {
          name: 'related_articles',
          type: 'relationship',
          relationTo: 'articles',
          hasMany: true,
          admin: {
            description:
              'Manual override: editor-curated related articles. If empty, automated recommendations by tag overlap are used.',
            position: 'sidebar',
          },
        },
        {
          // Name kept as-is (with the space) for backwards compatibility with
          // `articles.article_collection_id`.
          name: 'Article Collection',
          type: 'relationship',
          relationTo: 'article-collections',
          hasMany: true,
          // Derived, not stored: `article-collections.articles` is the single
          // source of truth. Storing both sides let them drift.
          virtual: true,
          admin: {
            position: 'sidebar',
          },
        },
      ],
    },
  ],
  hooks: {
    afterRead: [
      // Args are annotated because Payload types `AfterReadHook`'s `doc` as
      // `T extends TypeWithID = any`; without this the spread below is unchecked.
      async ({ req, doc }: { req: PayloadRequest; doc?: { id?: number } }) => {
        if (typeof doc?.id !== 'number') return doc

        const res = await req.payload.find({
          collection: 'article-collections',
          where: { articles: { equals: doc.id } },
          // depth 0 is required: article-collections.articles is a hasMany
          // back to articles, so populating it here would re-enter this hook.
          depth: 0,
          select: { title: true },
          limit: 100,
          // ArticleCollections.read is `anyone` today; don't let this lookup
          // silently return zero rows if that access rule tightens later.
          overrideAccess: true,
        })

        return {
          ...doc,
          'Article Collection': res.docs.map((d: { id: number; title?: string }) => ({
            id: d.id,
            title: d.title,
          })),
        }
      },
    ],
  },
  access: {
    read: readTiers(ownsViaAuthors, { drafts: true }),
    create: isAuthenticated,
    update: isAdminOrOwnAndDraft(ownsViaAuthors),
    delete: isAdminOrOwnAndDraft(ownsViaAuthors),
  },
  versions: {
    drafts: true,
  },

  admin: {
    useAsTitle: 'title',
  },
}
