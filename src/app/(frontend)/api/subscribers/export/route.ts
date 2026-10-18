import config from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import { isAdminUser } from '@/access'
import { env } from '@/env'
import { contactsCsv, listContacts } from '@/lib/resend-contacts'

/**
 * The newsletter list as a CSV download, for admins (Subscribers view).
 * Mailchimp's import columns; `?all=1` adds the unsubscribed with a Status.
 */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!isAdminUser(user)) return new Response('Admins only', { status: 403 })
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    return new Response('The newsletter list is off: RESEND_API_KEY or RESEND_AUDIENCE_ID is not set.', {
      status: 503,
    })
  }
  const all = new URL(request.url).searchParams.get('all') === '1'
  const contacts = await listContacts(env.RESEND_API_KEY, env.RESEND_AUDIENCE_ID)
  const day = new Date().toISOString().slice(0, 10)
  return new Response(contactsCsv(contacts, { all }), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cilas-subscribers-${all ? 'all-' : ''}${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
