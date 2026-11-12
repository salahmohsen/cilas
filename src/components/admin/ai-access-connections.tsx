'use client'

import Link from 'next/link'

import { Badge } from '@/components/arc/badge/badge'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import {
  SortableDataTable,
  type DataColumn,
} from '@/components/arc/sortable-data-table/sortable-data-table'

import styles from './ai-access-guide.module.css'

/** One live connection, with dates the server already wrote out. */
export type ConnectionRow = {
  id: string
  person: string
  assistant: string
  /** ISO date: sorts in time order. */
  ends: string
  endsText: string
  href: string
}

/** Admin → AI access: who has an assistant connected now. */
export function ConnectionsTable({ rows }: { rows: ConnectionRow[] }) {
  if (!rows.length)
    return (
      <EmptyState
        title="No assistant is connected"
        description="When an administrator connects Claude or ChatGPT, they appear here."
      />
    )
  const columns: DataColumn<ConnectionRow>[] = [
    {
      key: 'person',
      label: 'Person',
      sortable: true,
      render: (_, row) => (
        <Link href={row.href} dir="auto" className={styles.cellLink}>
          {row.person}
        </Link>
      ),
    },
    {
      key: 'assistant',
      label: 'Assistant',
      sortable: true,
      render: (value) => <Badge size="sm">{String(value)}</Badge>,
    },
    {
      key: 'ends',
      label: 'Sign-in ends',
      sortable: true,
      render: (_, row) => <time dateTime={row.ends}>{row.endsText}</time>,
    },
  ]
  return (
    <SortableDataTable
      rows={rows}
      columns={columns}
      rowKey="id"
      caption="Connected assistants"
      itemName={{ one: 'connection', other: 'connections' }}
      defaultSort={{ key: 'ends', direction: 'asc' }}
    />
  )
}
