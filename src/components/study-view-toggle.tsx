'use client'

import { LayoutGrid, List } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ExpandingButtonGroup } from '@/components/arc/expanding-button-group/expanding-button-group'
import { type StudyView } from '@/lib/study-view'

/** Switches the study list between its list and its grid. */
export function StudyViewToggle({
  onChange,
  view,
}: {
  onChange: (view: StudyView) => void
  view: StudyView
}) {
  const t = useTranslations('Study.filters')
  return (
    <ExpandingButtonGroup
      className="study-view-toggle"
      defaultExpanded={view}
      items={[
        { id: 'list', label: t('viewList'), icon: <List aria-hidden /> },
        { id: 'grid', label: t('viewGrid'), icon: <LayoutGrid aria-hidden /> },
      ]}
      label={t('view')}
      onAction={(id) => onChange(id as StudyView)}
    />
  )
}
