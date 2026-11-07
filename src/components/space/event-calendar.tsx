'use client'

import { useTranslations } from 'next-intl'
import { CalendarPlus, Download, ExternalLink } from 'lucide-react'

import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { track } from '@/lib/analytics/track'
import { openNewTab } from '@/lib/open-new-tab'

/**
 * "Add to calendar": a prefilled Google Calendar page, or an .ics file any
 * calendar app opens. An icon in the Space event card; with `labelled`, the
 * words and the icon, as in the public event's side card. Without a Google
 * link (a date with no time), only the file.
 */
export function EventCalendar({
  google,
  ics,
  labelled = false,
}: {
  google?: string | null
  ics: string
  labelled?: boolean
}) {
  const t = useTranslations('SpacePost')
  return (
    <DropdownMenu
      label={t('calendarAdd')}
      icon={<CalendarPlus size={18} aria-hidden="true" />}
      iconOnly={!labelled}
      items={[
        ...(google
          ? [
              {
                label: t('calendarGoogle'),
                icon: <ExternalLink size={15} />,
                onSelect: () => {
                  track('calendar_added', { source: 'event-google' })
                  openNewTab(google)
                },
              },
            ]
          : []),
        {
          label: t('calendarIcs'),
          icon: <Download size={15} />,
          onSelect: () => {
            track('calendar_added', { source: 'event-ics' })
            window.location.assign(ics)
          },
        },
      ]}
    />
  )
}
