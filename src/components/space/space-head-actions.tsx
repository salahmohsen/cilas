'use client'

import { useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, ChartColumn, Info, Settings } from 'lucide-react'

import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { ButtonGroup, type ButtonGroupItem } from '@/components/arc/button-group/button-group'
import type { Participation } from '@/lib/spaces-data'

import { ParticipationDialog } from './participation-dialog'
import { SpaceSettings } from './space-settings'
import styles from './space.module.css'

type Panel = 'about' | 'participation' | 'settings'
type SettingsProps = Omit<ComponentProps<typeof SpaceSettings>, 'open' | 'onOpenChange' | 'anchor'>

/**
 * The space head's actions as one group: the course page, About (phones, where
 * the rail is not shown), and for moderators the participation numbers and the settings.
 */
export function SpaceHeadActions({
  coursePage,
  rail,
  participation,
  now,
  settings,
}: {
  coursePage: string | null
  /** The rail, shown in a sheet on narrow screens */
  rail: ReactNode
  participation: Participation | null
  now: string
  settings: SettingsProps | null
}) {
  const t = useTranslations('Spaces')
  const tp = useTranslations('Participation')
  const [open, setOpen] = useState<Panel | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // The segments are not Radix triggers, so focus comes back to the one that opened the panel,
  // unless the reader has already moved on to something else.
  const change = (panel: Panel, next: boolean) => {
    setOpen(next ? panel : null)
    if (next) return
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const segments = root.current?.querySelectorAll<HTMLElement>(`[data-key="${panel}"]`) ?? []
      Array.from(segments)
        .find((segment) => segment.offsetParent !== null)
        ?.focus()
    })
  }

  const items = (phone: boolean) => {
    const list: ButtonGroupItem[] = []
    if (coursePage)
      list.push({
        id: 'course',
        label: t('coursePage'),
        icon: <BookOpen size={16} aria-hidden="true" />,
        href: coursePage,
      })
    if (phone)
      list.push({
        id: 'about',
        label: t('about'),
        icon: <Info size={16} aria-hidden="true" />,
        onSelect: () => setOpen('about'),
      })
    if (participation)
      list.push({
        id: 'participation',
        label: tp('title'),
        icon: <ChartColumn size={16} aria-hidden="true" />,
        onSelect: () => setOpen('participation'),
      })
    if (settings)
      list.push({
        id: 'settings',
        label: t('settingsForModerator'),
        icon: <Settings size={16} aria-hidden="true" />,
        onSelect: () => setOpen('settings'),
      })
    return list
  }

  const group = (phone: boolean) => {
    const list = items(phone)
    return list.length > 0 ? (
      <ButtonGroup items={list} label={t('spaceActions')} size="sm" collapseLabels />
    ) : null
  }
  // Two groups, one per width, so the About segment is there only where the rail is not.
  const groups = (
    <div ref={root} className={styles.headButtons}>
      <span className={styles.phoneOnly}>{group(true)}</span>
      <span className={styles.wideOnly}>{group(false)}</span>
    </div>
  )

  return (
    <>
      {settings ? (
        <SpaceSettings
          {...settings}
          open={open === 'settings'}
          onOpenChange={(next) => change('settings', next)}
          anchor={groups}
        />
      ) : (
        groups
      )}
      <BottomSheet
        title={t('about')}
        detents={[0.6, 0.92]}
        open={open === 'about'}
        onOpenChange={(next) => change('about', next)}
      >
        <div className={styles.column}>{rail}</div>
      </BottomSheet>
      {participation && (
        <ParticipationDialog
          data={participation}
          now={now}
          open={open === 'participation'}
          onOpenChange={(next) => change('participation', next)}
        />
      )}
    </>
  )
}
