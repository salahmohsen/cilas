import type { Payload } from 'payload'

export type QueueKind = 'article' | 'course' | 'publication' | 'application'

/** One thing waiting for an admin: a submission to review, or an application to decide. */
export type QueueItem = {
  kind: QueueKind
  id: number
  title: string
  /** Who sent it, as their names read. */
  by: string
  /** When it was sent (its last save), ISO. */
  since: string
  href: string
}

const REVIEWED = [
  { kind: 'article', collection: 'articles', owners: 'authors' },
  { kind: 'course', collection: 'courses', owners: 'fellows' },
  { kind: 'publication', collection: 'publications', owners: 'editors' },
] as const

const namesOf = (people: unknown) =>
  ((people as Array<{ name?: string } | number> | null | undefined) ?? [])
    .flatMap((p) => (typeof p === 'object' && p?.name ? [p.name] : []))
    .join(', ')

/**
 * Everything waiting for an admin, oldest first: articles, courses and
 * publications submitted for review, and applications not yet accepted or
 * rejected. Read from the documents themselves, so it is right even when an
 * email never arrives.
 */
export const getReviewQueue = async (payload: Payload): Promise<QueueItem[]> => {
  const local = { depth: 1, pagination: false, overrideAccess: true } as const
  const [reviewed, applications] = await Promise.all([
    Promise.all(
      REVIEWED.map(async ({ kind, collection, owners }) => {
        const { docs } = await payload.find({
          collection,
          where: { 'review.status': { equals: 'submitted' } },
          select: { title: true, updatedAt: true, [owners]: true },
          populate: { people: { name: true } },
          ...local,
        })
        return docs.map((d): QueueItem => ({
          kind,
          id: d.id,
          title: (d as { title?: string | null }).title || `Untitled ${kind}`,
          by: namesOf((d as unknown as Record<string, unknown>)[owners]),
          since: d.updatedAt,
          href: `/admin/collections/${collection}/${d.id}`,
        }))
      }),
    ),
    payload.find({
      collection: 'form-submissions',
      // Contact messages have no target; a polymorphic target cannot be queried for existence.
      where: { status: { equals: 'new' } },
      ...local,
    }),
  ])
  const sent = applications.docs
    .filter((s) => s.target?.value)
    .map((s): QueueItem => {
      const target = s.target?.value
      const what =
        typeof target === 'object' && target && 'title' in target ? target.title : 'an application'
      const name = s.submissionData?.find((a) => /name/i.test(a.field))?.value
      return {
        kind: 'application',
        id: s.id,
        title: `Application to ${what}`,
        by: name ?? '',
        since: s.createdAt,
        href: `/admin/collections/form-submissions/${s.id}`,
      }
    })
  return [...reviewed.flat(), ...sent].sort((a, b) => a.since.localeCompare(b.since))
}
