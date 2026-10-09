import { isAdmin } from '@/access'
import type { CollectionConfig, PayloadRequest } from 'payload'

// The plan's `people` collection — auth users of the community.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
  auth: true,
  access: {
    update: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', localized: true },
    {
      // Portrait reads against the sidebar, beside identity metadata rather
      // than interrupting the profile text.
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
    {
      label: 'Profile',
      type: 'group',
      fields: [{ name: 'bio', type: 'richText', localized: true }], // single source of truth
    },
    {
      // Where to find and follow this person. `website` owns the primary
      // link; each social entry is one platform, one URL.
      label: 'Social',
      type: 'group',
      fields: [
        { name: 'website', type: 'text', admin: { placeholder: 'https://…' } },
        {
          name: 'social_links',
          type: 'array',
          label: 'Social media',
          fields: [
            {
              name: 'platform',
              type: 'select',
              required: true,
              options: ['facebook', 'x', 'youtube', 'instagram', 'linkedin'].map((v) => ({
                label: v.charAt(0).toUpperCase() + v.slice(1),
                value: v,
              })),
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              admin: { placeholder: 'https://…' },
              validate: (value: unknown) =>
                typeof value === 'string' && /^https?:\/\/\S+$/.test(value)
                  ? true
                  : 'Enter a full URL starting with https:// or http://',
            },
          ],
        },
      ],
    },
    {
      // Role plumbing lives in the sidebar: identity first, permissions to
      // the side.
      label: 'Roles',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'roles',
          type: 'select',
          required: true,
          defaultValue: 'ciliasian',
          hasMany: true,
          options: [
            { label: 'Super Admin', value: 'super_admin' },
            { label: 'Admin', value: 'admin' },
            { label: 'Fellow', value: 'fellow' },
            { label: 'CILASian', value: 'ciliasian' },
            { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
          ],
        },
        {
          // courses.fellows is the source of truth; storing both sides drifted.
          name: 'courses',
          type: 'relationship',
          relationTo: 'courses',
          hasMany: true,
          virtual: true,
          admin: { condition: (d) => d.roles?.includes('fellow') },
        },
      ],
    },
  ],
  hooks: {
    afterRead: [
      // doc is typed as `any` by Payload, hence the annotation.
      async ({ req, doc }: { req: PayloadRequest; doc?: { id?: number } }) => {
        if (typeof doc?.id !== 'number') return doc

        const res = await req.payload.find({
          collection: 'courses',
          where: { fellows: { contains: doc.id } },
          // Populating fellows would re-enter this hook.
          depth: 0,
          select: { title: true },
          limit: 100,
          // courses.read is tiered by status and ownership.
          overrideAccess: true,
        })

        return {
          ...doc,
          courses: res.docs.map((d: { id: number; title?: string }) => ({
            id: d.id,
            title: d.title,
          })),
        }
      },
    ],
  },
}
