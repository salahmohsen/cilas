'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Input } from '@/components/arc/input/input'
import { eventEditAction } from '@/lib/space-actions'
import { EVENT_TITLE_MAX } from '@/lib/space-rules'

import { PostEditForm, type PostEditContext } from './post-edit-form'
import styles from './space.module.css'
import { EventFields, endsEarly, eventFormData, type EventValue } from './event-fields'

/** An event as its edit dialog opens: Cairo day as YYYY-MM-DD, times as HH:MM, the cover's address. */
export type EventEditInitial = {
  title: string
  description: string
  location: string
  day: string
  time: string
  endTime: string | null
  cover: string | null
}

/**
 * The one edit of an event post, opened from the post's menu. The author
 * changes the name and the description; the author and a moderator change the
 * place, the time and the cover until the event is over. Members who answered
 * are told of a new time or place.
 */
export function EventEditDialog({
  post,
  initial,
  editor,
  words,
  schedule,
  open,
  onOpenChange,
}: {
  post: number
  editor: PostEditContext
  initial: EventEditInitial
  words: boolean
  /** The place, time and cover: not once the event is over */
  schedule: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('SpacePost')
  const fresh = (): EventValue => {
    const [y = 0, m = 1, d = 1] = initial.day.split('-').map(Number)
    return {
      location: initial.location,
      day: new Date(y, m - 1, d),
      time: initial.time,
      endTime: initial.endTime,
      cover: { file: null, url: initial.cover },
    }
  }
  const [value, setValue] = useState<EventValue>(fresh)
  const [title, setTitle] = useState(initial.title)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        chrome={false}
        className={styles.editDialog}
        title={t('eventEdit')}
        description={schedule ? t('eventEditHint') : undefined}
      >
        <PostEditForm
          post={post}
          initialBody={initial.description}
          context={editor}
          label={t('eventDescription')}
          placeholder={t('placeholder_event')}
          words={words}
          ready={
            (!words || title.trim() !== '') &&
            (!schedule || (value.location.trim() !== '' && !!value.day && !endsEarly(value)))
          }
          uploadBytes={value.cover.file?.size ?? 0}
          before={
            words && (
              <Input
                label={t('eventTitle')}
                value={title}
                maxLength={EVENT_TITLE_MAX}
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
            )
          }
          onCancel={() => onOpenChange(false)}
          onSave={async (form) => {
            eventFormData(schedule ? value : fresh(), form, initial.cover)
            if (words) form.set('title', title)
            return eventEditAction({ status: 'ok' }, form)
          }}
        >
          {schedule && (
            <EventFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              minDate={today}
            />
          )}
        </PostEditForm>
      </DialogContent>
    </Dialog>
  )
}
