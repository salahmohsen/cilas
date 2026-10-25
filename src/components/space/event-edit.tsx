'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { eventEditAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { saveErrorKey } from './composer'
import { EventFields, endsEarly, eventFormData, type EventValue } from './event-fields'
import styles from './space.module.css'

/** The author's or a moderator's way to move an event or change its place; members who answered are told. */
export function EventEdit({
  post,
  initial,
}: {
  post: number
  /** Cairo day as YYYY-MM-DD, times as HH:MM */
  initial: { location: string; day: string; time: string; endTime: string | null }
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const fresh = (): EventValue => {
    const [y = 0, m = 1, d = 1] = initial.day.split('-').map(Number)
    return {
      location: initial.location,
      day: new Date(y, m - 1, d),
      time: initial.time,
      endTime: initial.endTime,
    }
  }
  const [value, setValue] = useState<EventValue>(fresh)
  const [error, setError] = useState<string | null>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setValue(fresh())
          setError(null)
          setOpen(true)
        }}
      >
        <Pencil size={15} aria-hidden="true" />
        {t('eventChange')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('eventChange')} description={t('eventChangeHint')}>
          <div className={styles.column}>
            <EventFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              minDate={today}
            />
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
                disabled={value.location.trim() === '' || !value.day || endsEarly(value)}
                onAction={async () => {
                  setError(null)
                  const form = new FormData()
                  form.set('post', String(post))
                  eventFormData(value, form)
                  const result = await eventEditAction({ status: 'ok' }, form).catch(
                    () => ({ status: 'error', error: 'failed' }) as const,
                  )
                  if (result.status === 'error') {
                    setError(t(saveErrorKey(result.error)))
                    throw new Error(result.error)
                  }
                  router.refresh()
                  setTimeout(() => setOpen(false), 900)
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
