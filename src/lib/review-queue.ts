import { REVIEWED } from '@/lib/reviewed-collections'
import { relId } from '@/lib/relation'
import type { Payload } from 'payload'

export type QueueKind = (typeof REVIEWED)[number]['kind']

export type QueueItem = {
  kind: QueueKind
  id: number
  title: string
  by: string
  since: string
  href: string
}

const namesOf = (people: unknown) =>
  ((people as Array<{ name?: string } | number> | null | undefined) ?? [])
    .flatMap((p) => (typeof p === 'object' && p?.name ? [p.name] : []))
    .join(', ')

/**
 * Content waiting for an admin, oldest first: articles, courses and
 * publications submitted for review. Applications have their own page
 * (Admin → Applicants). Read from the documents themselves, so it is right
 * even when an email never arrives.
 */
export const getReviewQueue = async (payload: Payload): Promise<QueueItem[]> => {
  const local = { depth: 1, pagination: false, overrideAccess: true } as const
  const reviewed = await Promise.all(
    REVIEWED.map(async ({ kind, collection, owners }) => {
      // A change to a published document waits as its latest draft
      // (src/lib/review-hooks.ts), so it is found among the versions.
      const [{ docs }, { docs: versions }] = await Promise.all([
        payload.find({
          collection,
          where: { 'review.status': { equals: 'submitted' } },
          select: { title: true, updatedAt: true, review: true, [owners]: true },
          populate: { people: { name: true } },
          ...local,
        }),
        payload.findVersions({
          collection,
          where: {
            and: [
              { latest: { equals: true } },
              { 'version.review.status': { equals: 'submitted' } },
            ],
          },
          populate: { people: { name: true } },
          ...local,
        }),
      ])
      const waiting = new Map<number, Record<string, unknown>>()
      for (const v of versions) {
        const ref = v.parent as unknown as number | { id: number }
        const parent = relId(ref)
        waiting.set(parent, { ...(v.version as unknown as Record<string, unknown>), id: parent })
      }
      for (const d of docs) waiting.set(d.id, d as unknown as Record<string, unknown>)
      return [...waiting.values()].map((d): QueueItem => {
        const title = (d.title as string | null | undefined) || `Untitled ${kind}`
        const removal = (d.review as { request?: string } | null)?.request === 'removal'
        return {
          kind,
          id: d.id as number,
          title: removal ? `Remove from the site: ${title}` : title,
          by: namesOf(d[owners]),
          since: d.updatedAt as string,
          href: `/admin/collections/${collection}/${d.id}`,
        }
      })
    }),
  )
  return reviewed.flat().sort((a, b) => a.since.localeCompare(b.since))
}
