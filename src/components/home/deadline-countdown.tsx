'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Countdown, type CountdownUnit } from '@/components/arc/countdown/countdown'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const UNITS: CountdownUnit[] = ['days', 'hours', 'minutes', 'seconds']

/**
 * The time left to register, in the page's language and digits. A deadline
 * day stays open until midnight in Cairo, as registration itself does.
 */
export function DeadlineCountdown({
  deadline,
  variant = 'compact',
  units = ['days', 'hours'],
}: {
  /** YYYY-MM-DD. */
  deadline: string
  variant?: 'large' | 'compact'
  units?: CountdownUnit[]
}) {
  const t = useTranslations('Home')
  const locale = useLocale()
  const names = Object.fromEntries(
    UNITS.map((u) => [u, [t.raw(`units.${u}`)[0], t.raw(`units.${u}`)[0]] as [string, string]]),
  )
  return (
    <Countdown
      completeLabel={t('closed')}
      label={t('closesIn')}
      names={names}
      numerals={locale === 'ar' ? ARABIC_DIGITS : undefined}
      speak={(count, unit) => t('unitSpoken', { count, unit })}
      target={`${deadline}T23:59:59`}
      timeZone="Africa/Cairo"
      units={units}
      variant={variant}
    />
  )
}
