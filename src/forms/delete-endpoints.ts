import type { Access, CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import type { DeleteSummary } from '@/lib/delete-summary'

type Summarize = (req: PayloadRequest, id: number) => Promise<Omit<DeleteSummary, 'blocked'>>

/**
 * The delete routes for a collection whose stock delete is closed, so that
 * the admin panel shows what goes with a document before it is deleted
 * (src/components/admin/delete-dialog.tsx):
 *
 * - `GET /:id/delete-summary`: the dialog's lists.
 * - `POST /:id/delete`: the delete itself. The collection's beforeDelete
 *   hooks remove the dependents in the same transaction.
 *
 * `blocked` returns why the signed-in user may not delete this document, or
 * null when they may. It is the collection's delete rule; both routes check it.
 */
export const deleteEndpoints = (
  collection: CollectionSlug,
  {
    summarize,
    blocked,
  }: {
    summarize: Summarize
    blocked: (req: PayloadRequest, id: number) => Promise<string | null>
  },
): Endpoint[] => {
  const guarded =
    (run: (req: PayloadRequest, id: number) => Promise<Response>): Endpoint['handler'] =>
    async (req) => {
      if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
      const id = Number(req.routeParams?.id)
      if (!Number.isInteger(id)) return Response.json({ error: 'Not found.' }, { status: 404 })
      try {
        return await run(req, id)
      } catch (error) {
        const status = (error as { status?: number }).status ?? 500
        req.payload.logger.error({ err: error, msg: `${collection} ${id} delete request failed` })
        return Response.json({ error: (error as Error).message }, { status })
      }
    }

  const summary = guarded(async (req, id) => {
    const found = await summarize(req, id)
    const reason = await blocked(req, id)
    return Response.json({ ...found, ...(reason ? { blocked: reason } : {}) })
  })

  const remove = guarded(async (req, id) => {
    const reason = await blocked(req, id)
    if (reason) return Response.json({ error: reason }, { status: 403 })
    await req.payload.delete({ collection, id, overrideAccess: true, req })
    return Response.json({ ok: true })
  })

  return [
    { path: '/:id/delete-summary', method: 'get', handler: summary },
    { path: '/:id/delete', method: 'post', handler: remove },
  ]
}

/**
 * `blocked` from an access rule: the collection keeps its delete rule here,
 * and closes its stock delete so that the dialog is the only way in.
 */
export const blockedUnless =
  (collection: CollectionSlug, rule: Access, reason: string) =>
  async (req: PayloadRequest, id: number): Promise<string | null> => {
    const result = await rule({ req, id })
    if (result === true) return null
    if (!result) return reason
    const { totalDocs } = await req.payload.count({
      collection,
      where: { and: [{ id: { equals: id } }, result] },
      overrideAccess: true,
      req,
    })
    return totalDocs ? null : reason
  }
