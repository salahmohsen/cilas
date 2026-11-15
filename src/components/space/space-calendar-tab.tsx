'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { Button } from '@/components/arc/button/button'
import type { CalendarItem } from '@/lib/calendar-items'
import { preloadable } from '@/lib/preloadable'

import { ScheduleCalendar } from './schedule-calendar'
import styles from './space-calendar-tab.module.css'

const SpaceCalendarEditor = preloadable(
  () => import('./space-calendar-editor').then((m) => m.SpaceCalendarEditor),
  { name: 'SpaceCalendarEditor' },
)

/**
 * The Calendar tab: view mode for everyone, in the server HTML; Edit, for
 * the people who may edit the sessions, swaps in the edit-mode calendar,
 * whose code loads only then. Done brings back view mode with what was saved.
 */
export function SpaceCalendarTab({
  spaceId,
  courseId,
  items: loaded,
  canEdit,
  day,
  spaceHref,
}: {
  spaceId: string
  courseId: string
  items: CalendarItem[]
  canEdit: boolean
  day?: string
  spaceHref: string
}) {
  const t = useTranslations('Spaces')
  const [items, setItems] = useState(loaded)
  // A refresh after a save elsewhere (the session drawer) brings new items from the server.
  const [server, setServer] = useState(loaded)
  if (loaded !== server) {
    setServer(loaded)
    setItems(loaded)
  }
  const [editing, setEditing] = useState(false)
  const edit = useRef<HTMLButtonElement>(null)

  if (editing)
    return (
      <SpaceCalendarEditor
        spaceId={spaceId}
        courseId={courseId}
        items={items}
        day={day}
        spaceHref={spaceHref}
        onItems={setItems}
        onDone={() => {
          setEditing(false)
          requestAnimationFrame(() => edit.current?.focus())
        }}
      />
    )

  return (
    <div className={styles.tab}>
      {canEdit ? (
        <div className={styles.actions}>
          <Button
            ref={edit}
            type="button"
            variant="secondary"
            size="sm"
            onPointerEnter={SpaceCalendarEditor.preload}
            onFocus={SpaceCalendarEditor.preload}
            onPointerDown={SpaceCalendarEditor.preload}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden size={14} />
            {t('calendarEdit')}
          </Button>
        </div>
      ) : null}
      <ScheduleCalendar items={items} day={day} spaceHref={spaceHref} />
    </div>
  )
}
