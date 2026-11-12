'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { SearchField } from '@/components/arc/search-field/search-field'
import {
  SortableDataTable,
  type DataColumn,
} from '@/components/arc/sortable-data-table/sortable-data-table'
import type { Contact } from '@/lib/resend-contacts'

import { subscribersCopy } from './subscribers-copy'
import styles from './subscribers.module.css'

type Row = {
  id: string
  email: string
  name: string
  /** ISO date: sorts in time order. */
  since: string
  status: string
  unsubscribed: boolean
}

/** The list with a search field and the two CSV downloads (/api/subscribers/export). */
export function SubscribersTable({
  contacts,
  list,
  ar,
}: {
  contacts: Contact[]
  list: number
  ar: boolean
}) {
  const t = subscribersCopy(ar)
  const [query, setQuery] = useState('')
  const rows = useMemo(
    () =>
      contacts.map((c): Row => ({
        id: c.id,
        email: c.email,
        name: [c.first_name, c.last_name].filter(Boolean).join(' '),
        since: c.created_at,
        status: c.unsubscribed ? t.unsubscribed : t.subscribed,
        unsubscribed: c.unsubscribed,
      })),
    [contacts, t.subscribed, t.unsubscribed],
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => [r.email, r.name].some((v) => v.toLowerCase().includes(q))) : rows
  }, [rows, query])

  if (!contacts.length) return <EmptyState title={t.emptyTitle} description={t.emptyBody} />

  const download = (all: boolean) => () =>
    window.location.assign(`/api/subscribers/export?${all ? 'all=1&' : ''}list=${list}`)
  const columns: DataColumn<Row>[] = [
    {
      key: 'email',
      label: t.columns.email,
      sortable: true,
      render: (value) => <span dir="ltr">{String(value)}</span>,
    },
    {
      key: 'name',
      label: t.columns.name,
      sortable: true,
      render: (value) => <span dir="auto">{String(value) || t.noName}</span>,
    },
    {
      key: 'since',
      label: t.columns.since,
      sortable: true,
      render: (value) => <time dateTime={String(value)}>{t.date(String(value))}</time>,
    },
    {
      key: 'status',
      label: t.columns.status,
      sortable: true,
      render: (value, row) => (
        <Badge tone={row.unsubscribed ? 'neutral' : 'success'} size="sm">
          {String(value)}
        </Badge>
      ),
    },
  ]

  return (
    <section className={styles.list} aria-label={t.caption}>
      <div className={styles.toolbar}>
        <SearchField
          label={t.search}
          labelHidden
          placeholder={t.searchPlaceholder}
          value={query}
          onValueChange={setQuery}
        />
        <div className={styles.exports}>
          <Button onClick={download(false)}>{t.exportMailchimp}</Button>
          <Button variant="secondary" onClick={download(true)}>
            {t.exportAll}
          </Button>
        </div>
      </div>
      <p className={styles.note}>{t.exportNote}</p>
      <SortableDataTable
        rows={shown}
        columns={columns}
        rowKey="id"
        caption={t.caption}
        itemName={t.itemName}
        emptyMessage={t.noMatch}
        defaultSort={{ key: 'since', direction: 'desc' }}
      />
    </section>
  )
}
