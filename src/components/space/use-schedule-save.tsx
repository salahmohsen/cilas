import { useState, type ReactNode } from 'react'

import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import { scheduleOffers } from '@/actions/schedule-offers'
import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { preloadable } from '@/lib/preloadable'
import type { ScheduleOffer } from '@/lib/schedule-offer'

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
 * The one way a host saves schedule changes and tells people (ADR 0011,
 * "Saving and telling people"): `saveCalendarChanges` on the host's parent,
 * then, when the save changed what counts (`scheduleChanges` on the server),
 * the step 3 announcement dialog for the course's spaces. A failed save
 * offers nothing; a stale one keeps the changes and offers "Reload and lose
 * my changes", which runs `reload`. The host renders `dialog` and `failed`.
 */
export function useScheduleSave({
  parent,
  courseId,
  locale,
  language,
  text,
  reload,
}: {
  /** The calendar's parent, as `saveCalendarChanges` takes it. */
  parent: { kind: string; id: string }
  courseId: string
  /** The language the items are read in. */
  locale: string
  /** The page's language, for the dialog. */
  language: 'en' | 'ar'
  text: ScheduleSaveText
  reload: () => void
}) {
  const [offered, setOffered] = useState<{ offers: ScheduleOffer[]; returnTo: ReturnTo } | null>(
    null,
  )
  const [failed, setFailed] = useState(false)

  /** Offers an announcement when `before` and `after` differ in what counts; nothing when they do not. */
  const offer = (before: CalendarItem[], after: CalendarItem[], returnTo: ReturnTo) => {
    setFailed(false)
    scheduleOffers({ courseId, before: changeable(before), after: changeable(after) }, locale).then(
      (offers) => setOffered(offers.length ? { offers, returnTo } : null),
      (error: unknown) => {
        console.error('schedule offer failed', error)
        setFailed(true)
      },
    )
  }

  /**
   * Saves `changes`; resolves to the items as saved, or rejects with what the
   * calendar shows. `before` is what the calendar showed: the items as last
   * loaded or saved.
   */
  const save = async (
    changes: CalendarChange[],
    before: CalendarItem[],
    returnTo: ReturnTo,
  ): Promise<CalendarItem[]> => {
    const result = await saveCalendarChanges({ parent, changes }, locale)
    if (!result.ok) {
      if (result.error.code === 'stale')
        throw new CalendarSaveRefusal(text.errorText(result.error), {
          label: text.reloadAndLose,
          then: reload,
        })
      throw new SaveRefused(text.errorText(result.error))
    }
    offer(before, result.items, returnTo)
    return result.items
  }

  const dialog: ReactNode = offered ? (
    <ScheduleOfferDialog
      offers={offered.offers}
      labels={text.offerLabels}
      locale={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      onClose={() => setOffered(null)}
      returnFocus={offered.returnTo}
    />
  ) : null

  return {
    save,
    offer,
    /** Loads the dialog's code, for when Save is about to be pressed. */
    preload: ScheduleOfferDialog.preload,
    /** The schedule saved, and the offer could not load. */
    failed,
    dialog,
  }
}
