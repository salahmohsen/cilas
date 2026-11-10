import type { PayloadRequest, TypedLocale } from 'payload'

export async function courseTitles(
  req: PayloadRequest,
  ids: number[],
  locale?: TypedLocale,
): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const { docs } = await req.payload.find({
    collection: 'courses',
    where: { id: { in: [...new Set(ids)] } },
    select: { title: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
    locale,
  })
  return new Map(docs.map((course) => [course.id, course.title]))
}
