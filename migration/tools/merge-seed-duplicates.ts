/**
 * One-off (2026-10-13): the dev seed used to enter the 2025–26 courses the
 * archive also imports (dropped from the seed in d2ade8a, never reset). Each
 * stale seed copy gives its archive twin what the twin lacks — start date,
 * weeks, Arabic title, course type, its unsuffixed slug — and is deleted.
 *
 *   npx tsx --env-file=.env migration/tools/merge-seed-duplicates.ts [--dry]
 */
import { getPayload } from 'payload'

const PAIRS: Array<[seed: number, archive: number]> = [
  [4, 98], [5, 100], [6, 99], [7, 101], [8, 102], [9, 309], [10, 311],
  [11, 310], [12, 308], [13, 307], [14, 195], [15, 194], [16, 193], [17, 196],
]
const dry = process.argv.includes('--dry')
const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })

type C = {
  id: number
  slug: string
  course_type: string
  title: { en?: string | null; ar?: string | null }
  schedule: Record<string, unknown> & { start_date?: string | null; weeks?: number | null }
}
const get = async (id: number) =>
  (await payload.findByID({ collection: 'courses', id, depth: 0, draft: true, locale: 'all', overrideAccess: true })) as unknown as C

const refs = await payload.find({ collection: 'redirects', where: { and: [{ 'to.reference.relationTo': { equals: 'courses' } }, { 'to.reference.value': { in: PAIRS.map((p) => p[0]) } }] }, depth: 0, limit: 100, overrideAccess: true })
if (refs.totalDocs) throw new Error(`redirects point at seed copies: ${refs.docs.map((d) => d.id).join(', ')}`)

for (const [seedId, archiveId] of PAIRS) {
  const seed = await get(seedId)
  const archive = await get(archiveId)
  const schedule = {
    ...archive.schedule,
    ...(archive.schedule.start_date ? {} : { start_date: seed.schedule.start_date }),
    ...(archive.schedule.weeks ? {} : { weeks: seed.schedule.weeks }),
  }
  const changes = {
    schedule,
    course_type: seed.course_type,
    ...(archive.title.ar || !seed.title.ar ? {} : { titleAr: seed.title.ar }),
  }
  console.log(`${seedId} → ${archiveId}: start ${schedule.start_date} weeks ${schedule.weeks} type ${seed.course_type} slug ${seed.slug}${'titleAr' in changes ? ` ar "${changes.titleAr}"` : ''}`)
  if (dry) continue
  await payload.delete({ collection: 'courses', id: seedId, overrideAccess: true })
  await payload.update({
    collection: 'courses', id: archiveId, draft: true, overrideAccess: true,
    data: { schedule, course_type: seed.course_type as 'THEMATIC', slug: seed.slug },
  })
  if ('titleAr' in changes) {
    await payload.update({ collection: 'courses', id: archiveId, locale: 'ar', draft: true, overrideAccess: true, data: { title: changes.titleAr } })
  }
  await payload.update({ collection: 'courses', id: archiveId, overrideAccess: true, data: { _status: 'published' } })
}
await payload.destroy()
process.exit(0)
