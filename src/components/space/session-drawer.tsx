import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { loadSessionView, type SessionViewResult } from '@/actions/load-session-view'
import { Alert } from '@/components/arc/alert/alert'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Drawer, DrawerContent, useDrawerItem } from '@/components/arc/drawer/drawer'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import { CourseSession, syllabusSessionOf } from '@/components/course/course-syllabus'

import { sessionPostsHref, useSessionName } from './session-chip'
import styles from './space.module.css'

/** Phones get a bottom sheet; wider screens a side drawer. Arc's drawer goes near full width below 40rem. */
const PHONE = '(max-width: 39.999rem)'
const subscribe = (change: () => void) => {
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', change)
  return () => query.removeEventListener('change', change)
}
const usePhone = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  )

/**
 * Loaded only through `session-drawer-host.tsx`, a client module.
 *
 * One course session in a drawer: the one session view (`CourseSession`),
 * loaded with the reader's own access, with a way to the posts about it.
 * `id` is the open session, or null while the drawer closes.
 */
export function SessionDrawer({
  id,
  onClose,
  onCloseFocus,
}: {
  id: string | null
  onClose: () => void
  onCloseFocus: () => void
}) {
  const t = useTranslations('SpacePost')
  const { nameOf } = useSessionName()
  const locale = useLocale()
  const phone = usePhone()
  // While the drawer slides out, it keeps showing the session it closed on.
  const shown = useDrawerItem(id)
  const [loaded, setLoaded] = useState<{ id: string; result: SessionViewResult } | null>(null)
  useEffect(() => {
    if (!id) return
    let live = true
    void loadSessionView(id, locale).then((result) => {
      if (live) setLoaded({ id, result })
    })
    return () => {
      live = false
    }
  }, [id, locale])

  const result = loaded && loaded.id === shown ? loaded.result : null
  const open = id != null
  const name =
    result?.ok === true
      ? nameOf({ n: result.session.number, title: result.session.session.title ?? null })
      : t('scheduleKind')

  const body: ReactNode = !result ? (
    <div role="status">
      <TextShimmer as="p" className={styles.meta}>
        {t('sessionDrawerLoading')}
      </TextShimmer>
    </div>
  ) : !result.ok ? (
    result.error === 'not-found' ? (
      <Alert tone="info" title={t('sessionGone')} />
    ) : (
      <Alert tone="danger" title={t('sessionDrawerFailed')} />
    )
  ) : (
    <div className={styles.sessionDrawer}>
      <CourseSession
        course={result.course}
        sessions={[syllabusSessionOf(result.session)]}
        session={String(result.session.session.id)}
        label={name}
      />
      <div className={styles.sessionDrawerActions}>
        {result.spaceHref && (
          <a
            className={styles.sessionPosts}
            href={sessionPostsHref(result.spaceHref, String(result.session.session.id))}
          >
            {t('sessionDrawerPosts')}
          </a>
        )}
        {/* Unit 5: the Edit button goes here, shown only when `result.canEdit`. */}
      </div>
    </div>
  )

  const onOpenChange = (next: boolean) => {
    if (!next) onClose()
  }
  const onCloseAutoFocus = (event: Event) => {
    // No Radix trigger: the opener is a calendar block, a syllabus link or a schedule block.
    event.preventDefault()
    onCloseFocus()
  }

  if (phone)
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={name}
        description={t('sessionDrawerTimes')}
        closeLabel={t('sessionDrawerClose')}
        onCloseAutoFocus={onCloseAutoFocus}
        detents={[0.6, 0.92]}
      >
        {body}
      </BottomSheet>
    )
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={name}
        description={t('sessionDrawerTimes')}
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('sessionDrawerClose')}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {body}
      </DrawerContent>
    </Drawer>
  )
}
