'use client'

import { useId, useState } from 'react'

import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarLabels } from '@/components/calendar/ui/calendar-labels'
import { RichField } from '@/components/rich-field'
import type { SpacesWriteState } from '@/lib/space-actions'
import type { ScheduleOffer } from '@/lib/schedule-offer'
import { withSchedule } from '@/lib/session-refs'

import styles from './schedule-offer.module.css'

/** Every word the dialog shows, in the host's language. */
export type ScheduleOfferLabels = {
  title: string
  /** Under the title when the dialog holds one space: where the announcement goes. */
  oneSpace: (space: string) => string
  /** An entry's heading when there are several. */
  space: (space: string) => string
  text: string
  includeCalendar: string
  publish: string
  publishing: string
  skip: string
  close: string
  /** Why a publish failed, from the post write path's error code. */
  publishFailed: (code: string) => string
  /** The preview calendar's words. */
  calendar: CalendarLabels
}

export type ScheduleOfferDialogProps = {
  offers: ScheduleOffer[]
  labels: ScheduleOfferLabels
  /** The host's language and direction, for the dialog and the preview's dates. */
  locale: string
  dir: 'ltr' | 'rtl'
  /** Every entry is published or skipped, or the dialog was closed. */
  onClose: () => void
  /** Where focus goes when the dialog closes. */
  returnFocus: () => HTMLElement | null
  /** Writes one announcement through the post write path, as the signed-in person. */
  publish: (form: FormData) => Promise<SpacesWriteState>
}

const NO_OPEN = () => {}

function Entry({
  offer,
  labels,
  locale,
  many,
  first,
  onDone,
  publish,
}: {
  offer: ScheduleOffer
  labels: ScheduleOfferLabels
  locale: string
  many: boolean
  first: boolean
  onDone: () => void
  publish: ScheduleOfferDialogProps['publish']
}) {
  const id = useId()
  const [text, setText] = useState({ markdown: offer.text, empty: !offer.text.trim() })
  const [include, setInclude] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const block = include ? offer.block : null
  const dir = offer.language === 'ar' ? 'rtl' : 'ltr'

  const send = async () => {
    setBusy(true)
    setError('')
    const form = new FormData()
    form.set('space', String(offer.space.id))
    form.set('kind', 'announcement')
    form.set('body', withSchedule(text.markdown, block))
    const result = await publish(form).catch(() => ({
      status: 'error' as const,
      error: 'failed' as const,
    }))
    setBusy(false)
    if (result.status === 'error') setError(labels.publishFailed(result.error))
    else onDone()
  }

  return (
    <section className={styles.entry} aria-labelledby={many ? `${id}-heading` : undefined}>
      {many ? (
        <h3 id={`${id}-heading`} className={styles.heading}>
          {labels.space(offer.space.name)}
        </h3>
      ) : null}
      <div lang={offer.language}>
        <RichField
          autoFocus={first}
          label={labels.text}
          dir={dir}
          minHeading={2}
          defaultMarkdown={offer.text}
          disabled={busy}
          onChange={(value) => setText({ markdown: value.markdown, empty: value.empty })}
        />
      </div>
      {offer.preview && offer.block ? (
        <>
          <Checkbox
            label={labels.includeCalendar}
            checked={include}
            disabled={busy}
            onCheckedChange={(checked) => setInclude(checked === true)}
          />
          {include ? (
            // A picture of the block, not a second calendar to use: the text says the same in words.
            <figure className={styles.preview} inert>
              <Calendar
                mode="view"
                view={many ? 'agenda' : undefined}
                items={offer.preview.items}
                marked={new Set(offer.preview.marked)}
                day={offer.preview.day}
                labels={labels.calendar}
                locale={locale}
                onOpen={NO_OPEN}
              />
            </figure>
          ) : null}
        </>
      ) : null}
      {error ? <Alert tone="danger" title={error} /> : null}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" disabled={busy} onClick={onDone}>
          {labels.skip}
        </Button>
        <Button
          type="button"
          loading={busy}
          disabled={text.empty && !block}
          onClick={() => void send()}
        >
          {busy ? labels.publishing : labels.publish}
        </Button>
      </div>
    </section>
  )
}

/**
 * The offer after a schedule save (ADR 0011, "Saving and telling people"):
 * for each space, a prefilled announcement to edit, the schedule block as a
 * preview with a box to leave it out, and Publish or Skip. Publish makes a
 * normal space announcement through the post write path, as the signed-in
 * person. With one space it is one plain dialog; with several, one entry
 * each. It closes when every entry is published or skipped.
 */
export function ScheduleOfferDialog({
  offers,
  labels,
  locale,
  dir,
  onClose,
  returnFocus,
  publish,
}: ScheduleOfferDialogProps) {
  const [done, setDone] = useState<ReadonlySet<number>>(new Set())
  const open = offers.filter((offer) => !done.has(offer.space.id))
  const many = offers.length > 1
  const finish = (space: number) => {
    const next = new Set(done).add(space)
    setDone(next)
    if (offers.every((offer) => next.has(offer.space.id))) onClose()
  }
  return (
    <Dialog
      open={open.length > 0}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className={`arc-scope ${styles.dialog}`}
        dir={dir}
        lang={locale}
        title={labels.title}
        description={many ? undefined : labels.oneSpace(offers[0]?.space.name ?? '')}
        closeLabel={labels.close}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()?.focus()
        }}
      >
        <div className={styles.entries}>
          {open.map((offer, index) => (
            <Entry
              key={offer.space.id}
              offer={offer}
              labels={labels}
              locale={locale}
              many={many}
              first={index === 0}
              onDone={() => finish(offer.space.id)}
              publish={publish}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
