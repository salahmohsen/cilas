import config from '@payload-config'
import { getPayload } from 'payload'

import { getStudyIndex } from '@/api/study-index'
import { registrationStatus } from '@/lib/registration'

// What is open changes with deadlines, not requests: worked out every five minutes.
export const revalidate = 300

/**
 * Where "Apply" leads right now, for the site header: the study list filtered
 * to courses open for registration, else the Bridge application when only it
 * is open, else nowhere (`href: null`, and the header shows no Apply).
 * Paths come without the site language; the header adds it.
 */
export async function GET() {
  const courses = await getStudyIndex('en')
  if (courses.some((c) => c.facets.registration?.[0]?.value === 'open')) {
    return Response.json({ href: '/study?registration=open' })
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'programmes',
    where: { and: [{ kind: { equals: 'bridge' } }, { _status: { equals: 'published' } }] },
    sort: '-slug',
    limit: 1,
    depth: 0,
    select: { registration: true },
  })
  const bridge = docs[0]
  if (bridge && registrationStatus(bridge.registration) === 'open') {
    return Response.json({ href: '/study/bridge/apply' })
  }
  return Response.json({ href: null })
}
