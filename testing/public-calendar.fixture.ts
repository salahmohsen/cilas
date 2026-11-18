import { createTranslator } from 'next-intl'

import { formatsOf } from '../src/i18n/formats'
import type { CalendarMeeting } from '../src/lib/calendar'

import ar from '../messages/ar.json'
import en from '../messages/en.json'

export const meeting = (over: Partial<CalendarMeeting>) =>
  ({
    key: 's1-2026-11-17-1900',
    item: 's1',
    kind: 'course',
    courseId: 22,
    sessionId: '501',
    title: 'Reading the city',
    href: '/study/reading-the-city',
    date: '2026-11-17',
    start: '19:00',
    end: '21:00',
    session: 3,
    type: 'thematic',
    place: 'Online',
    ...over,
  }) satisfies CalendarMeeting

export const words = (locale: 'en' | 'ar') => {
  const t = createTranslator({
    locale,
    messages: locale === 'ar' ? ar : en,
    formats: formatsOf(locale),
    namespace: 'Calendar',
  })
  return {
    locale,
    session: (n: number) => t('session', { n }),
    materials: (count: number) => t('sessionMaterials', { count }),
    activities: (count: number) => t('sessionActivities', { count }),
  }
}

export const meetings: CalendarMeeting[] = [
  meeting({
    cover: { url: '/media/city.jpg', alt: 'A street', focalX: 20, focalY: 80 },
  }),
  meeting({ key: 's1-2026-11-19-1900', date: '2026-11-19' }),
  meeting({ key: 's1-2026-11-21-1900', date: '2026-11-21', cancelled: true }),
  meeting({
    key: 'e4-0',
    item: 'e4',
    kind: 'event',
    courseId: undefined,
    sessionId: undefined,
    title: 'Film night',
    href: '/events/film-night',
    date: '2026-11-18',
    start: '18:00',
    end: '20:00',
    session: undefined,
    type: 'screening',
    place: undefined,
  }),
  meeting({
    key: 's7-2026-11-18-1000',
    item: 's7',
    type: 'core',
    title: 'Core seminar',
    date: '2026-11-18',
    start: '10:00',
    end: '12:00',
    session: 1,
  }),
]
