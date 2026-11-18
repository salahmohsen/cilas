import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { scheduleOffers } from '@/actions/schedule-offers'

import { useScheduleOfferWith, useScheduleSaveWith } from './use-schedule-save-with'

type OfferOptions = Omit<Parameters<typeof useScheduleOfferWith>[0], 'offers'>
type SaveOptions = Omit<Parameters<typeof useScheduleSaveWith>[0], 'offers' | 'save'>

/** The offer half of a schedule save, bound to the real server action. */
export const useScheduleOffer = (options: OfferOptions) =>
  useScheduleOfferWith({ ...options, offers: scheduleOffers })

/** The one save-then-offer of every host, bound to the real server actions. */
export const useScheduleSave = (options: SaveOptions) =>
  useScheduleSaveWith({ ...options, save: saveScheduleEdits, offers: scheduleOffers })
