'use client'

import {
  ConfirmationModal,
  useFormModified,
  useModal,
  useRouteTransition,
  useTranslation,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { guardLeaving } from '@/lib/leave-guard'

const modalSlug = 'leave-calendar-without-saving'

/**
 * Warns before leaving a page that holds calendar changes nobody saved. Payload
 * warns only for its own form (`LeaveWithoutSaving` reads the form's modified
 * state and takes nothing else), and the calendar must not mark the course
 * form modified: that would turn on the course's autosave. So this does what
 * Payload does, with the same words, through the site's one guard
 * (`lib/leave-guard.ts`): a reload or closed tab asks the browser, and a click
 * on a link inside the admin opens Payload's confirmation. While the course
 * form is itself modified, Payload's own warning asks, and a second modal
 * would stack on it.
 */
export function LeaveWarning({ active }: { active: boolean }) {
  const { openModal, closeModal } = useModal()
  const { t } = useTranslation()
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()
  const courseModified = useFormModified()
  const leaving = useRef<(() => void) | null>(null)

  useEffect(() => {
    // While the course form is modified, Payload's own warning asks.
    if (!active || courseModified) return
    return guardLeaving({
      ask: (go) => {
        leaving.current = go
        openModal(modalSlug)
      },
      navigate: (href) => startRouteTransition(() => router.push(href)),
    })
  }, [active, courseModified, openModal, router, startRouteTransition])

  return (
    <ConfirmationModal
      modalSlug={modalSlug}
      heading={t('general:leaveWithoutSaving')}
      body={t('general:changesNotSaved')}
      cancelLabel={t('general:stayOnThisPage')}
      confirmLabel={t('general:leaveAnyway')}
      onCancel={() => closeModal(modalSlug)}
      onConfirm={() => {
        closeModal(modalSlug)
        leaving.current?.()
        leaving.current = null
      }}
    />
  )
}
