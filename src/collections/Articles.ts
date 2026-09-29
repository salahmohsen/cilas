import { isAdmin, isAdminOrOwnArticle, isAdminUser, isAuthenticated } from '@/access'
import type { CollectionConfig, PayloadRequest, Where } from 'payload'

export const Articles: CollectionConfig = {
  slug: 'articles',
  fields: [
    { name: 'cover_image', type: 'upload', relationTo: 'media' },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
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
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' }, // author only
        { label: 'Community', value: 'community' }, // all logged-in users
        { label: 'Public', value: 'public' }, // world — admin/super_admin only
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Feature on home page',
      admin: { position: 'sidebar' },
    }, // admin/super_admin only
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
    read: ({ req }): Where => {
      if (!req.user) return { status: { equals: 'public' } }
      if (req.user && isAdminUser(req.user)) return {}
      return {
        or: [
          { status: { in: ['community', 'public'] } },
          { author: { equals: req.user.id } }, // own drafts
        ],
      }
    },
    create: isAuthenticated,
    update: isAdminOrOwnArticle,
    delete: isAdmin,
  },

  admin: {
    useAsTitle: 'title',
  },
}
