'use client'

import { useTranslations } from 'next-intl'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { type StudyView } from '@/lib/study-view'

/** Switches the study list between its list and its grid. One press switches, on every input type. */
export function StudyViewToggle({
  onChange,
  view,
}: {
  onChange: (view: StudyView) => void
  view: StudyView
}) {
  const t = useTranslations('Study.filters')
  return (
    <SegmentedControl
      className="study-view-toggle"
      label={t('view')}
      onValueChange={(value) => onChange(value as StudyView)}
      options={[
        { value: 'list', label: t('viewList') },
        { value: 'grid', label: t('viewGrid') },
      ]}
      value={view}
    />
  )
}
