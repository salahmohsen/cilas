import { MessagesSquare, Pencil } from 'lucide-react'
import { useLocale, useMessages, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { loadSessionView, type SessionViewResult } from '@/actions/load-session-view'
import { Alert } from '@/components/arc/alert/alert'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import button from '@/components/arc/button/button.module.css'
import { Drawer, DrawerContent, useDrawerItem } from '@/components/arc/drawer/drawer'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import { CourseSession, syllabusSessionOf } from '@/components/course/course-syllabus'
import { preloadable } from '@/lib/preloadable'

import { useScheduleLabels } from './schedule-calendar'
import { scheduleSaveText, type ScheduleSaveMessages } from './schedule-save-text'
import { sessionPostsHref, useSessionName } from './session-chip'
import styles from './space.module.css'
import { useScheduleOffer } from './use-schedule-save'

const SessionForm = preloadable(() => import('./session-form').then((m) => m.SessionForm), {
  name: 'SessionForm',
})

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
 * For the people who may edit the session, Edit swaps in its form; a save
 * that changes the meetings or Cancelled offers an announcement
 * (`useScheduleOffer`). `id` is the open session, or null while the drawer closes.
 */
export function SessionDrawer({
  id,
  startEditing = false,
  onClose,
  onCloseFocus,
}: {
  id: string | null
  /** Open on the Edit form, for the people who may edit; others get the view. */
  startEditing?: boolean
  onClose: () => void
  onCloseFocus: () => void
}) {
  const t = useTranslations('SpacePost')
  const te = useTranslations('SessionEdit')
  const { unitOf, nameOf } = useSessionName()
  const locale = useLocale()
  const language = locale === 'ar' ? 'ar' : 'en'
  const messages = useMessages()
  const router = useRouter()
  const phone = usePhone()
  // While the drawer slides out, it keeps showing the session it closed on.
  const shown = useDrawerItem(id)
  const [loaded, setLoaded] = useState<{ id: string; result: SessionViewResult } | null>(null)
  // Raised to read the session again: a retry, or after a save.
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!id) return
    let live = true
    void loadSessionView(id, locale).then(
      (result) => {
        if (live) setLoaded({ id, result })
      },
      () => {
        if (live) setLoaded({ id, result: { ok: false, error: 'failed' } })
      },
    )
    return () => {
      live = false
    }
  }, [id, locale, round])

  /** The session whose form is open; another session opens in view mode. */
  const [editing, setEditing] = useState<string | null>(null)
  /** While the form holds changes, how to ask before closing. */
  const [unsaved, setUnsaved] = useState<{ ask: (go: () => void) => void } | null>(null)
  const onUnsaved = useCallback(
    (ask: ((go: () => void) => void) | null) => setUnsaved(ask ? { ask } : null),
    [],
  )
  const edit = useRef<HTMLButtonElement>(null)
  const labels = useScheduleLabels()
  const text = useMemo(
    // The site's provider holds every message, these among them.
    () => scheduleSaveText(language, messages as ScheduleSaveMessages, labels),
    [language, messages, labels],
  )

  const result = loaded && loaded.id === shown ? loaded.result : null
  const offering = useScheduleOffer({
    courseId: result?.ok ? String(result.course.id) : '',
    locale,
    language,
    text,
  })
  const open = id != null
  const isEditing = result?.ok === true && result.canEdit && editing === shown
  const name =
    result?.ok === true
      ? nameOf({ n: result.session.number, title: result.session.session.title ?? null })
      : t('scheduleKind')
  // The drawer's heading names the session; the view under it leaves the title out.
  const heading =
    result?.ok === true
      ? result.session.session.title || unitOf({ n: result.session.number })
      : name

  // Another session, or a close by any way: the drawer opens next time in view mode, or as asked.
  const startOn = startEditing ? id : null
  useEffect(() => {
    setEditing(startOn)
    setUnsaved(null)
  }, [id, startOn])

  /** Back to the view, read again: it may be older than what the form showed. */
  const stopEditing = () => {
    setEditing(null)
    setUnsaved(null)
    setRound((n) => n + 1)
    requestAnimationFrame(() => edit.current?.focus())
  }

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
      <Alert tone="danger" title={t('sessionDrawerFailed')}>
        <div className={styles.sessionDrawerRetry}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoaded(null)
              setRound((n) => n + 1)
            }}
          >
            {t('sessionDrawerRetry')}
          </Button>
        </div>
      </Alert>
    )
  ) : isEditing ? (
    <SessionForm
      id={String(result.session.session.id)}
      untitled={unitOf({ n: result.session.number })}
      text={text}
      onUnsaved={onUnsaved}
      onCancel={stopEditing}
      onSaved={({ before, after }) => {
        stopEditing()
        // An open Calendar tab and the page's other server parts read it again.
        router.refresh()
        offering.offer(before, after, () => edit.current)
      }}
    />
  ) : (
    <div className={styles.sessionDrawer}>
      <div>
        <CourseSession
          course={result.course}
          sessions={[syllabusSessionOf(result.session)]}
          session={String(result.session.session.id)}
          label={name}
          plain
        />
        {offering.failed ? <Alert tone="danger" title={text.offerFailed} /> : null}
      </div>
      {(result.canEdit || result.spaceHref) && (
        <footer className={styles.sessionDrawerActions}>
          {result.canEdit && (
            <Button
              ref={edit}
              type="button"
              variant="secondary"
              onPointerEnter={SessionForm.preload}
              onFocus={SessionForm.preload}
              onPointerDown={() => {
                SessionForm.preload()
                offering.preload()
              }}
              onClick={() => setEditing(shown ?? null)}
            >
              <Pencil aria-hidden size={16} />
              {te('edit')}
            </Button>
          )}
          {result.spaceHref && (
            <a
              className={[button.button, button.primary, button.md, styles.sessionDrawerPosts].join(
                ' ',
              )}
              href={sessionPostsHref(result.spaceHref, String(result.session.session.id))}
            >
              <MessagesSquare aria-hidden size={16} />
              {t('sessionDrawerViewPosts')}
            </a>
          )}
        </footer>
      )}
    </div>
  )

  // The offer opens inside the drawer, so a click in it is not a click outside the drawer.
  const content = (
    <>
      {body}
      {offering.dialog}
    </>
  )

  const onOpenChange = (next: boolean) => {
    // Escape, the overlay, the close button and a swipe all ask first while the form holds changes.
    if (next) return
    if (isEditing && unsaved) unsaved.ask(onClose)
    else onClose()
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
        title={heading}
        description={t('sessionDrawerTimes')}
        closeLabel={t('sessionDrawerClose')}
        labels={{
          expand: t('sheetExpand'),
          collapse: t('sheetCollapse'),
          expanded: t('sheetExpanded'),
          collapsed: t('sheetCollapsed'),
          height: (percent) => t('sheetHeight', { percent }),
        }}
        onCloseAutoFocus={onCloseAutoFocus}
        // The form's footer needs the full height; the view opens lower.
        detents={isEditing ? [0.92] : [0.6, 0.92]}
      >
        {content}
      </BottomSheet>
    )
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={heading}
        description={t('sessionDrawerTimes')}
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('sessionDrawerClose')}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {content}
      </DrawerContent>
    </Drawer>
  )
}
