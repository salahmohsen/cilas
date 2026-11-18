import { useState, type ReactNode } from 'react'

import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import type { SessionDetailChange } from '@/lib/session-edit'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { preloadable } from '@/lib/preloadable'
import type { ScheduleOffer } from '@/lib/schedule-offer'

import { useScheduleActions } from './schedule-actions'
import type { ScheduleSaveText } from './schedule-save-text'

const ScheduleOfferDialog = preloadable(
  () => import('./schedule-offer-dialog').then((m) => m.ScheduleOfferDialog),
  { name: 'ScheduleOfferDialog' },
)

/** A save that did not happen, as the Error the calendar shows beside its Save button. */
class SaveRefused extends Error {}

/** Where focus goes when the offer closes. */
type ReturnTo = () => HTMLElement | null

/** Items a save can change: a `readOnly` item stays as it was, so it never counts as a change. */
const changeable = (items: readonly CalendarItem[]) => items.filter((item) => !item.readOnly)

/**
 * The offer half of a schedule save (ADR 0011, "Saving and telling people"):
 * given the course's items before and after a save, `scheduleChanges` on the
 * server decides what counts, and the step 3 announcement dialog opens for
 * the course's spaces; nothing opens when nothing counts. The host renders
 * `dialog` and `failed`.
 */
export function useScheduleOffer({
  courseId,
  locale,
  language,
  text,
}: {
  courseId?: string
  /** The language the items are read in. */
  locale: string
  /** The page's language, for the dialog. */
  language: 'en' | 'ar'
  text: ScheduleSaveText
}) {
  const { scheduleOffers, publishOffer } = useScheduleActions()
  const [offered, setOffered] = useState<{ offers: ScheduleOffer[]; returnTo: ReturnTo } | null>(
    null,
  )
  const [failed, setFailed] = useState(false)

  /**
   * Offers an announcement when `before` and `after` differ in what counts; nothing when they do not.
   * `course` is the course of the items, for a host that holds many.
   */
  const offer = (
    before: CalendarItem[],
    after: CalendarItem[],
    returnTo: ReturnTo,
    course = courseId,
  ) => {
    setFailed(false)
    scheduleOffers(
      { courseId: course, before: changeable(before), after: changeable(after) },
      locale,
    ).then(
      (offers) => setOffered(offers.length ? { offers, returnTo } : null),
      (error: unknown) => {
        console.error('schedule offer failed', error)
        setFailed(true)
      },
    )
  }

  const dialog: ReactNode = offered ? (
    <ScheduleOfferDialog
      offers={offered.offers}
      labels={text.offerLabels}
      locale={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      onClose={() => setOffered(null)}
      returnFocus={offered.returnTo}
      publish={publishOffer}
    />
  ) : null

  return {
    offer,
    /** Loads the dialog's code, for when Save is about to be pressed. */
    preload: ScheduleOfferDialog.preload,
    /** The schedule saved, and the offer could not load. */
    failed,
    dialog,
  }
}

/**
 * The one way a host saves schedule changes and tells people:
 * `saveScheduleEdits` on the host's parent, then the offer
 * (`useScheduleOffer`). A failed save offers nothing; a stale one keeps the
 * changes and offers "Reload and lose my changes", which runs `reload`. The
 * host renders `dialog` and `failed`.
 */
export function useScheduleSave({
  parent,
  reload,
  ...offerOptions
}: {
  /** The parent that owns these sessions. */
  parent: { kind: string; id: string }
  courseId?: string
  locale: string
  language: 'en' | 'ar'
  text: ScheduleSaveText
  reload: () => void
}) {
  const { saveScheduleEdits } = useScheduleActions()
  const offering = useScheduleOffer(offerOptions)
  const { locale, text } = offerOptions

  /**
   * Saves `changes`; resolves to the items as saved, or rejects with what the
   * calendar shows. `before` is what the calendar showed: the items as last
   * loaded or saved.
   */
  const save = async (
    changes: CalendarChange[],
    before: CalendarItem[],
    returnTo: ReturnTo,
    details: SessionDetailChange[] = [],
  ): Promise<CalendarItem[]> => {
    const result = await saveScheduleEdits({ calendar: { parent, changes }, details }, locale)
    if (!result.ok) {
      if (result.error.code === 'stale')
        throw new CalendarSaveRefusal(text.errorText(result.error), {
          label: text.reloadAndLose,
          then: reload,
        })
      throw new SaveRefused(text.errorText(result.error))
    }
    offering.offer(before, result.items, returnTo)
    return result.items
  }

  return { save, ...offering }
}
