import type { PayloadHandler, PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { countSpaceContent, spaceDeleteBlock } from '@/lib/space-delete'

const guarded =
  (run: (req: PayloadRequest, id: number) => Promise<Response>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id)) return Response.json({ error: 'No such space.' }, { status: 404 })
    try {
      return await run(req, id)
    } catch (error) {
      const status = (error as { status?: number }).status ?? 500
      req.payload.logger.error({ err: error, msg: `Space ${id} delete request failed` })
      return Response.json({ error: (error as Error).message }, { status })
    }
  }

/** What the delete would remove, for the admin dialog. */
const summary = guarded(async (req, id) => {
  const space = await req.payload.findByID({
    collection: 'spaces',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    select: { kind: true, name: true, course: true, programme: true },
  })
  // The dialog asks for this name; a space with no name is confirmed by its ID.
  const name = (typeof space.name === 'string' && space.name.trim()) || `Space ${id}`
  const blocked = spaceDeleteBlock(space)
  if (blocked) return Response.json({ name, blocked })
  return Response.json({ name, counts: await countSpaceContent(req.payload, id, req) })
})

/**
 * The only way to delete a space: the collection's own delete access is
 * closed so the admin panel shows this dialog's counts first. The
 * collection's beforeDelete hook removes the content in the same transaction.
 */
const remove = guarded(async (req, id) => {
  await req.payload.delete({ collection: 'spaces', id, overrideAccess: true, req })
  return Response.json({ ok: true })
})

export const spaceDeleteEndpoints = [
  { path: '/:id/delete-summary', method: 'get' as const, handler: summary },
  { path: '/:id/delete', method: 'post' as const, handler: remove },
]
