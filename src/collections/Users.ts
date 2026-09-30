import { isAdmin } from '@/access'
import type { CollectionConfig, PayloadRequest } from 'payload'

// The plan's `people` collection — auth users of the community.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
  auth: true,
  access: {
    update: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', localized: true },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'richText', localized: true }, // single source of truth
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
      name: 'field_of_study',
      type: 'relationship',
      relationTo: 'fields-of-study',
      admin: { condition: (d) => d.roles?.includes('fellow') },
    },
    {
      name: 'cohort_year',
      type: 'text',
      admin: { condition: (d) => d.roles?.includes('ciliasian') },
    }, // "CILASians 2016–2017"
    {
      // Derived, not stored: `courses.fellows` is the single source of truth.
      // Storing both sides let them drift — the fellow-role hooks in
      // `Courses.ts` would then be fighting a stale copy here.
      name: 'courses',
      type: 'relationship',
      relationTo: 'courses',
      hasMany: true,
      virtual: true,
      admin: { condition: (d) => d.roles?.includes('fellow') },
    },
  ],
  hooks: {
    afterRead: [
      // Args are annotated because Payload types the hook's `doc` as
      // `T extends TypeWithID = any`; without this the spread below is unchecked.
      async ({ req, doc }: { req: PayloadRequest; doc?: { id?: number } }) => {
        if (typeof doc?.id !== 'number') return doc

        const res = await req.payload.find({
          collection: 'courses',
          where: { fellows: { contains: doc.id } },
          // depth 0 is required: courses.fellows is a hasMany back to users, so
          // populating it here would re-enter this hook.
          depth: 0,
          select: { title: true },
          limit: 100,
          // courses.read is tiered by status and ownership, so without this a
          // fellow would see none of their own draft courses.
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
