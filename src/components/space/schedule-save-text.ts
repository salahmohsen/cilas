import { createTranslator, type AbstractIntlMessages } from 'next-intl'

import type { CalendarLabels } from '@/components/calendar/ui/calendar-labels'
import type { CalendarSaveError } from '@/lib/calendar-sources'
import { saveErrorKey } from '@/lib/space-rules'

import type en from '../../../messages/en.json'
import type { ScheduleOfferLabels } from './schedule-offer-dialog'

/** The messages the words come from; the site's and the admin's both hold them. */
export type ScheduleSaveMessages = {
  CalendarAdmin: (typeof en)['CalendarAdmin']
  /** The `saveError_*` words of `SpacePost`: why a post was not written. */
  SpacePost: Record<string, string>
}

/** The words a schedule save and its offer show, from what `useScheduleSave` needs. */
export type ScheduleSaveText = {
  /** A plain sentence for a save that did not happen. */
  errorText: (error: CalendarSaveError) => string
  /** The one button of a stale save. */
  reloadAndLose: string
  /** The schedule saved, and the offer could not load. */
  offerFailed: string
  offerLabels: ScheduleOfferLabels
}

/**
 * Every host that saves a schedule words it the same way: the admin's
 * `CalendarAdmin` messages and the post write path's `SpacePost` errors.
 * `calendar` is the host's own calendar words, for the offer's preview.
 */
export const scheduleSaveText = (
  locale: string,
  messages: ScheduleSaveMessages,
  calendar: CalendarLabels,
): ScheduleSaveText => {
  const t = createTranslator({ locale, messages, namespace: 'CalendarAdmin' })
  // Untyped: the error key is worked out at run time.
  const all: AbstractIntlMessages = messages
  const post = createTranslator({ locale, messages: all, namespace: 'SpacePost' })
  return {
    errorText: (error) => {
      switch (error.code) {
        case 'unauthenticated':
          return t('errors.unauthenticated')
        case 'forbidden':
          return t('errors.forbidden')
        case 'not-found':
          return t('errors.notFound')
        case 'stale':
          return t('errors.stale', { named: String(Boolean(error.name)), name: error.name ?? '' })
        case 'invalid':
          return t('errors.invalid', { message: error.message })
        case 'failed':
          return t('errors.failed')
      }
    },
    reloadAndLose: t('reloadAndLose'),
    offerFailed: t('offer.failed'),
    offerLabels: {
      title: t('offer.title'),
      oneSpace: (space) => t('offer.oneSpace', { space }),
      manySpaces: t('offer.manySpaces'),
      space: (space) => t('offer.space', { space }),
      text: t('offer.text'),
      includeCalendar: t('offer.includeCalendar'),
      publish: t('offer.publish'),
      publishing: t('offer.publishing'),
      skip: t('offer.skip'),
      close: t('offer.close'),
      publishFailed: (code) => t('offer.publishFailed', { reason: post(saveErrorKey(code)) }),
      calendar,
    },
  }
}
