'use client'

import { postCreateAction } from '@/lib/space-actions'

import { ScheduleOfferDialog, type ScheduleOfferDialogProps } from './schedule-offer-dialog'

/** The schedule offer dialog, publishing through the post write path's server action. */
export function ConnectedScheduleOfferDialog(props: Omit<ScheduleOfferDialogProps, 'publish'>) {
  return (
    <ScheduleOfferDialog {...props} publish={(form) => postCreateAction({ status: 'ok' }, form)} />
  )
}
