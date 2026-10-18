/**
 * The newsletter list, which lives in Resend (ADR 0005): contacts are global
 * to the account and grouped in segments; `RESEND_AUDIENCE_ID` holds the
 * newsletter's segment (Resend renamed Audiences to Segments in Nov 2025).
 */

const API = 'https://api.resend.com'

/**
 * The free Marketing plan's limit: broadcasts stop (403) once the account
 * stores more contacts than this. Broadcasts do not use the transactional
 * 100-a-day quota (resend.com/pricing).
 */
export const FREE_CONTACT_LIMIT = 1000

export type Contact = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  created_at: string
  unsubscribed: boolean
}

const request = async (apiKey: string, path: string, init: RequestInit = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...init.headers },
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

/**
 * Subscribes an address: creates the contact in the segment, or, when the
 * contact exists already, adds it to the segment and marks it subscribed
 * again (signing up is fresh consent).
 */
export const subscribe = async (apiKey: string, segmentId: string, email: string) => {
  const created = await request(apiKey, '/contacts', {
    method: 'POST',
    body: JSON.stringify({ email, unsubscribed: false, segments: [{ id: segmentId }] }),
  })
  if (created.ok) return true
  const contact = encodeURIComponent(email)
  const added = await request(apiKey, `/contacts/${contact}/segments/${segmentId}`, { method: 'POST' })
  if (!added.ok) return false
  await request(apiKey, `/contacts/${contact}`, { method: 'PATCH', body: JSON.stringify({ unsubscribed: false }) })
  return true
}

/** Every contact in the segment, 100 a page. */
export const listContacts = async (apiKey: string, segmentId: string): Promise<Contact[]> => {
  const contacts: Contact[] = []
  let after: string | undefined
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) })
    const { ok, status, body } = await request(apiKey, `/segments/${segmentId}/contacts?${query}`)
    if (!ok) throw new Error((body.message as string) ?? `Resend answered ${status}`)
    const data = (body.data as Contact[]) ?? []
    contacts.push(...data)
    if (!body.has_more || !data.length) break
    after = data.at(-1)!.id
  }
  return contacts
}

/** Contacts stored in the whole account: what the free plan's limit counts. */
export const accountContactCount = async (apiKey: string): Promise<number | null> => {
  const { ok, body } = await request(apiKey, '/segments/metrics?metrics=all_contacts')
  const total = (body.totals as { all_contacts?: number } | undefined)?.all_contacts
  return ok && typeof total === 'number' ? total : null
}

const cell = (value: string | null | undefined) => {
  const text = (value ?? '').replace(/\r?\n/g, ' ')
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The list as CSV in Mailchimp's import columns. By default only subscribed
 * contacts, as Mailchimp imports need consent; `all` adds the others with a
 * Status column, for CILAS's own records.
 */
export const contactsCsv = (contacts: Contact[], { all = false }: { all?: boolean } = {}) => {
  const rows = (all ? contacts : contacts.filter((c) => !c.unsubscribed)).map((c) =>
    [
      cell(c.email),
      cell(c.first_name),
      cell(c.last_name),
      cell(c.created_at?.slice(0, 10)),
      ...(all ? [c.unsubscribed ? 'unsubscribed' : 'subscribed'] : []),
    ].join(','),
  )
  const header = ['Email Address', 'First Name', 'Last Name', 'Subscribed At', ...(all ? ['Status'] : [])].join(',')
  // A byte-order mark, so Excel reads Arabic names as UTF-8.
  return `﻿${[header, ...rows].join('\r\n')}\r\n`
}
