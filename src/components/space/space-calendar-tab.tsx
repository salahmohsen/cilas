'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, type ComponentProps, type ComponentType } from 'react'

import { Button } from '@/components/arc/button/button'
import type { CalendarItem } from '@/lib/calendar-items'
import { ScheduleCalendar } from './schedule-calendar'
import type { SpaceCalendarEditor } from './space-calendar-editor'
import styles from './space-calendar-tab.module.css'

export type SpaceCalendarEditorView = ComponentType<ComponentProps<typeof SpaceCalendarEditor>> & {
  preload: () => void
}

/**
 * The Calendar tab: view mode for everyone, in the server HTML; Edit, for
 * the people who may edit the sessions, swaps in the edit-mode calendar,
 * whose code loads only then. Done brings back view mode with what was saved.
 * The editor arrives as `Editor`: `connected-space-calendar-tab.tsx` binds
 * the lazy one, so this module holds no server action.
 */
export function SpaceCalendarTab({
  spaceId,
  courseId,
  items: loaded,
  canEdit,
  day,
  spaceHref,
  Editor,
}: {
  spaceId: string
  courseId: string
  items: CalendarItem[]
  canEdit: boolean
  day?: string
  spaceHref: string
  Editor: SpaceCalendarEditorView
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
      <Editor
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
      <ScheduleCalendar
        items={items}
        day={day}
        spaceHref={spaceHref}
        action={
          canEdit ? (
            <Button
              ref={edit}
              type="button"
              variant="secondary"
              size="sm"
              onPointerEnter={Editor.preload}
              onFocus={Editor.preload}
              onPointerDown={Editor.preload}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden size={14} />
              {t('calendarEdit')}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
