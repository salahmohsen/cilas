'use client'

import { useState } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

const kindLabel = (kind: string) => (kind === 'session' ? 'Session' : 'Event')

type Props = {
  items: CalendarItem[]
  locale: string
  initialMode: 'view' | 'edit'
  failSave: boolean
  phone: boolean
}

export function CalendarDev({ items, locale, initialMode, failSave, phone }: Props) {
  const [mode, setMode] = useState(initialMode)
  const [opened, setOpened] = useState('Nothing opened yet')
  const [saved, setSaved] = useState<CalendarChange[] | null>(null)
  const labels = useCalendarLabels({ kind: kindLabel, newItem: 'New session' })

  return (
    <main
      className="page-frame"
      style={{ display: 'grid', gap: 'var(--space-4)', paddingBlock: 'var(--space-6)' }}
    >
      <SegmentedControl
        label="Mode"
        value={mode}
        onValueChange={(value) => setMode(value as 'view' | 'edit')}
        options={[
          { value: 'view', label: 'View' },
          { value: 'edit', label: 'Edit' },
        ]}
      />
      <div style={{ inlineSize: phone ? 390 : undefined, maxInlineSize: '100%' }}>
        {mode === 'edit' ? (
          <Calendar
            items={items}
            mode="edit"
            labels={labels}
            locale={locale}
            newItemKind="session"
            onOpen={(itemId, blockId) => setOpened(`onOpen(${itemId}, ${blockId})`)}
            onSave={async (changes) => {
              await new Promise((resolve) => setTimeout(resolve, 400))
              if (failSave) throw new Error('The server said no (dev page ?fail=1).')
              setSaved(changes)
            }}
          />
        ) : (
          <Calendar
            items={items}
            mode="view"
            labels={labels}
            locale={locale}
            onOpen={(itemId, blockId) => setOpened(`onOpen(${itemId}, ${blockId})`)}
          />
        )}
      </div>
      <p
        data-testid="opened"
        style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}
      >
        {opened}
      </p>
      <pre
        data-testid="saved"
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          overflow: 'auto',
          maxHeight: '14rem',
        }}
      >
        {saved ? JSON.stringify(saved, null, 2) : 'Nothing saved yet'}
      </pre>
    </main>
  )
}
