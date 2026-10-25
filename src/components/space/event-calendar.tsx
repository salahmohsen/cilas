'use client'

import { useTranslations } from 'next-intl'
import { CalendarPlus, Download, ExternalLink } from 'lucide-react'

import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'

/** "Add to calendar", an icon in the event card's corner: a prefilled Google Calendar page, or an .ics file any calendar app opens. */
export function EventCalendar({ google, ics }: { google: string; ics: string }) {
  const t = useTranslations('SpacePost')
  return (
    <DropdownMenu
      label={t('calendarAdd')}
      icon={<CalendarPlus size={18} aria-hidden="true" />}
      iconOnly
      items={[
        {
          label: t('calendarGoogle'),
          icon: <ExternalLink size={15} />,
          onSelect: () => window.open(google, '_blank', 'noopener,noreferrer'),
        },
        {
          label: t('calendarIcs'),
          icon: <Download size={15} />,
          onSelect: () => window.location.assign(ics),
        },
      ]}
    />
  )
}
