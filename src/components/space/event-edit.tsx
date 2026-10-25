'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Input } from '@/components/arc/input/input'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { eventEditAction } from '@/app/(frontend)/[locale]/spaces/actions'
import { EVENT_TITLE_MAX } from '@/lib/space-post-kinds'

import { saveErrorKey } from './composer'
import { EventFields, endsEarly, eventFormData, type EventValue } from './event-fields'
import styles from './space.module.css'

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
  words,
  schedule,
  open,
  onOpenChange,
}: {
  post: number
  initial: EventEditInitial
  /** The author's own name and description */
  words: boolean
  /** The place, time and cover: not once the event is over */
  schedule: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
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
  const [description, setDescription] = useState(initial.description)
  const [error, setError] = useState<string | null>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue(fresh())
          setTitle(initial.title)
          setDescription(initial.description)
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent title={t('eventEdit')} description={schedule ? t('eventEditHint') : undefined}>
        <div className={styles.column}>
          {words && (
            <>
              <Input
                label={t('eventTitle')}
                value={title}
                maxLength={EVENT_TITLE_MAX}
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
              <span className={styles.fieldLabel} aria-hidden="true">
                {t('eventDescription')}
              </span>
              <RichTextEditor
                aria-label={t('eventDescription')}
                placeholder={t('placeholder_event')}
                defaultMarkdown={initial.description}
                onChange={(v) => setDescription(v.empty ? '' : v.markdown)}
              />
            </>
          )}
          {schedule && (
            <EventFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              minDate={today}
            />
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div>
            <ActionButton
              label={t('saveEdit')}
              pendingLabel={t('saving')}
              successLabel={t('saved')}
              disabled={
                (words && (title.trim() === '' || description.trim() === '')) ||
                (schedule && (value.location.trim() === '' || !value.day || endsEarly(value)))
              }
              onAction={async () => {
                setError(null)
                const form = new FormData()
                form.set('post', String(post))
                // An event that is over keeps its schedule; the dialog sends it unchanged.
                eventFormData(schedule ? value : fresh(), form, initial.cover)
                if (words) {
                  form.set('title', title)
                  form.set('body', description)
                }
                const result = await eventEditAction({ status: 'ok' }, form).catch(
                  () => ({ status: 'error', error: 'failed' }) as const,
                )
                if (result.status === 'error') {
                  setError(t(saveErrorKey(result.error)))
                  throw new Error(result.error)
                }
                router.refresh()
                setTimeout(() => onOpenChange(false), 900)
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
