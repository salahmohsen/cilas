import { useMemo, useState, type ReactNode } from 'react'

import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { preloadable } from '@/lib/preloadable'
import type { SessionDetailChange, SessionEdit } from '@/lib/session-edit'

import type { ScheduleSaveText } from './schedule-save-text'

const ScheduleEditDrawer = preloadable(() =>
  import('./schedule-edit-drawer').then((m) => m.ScheduleEditDrawer),
)

export function useScheduleDrafts(
  text: ScheduleSaveText,
  locale: string,
  actionsOf?: (item: CalendarItem) => ReactNode,
) {
  const [details, setDetails] = useState(new Map<string, SessionDetailChange>())
  const [opened, setOpened] = useState<CalendarItem | null>(null)
  const drafts = useMemo(
    () =>
      new Map(
        [...details].map(([id, detail]) => [
          id,
          detail.op === 'delete'
            ? null
            : {
                title: detail.values.title || undefined,
                summary: detail.values.description,
                cancelled: detail.values.cancelled,
              },
        ]),
      ),
    [details],
  )
  const put = (detail: SessionDetailChange) =>
    setDetails((previous) => new Map(previous).set(detail.id, detail))
  const close = () => setOpened(null)
  return {
    drafts,
    clear: () => setDetails(new Map()),
    changes: (calendar: CalendarChange[]) =>
      [...details.values()].filter(
        (detail) =>
          Boolean(detail.version) ||
          calendar.some((change) => change.op === 'create-item' && change.itemId === detail.id),
      ),
    open: (item: CalendarItem) => {
      ScheduleEditDrawer.preload()
      setOpened(item)
    },
    preload: ScheduleEditDrawer.preload,
    drawer: opened ? (
      <ScheduleEditDrawer
        key={opened.id}
        item={opened}
        actions={actionsOf?.(opened)}
        detail={details.get(opened.id)}
        text={text}
        contentLocale={locale}
        onClose={close}
        onApply={(values: SessionEdit, original: SessionEdit) => {
          const { meetings: _, ...fields } = values
          const { meetings: __, ...base } = original
          if (JSON.stringify(fields) === JSON.stringify(base))
            setDetails((previous) => {
              const next = new Map(previous)
              next.delete(opened.id)
              return next
            })
          else put({ op: 'edit', id: opened.id, version: opened.version, values: fields })
          close()
        }}
        onDelete={() => {
          put({ op: 'delete', id: opened.id, version: opened.version })
          close()
        }}
      />
    ) : null,
  }
}
