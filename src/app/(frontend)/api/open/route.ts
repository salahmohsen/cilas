import config from '@payload-config'
import { getPayload } from 'payload'

import { getOpenNow } from '@/api/home.api'

// What is open changes with deadlines, not requests: worked out every five minutes.
export const revalidate = 300

/**
 * Where "Apply" leads right now, for the site header: the Open for
 * registration page (/apply) while any programme or course is open, else
 * nowhere (`href: null`, and the header shows no Apply). Paths come without
 * the site language; the header adds it.
 */
export async function GET() {
  const open = await getOpenNow(await getPayload({ config }), 'en')
  return Response.json({ href: open.length ? '/apply' : null })
}
