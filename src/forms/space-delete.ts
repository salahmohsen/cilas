import type { PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { nonEmpty } from '@/lib/delete-summary'
import { countSpaceContent, spaceContentGroups, spaceDeleteBlock } from '@/lib/space-delete'

import { deleteEndpoints } from './delete-endpoints'

const readSpace = (req: PayloadRequest, id: number) =>
  req.payload.findByID({
    collection: 'spaces',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    select: { kind: true, name: true, course: true, programme: true },
  })

/**
 * The only way to delete a space: the collection's own delete access is
 * closed so the admin panel shows the dialog's counts first. The
 * collection's beforeDelete hook removes the content in the same transaction.
 */
export const spaceDeleteEndpoints = deleteEndpoints('spaces', {
  summarize: async (req, id) => {
    const space = await readSpace(req, id)
    return {
      // The dialog asks for this name; a space with no name is confirmed by its ID.
      name: (typeof space.name === 'string' && space.name.trim()) || `Space ${id}`,
      noun: 'space',
      deletes: nonEmpty(spaceContentGroups(await countSpaceContent(req.payload, id, req))),
      unlinks: [],
    }
  },
  blocked: async (req, id) =>
    isAdminUser(req.user) ? spaceDeleteBlock(await readSpace(req, id)) : 'Admins only.',
})
