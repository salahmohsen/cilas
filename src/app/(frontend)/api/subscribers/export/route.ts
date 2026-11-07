import config from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import { isAdminUser } from '@/access'
import { LIST_OFF, mailingList, newsletterList } from '@/lib/newsletter-list'
import { contactsCsv, listContacts } from '@/lib/resend-contacts'

/**
 * The newsletter list as a CSV download, for admins (Subscribers view).
 * Mailchimp's import columns; `?all=1` adds the unsubscribed with a Status.
 */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!isAdminUser(user)) return new Response('Admins only', { status: 403 })
  const params = new URL(request.url).searchParams
  const asked = Number(params.get('list'))
  const list = asked ? await mailingList(payload, asked) : await newsletterList(payload)
  if (!list) return new Response(LIST_OFF, { status: 503 })
  const all = params.get('all') === '1'
  const contacts = await listContacts(list.segmentId)
  const day = new Date().toISOString().slice(0, 10)
  return new Response(contactsCsv(contacts, { all }), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cilas-${list.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${all ? 'all-' : ''}${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
