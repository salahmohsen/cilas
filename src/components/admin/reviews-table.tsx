'use client'

import Link from 'next/link'

import { Badge } from '@/components/arc/badge/badge'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import {
  SortableDataTable,
  type DataColumn,
} from '@/components/arc/sortable-data-table/sortable-data-table'

import { reviewsCopy } from './reviews-copy'
import styles from './reviews.module.css'

/** One queue item, with the text the server already put in the reader's language. */
export type ReviewRow = {
  key: string
  kind: string
  title: string
  removal: boolean
  by: string
  /** ISO date: sorts in time order. */
  since: string
  waited: string
  href: string
}

/** The review queue, for Admin → Reviews and the dashboard box. */
export function ReviewsTable({ rows, ar }: { rows: ReviewRow[]; ar: boolean }) {
  const t = reviewsCopy(ar)
  if (!rows.length) return <EmptyState title={t.emptyTitle} description={t.emptyBody} />
  const columns: DataColumn<ReviewRow>[] = [
    {
      key: 'title',
      label: t.columns.title,
      sortable: true,
      render: (_, row) => (
        <span className={styles.titleCell}>
          <Link href={row.href} dir="auto">
            {row.title}
          </Link>
          {row.removal ? (
            <Badge tone="warning" size="sm">
              {t.removal}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'kind',
      label: t.columns.kind,
      sortable: true,
      render: (value) => <Badge size="sm">{String(value)}</Badge>,
    },
    {
      key: 'by',
      label: t.columns.by,
      sortable: true,
      render: (value) => <span dir="auto">{String(value)}</span>,
    },
    {
      key: 'since',
      label: t.columns.since,
      sortable: true,
      render: (_, row) => <time dateTime={row.since}>{row.waited}</time>,
    },
  ]
  return (
    <SortableDataTable
      rows={rows}
      columns={columns}
      rowKey="key"
      caption={t.caption}
      itemName={t.itemName}
      defaultSort={{ key: 'since', direction: 'asc' }}
    />
  )
}
