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

const modalSlug = 'leave-calendar-without-saving'

/**
 * Warns before leaving a page that holds calendar changes nobody saved. Payload
 * warns only for its own form (`LeaveWithoutSaving` reads the form's modified
 * state and takes nothing else), and the calendar must not mark the course
 * form modified: that would turn on the course's autosave. So this does what
 * Payload does, with the same words: a reload or closed tab asks the browser,
 * and a click on a link inside the admin opens Payload's confirmation.
 * While the course form is itself modified, Payload's own warning covers the
 * links, and a second modal would stack on it.
 */
export function LeaveWarning({ active }: { active: boolean }) {
  const { openModal, closeModal } = useModal()
  const { t } = useTranslation()
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()
  const courseModified = useFormModified()
  const destination = useRef<string | null>(null)

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const onClick = (event: MouseEvent) => {
      if (courseModified || event.defaultPrevented) return
      const anchor = (event.target as Element).closest('a')
      if (!anchor || anchor.download || anchor.target === '_blank') return
      if (event.metaKey || event.ctrlKey || event.shiftKey) return
      const target = new URL(anchor.href)
      const here = new URL(window.location.href)
      if (
        target.origin === here.origin &&
        target.pathname + target.search === here.pathname + here.search
      )
        return
      event.preventDefault()
      event.stopPropagation()
      destination.current = anchor.href
      openModal(modalSlug)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active, courseModified, openModal])

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
        const href = destination.current
        if (href) startRouteTransition(() => router.push(href))
      }}
    />
  )
}
