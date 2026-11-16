import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { loadSessionEdit } from '@/actions/session-edit'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Drawer, DrawerContent } from '@/components/arc/drawer/drawer'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import type { CalendarItem } from '@/lib/calendar-items'
import type { SessionDetailChange, SessionEdit } from '@/lib/session-edit'
import { useNarrow } from '@/lib/use-narrow'

import { SessionForm, type SessionFormStage } from './session-form'
import type { ScheduleSaveText } from './schedule-save-text'

export function ScheduleEditDrawer({
  item,
  actions,
  detail,
  text,
  contentLocale,
  onClose,
  onApply,
  onDelete,
}: {
  actions?: ReactNode
  item: CalendarItem
  detail?: SessionDetailChange
  text: ScheduleSaveText
  contentLocale: string
  onClose: () => void
  onApply: (values: SessionEdit, original: SessionEdit) => void
  onDelete: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('SessionEdit')
  const tp = useTranslations('SpacePost')
  const phone = useNarrow()
  const opener = useRef(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  )
  const [loaded, setLoaded] = useState<SessionEdit | null>(null)
  const [failed, setFailed] = useState(false)
  const [round, setRound] = useState(0)
  const [unsaved, setUnsaved] = useState<{ ask: (go: () => void) => void } | null>(null)
  useEffect(() => {
    let live = true
    setFailed(false)
    if (!item.version) {
      setLoaded({
        title: '',
        description: '',
        cancelled: false,
        bibliography: [],
        activities: [],
        meetings: [],
      })
      return
    }
    loadSessionEdit(item.id, contentLocale).then(
      (result) => {
        if (!live) return
        if (result.ok) setLoaded(result.values)
        else setFailed(true)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [item.id, item.version, contentLocale, round])
  const onUnsaved = useCallback(
    (ask: ((go: () => void) => void) | null) => setUnsaved(ask ? { ask } : null),
    [],
  )
  const [stage, setStage] = useState<SessionFormStage | undefined>()
  useEffect(() => {
    if (!loaded) return
    setStage({
      version: item.version,
      values: {
        ...loaded,
        ...(detail?.op === 'edit' ? detail.values : {}),
        meetings: item.blocks.map((block) => ({
          id: block.id,
          date: block.date,
          start_time: block.start_time ?? '',
          end_time: block.end_time ?? '',
        })),
      },
      apply: (values) => onApply(values, loaded),
      remove: onDelete,
    })
    // The host closes this drawer after Apply or Delete. Each mount has one form baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
  const content = failed ? (
    <Alert tone="danger" title={t('loadFailed')}>
      <Button type="button" onClick={() => setRound((n) => n + 1)}>
        {tp('sessionDrawerRetry')}
      </Button>
    </Alert>
  ) : stage ? (
    <SessionForm
      id={item.id}
      untitled={item.caption ?? item.title}
      text={text}
      contentLocale={contentLocale}
      stage={stage}
      onCancel={onClose}
      onSaved={() => {}}
      onUnsaved={onUnsaved}
    />
  ) : (
    <p role="status">{t('loading')}</p>
  )
  const onOpenChange = (open: boolean) => {
    if (!open) {
      if (unsaved) unsaved.ask(onClose)
      else onClose()
    }
  }
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault()
    opener.current?.focus()
  }
  if (phone)
    return (
      <BottomSheet
        open
        onOpenChange={onOpenChange}
        title={item.title}
        closeLabel={tp('sessionDrawerClose')}
        onCloseAutoFocus={onCloseAutoFocus}
        detents={[0.92]}
        className="arc-scope"
      >
        {actions}
        {content}
      </BottomSheet>
    )
  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent
        title={item.title}
        className="arc-scope"
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={tp('sessionDrawerClose')}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {actions}
        {content}
      </DrawerContent>
    </Drawer>
  )
}
