import { useTranslations } from 'next-intl'

import { FeedFilter } from './feed-filter'

export function SpaceViews({
  path,
  value,
  hasCourse,
}: {
  path: string
  value: string
  hasCourse: boolean
}) {
  const t = useTranslations('Spaces')
  return (
    <FeedFilter
      path={path}
      value={value}
      label={t('filterLabel')}
      options={[
        { value: 'all', label: t('all') },
        { value: 'announcements', label: t('announcements') },
        ...(hasCourse
          ? [
              { value: 'syllabus', label: t('syllabus') },
              { value: 'calendar', label: t('calendar') },
            ]
          : []),
        { value: 'events', label: t('events') },
      ]}
    />
  )
}
