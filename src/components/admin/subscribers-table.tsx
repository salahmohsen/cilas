'use client'

import { Button } from '@payloadcms/ui'
import { useMemo, useState } from 'react'

import type { Contact } from '@/lib/resend-contacts'

const cell = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'start',
} as const

/** The list with a search box and the two CSV downloads (/api/subscribers/export). */
export function SubscribersTable({ contacts, list }: { contacts: Contact[]; list: number | null }) {
  const listQuery = list ? `list=${list}` : ''
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...contacts].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return q
      ? sorted.filter((c) =>
          [c.email, c.first_name, c.last_name].some((v) => v?.toLowerCase().includes(q)),
        )
      : sorted
  }, [contacts, query])

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          margin: '8px 0 16px',
        }}
      >
        <input
          aria-label="Search subscribers"
          placeholder="Search by email or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '8px 12px',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '4px',
            background: 'var(--theme-input-bg)',
            color: 'inherit',
          }}
        />
        <Button
          buttonStyle="primary"
          el="anchor"
          margin={false}
          url={`/api/subscribers/export${listQuery ? `?${listQuery}` : ''}`}
        >
          Export for Mailchimp (CSV)
        </Button>
        <Button
          buttonStyle="secondary"
          el="anchor"
          margin={false}
          url={`/api/subscribers/export?all=1${listQuery ? `&${listQuery}` : ''}`}
        >
          Export everyone, with status
        </Button>
      </div>
      <p style={{ color: 'var(--theme-elevation-500)', margin: '0 0 12px' }}>
        The Mailchimp file has only subscribed people: Mailchimp imports need their consent.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cell}>Email</th>
              <th style={cell}>Name</th>
              <th style={cell}>Since</th>
              <th style={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td style={cell}>{c.email}</td>
                <td style={cell} dir="auto">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                </td>
                <td style={cell}>{c.created_at.slice(0, 10)}</td>
                <td
                  style={{
                    ...cell,
                    color: c.unsubscribed ? 'var(--theme-elevation-500)' : 'inherit',
                  }}
                >
                  {c.unsubscribed ? 'Unsubscribed' : 'Subscribed'}
                </td>
              </tr>
            ))}
            {shown.length ? null : (
              <tr>
                <td colSpan={4} style={{ ...cell, color: 'var(--theme-elevation-500)' }}>
                  {contacts.length ? 'No one matches the search.' : 'No one has subscribed yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
