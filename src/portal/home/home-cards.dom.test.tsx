import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarMeeting } from '@/lib/calendar'
import { LiveRegion } from '@/portal/feedback/announce'
import type { NeedRow } from '@/portal/needs/sources'

import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'
import { CardBoundary } from './card-boundary'
import { GreetingBoundary } from './greeting-boundary'
import { HomeLoading } from './home-loading'
import { NeedsCard } from './needs-card'
import { NextSessionCard } from './next-session-card'
import { SpacesCard } from './spaces-card'
import { weekAgenda } from './week'
import { WeekCard } from './week-card'

afterEach(cleanup)

const work = (length: number) =>
  Array.from(
    { length },
    (_, index) =>
      ({
        kind: 'review',
        verbKey: 'needs.review',
        count: 1,
        collection: 'articles',
        href: `/admin/collections/articles/${index + 1}`,
        label: `Article ${index + 1}`,
        owners: [],
      }) satisfies NeedRow,
  )

it('groups Needs you at six rows, and keeps the same total in its heading', () => {
  const { rerender } = renderWithIntl(<NeedsCard result={{ rows: work(5), failed: [] }} />)
  expect(screen.getAllByRole('link')).toHaveLength(5)
  rerender(<NeedsCard result={{ rows: work(6), failed: [] }} />)
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Needs you6')
  expect(screen.getByRole('link', { name: /^Review 6 items / })).toHaveAttribute(
    'href',
    '/admin/reviews',
  )
})

it('shows no total when a source failed and keeps the rows that loaded', () => {
  renderWithIntl(<NeedsCard result={{ rows: work(1), failed: ['applicants'] }} />)
  expect(screen.getByRole('heading', { name: /^Needs you$/ })).toBeVisible()
  expect(screen.getByText('Some tasks could not load. Reload.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Review Article 1' })).toBeVisible()
})

it('writes the Cairo wall-clock time with Arabic digits', () => {
  renderWithIntl(
    <NextSessionCard
      session={{
        title: 'دراسة',
        sessionTitle: 'اللغة',
        date: '2034-10-05',
        start: '19:30',
        href: '/ar/spaces/course/study',
      }}
      view="student"
      browse={false}
      locale="ar"
    />,
    { locale: 'ar' },
  )
  const time = screen.getByText(/٧:٣٠/u)
  expect(time).toHaveAttribute('datetime', '2034-10-05T16:30:00.000Z')
  expect(time).not.toHaveTextContent(/[0-9]/)
  expect(screen.getByRole('link', { name: /اللغة/ })).toHaveAttribute(
    'href',
    '/ar/spaces/course/study',
  )
})

it.each([
  ['student', true, 'Browse spaces', '/en/spaces/community'],
  ['student', false, 'See open courses', '/en/study'],
  ['fellow', false, 'Open your courses', '/en/spaces/courses'],
  ['admin', false, 'Open the calendar', '/en/spaces/calendar'],
] as const)(
  'shows the next-session empty action for %s (can browse a community: %s)',
  (view, browse, label, href) => {
    renderWithIntl(<NextSessionCard session={null} view={view} browse={browse} locale="en" />)
    expect(screen.getByText('No sessions yet')).toBeVisible()
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    if (!browse) expect(screen.queryByRole('link', { name: 'Browse spaces' })).toBeNull()
  },
)

it('shows a session with no page to open as text, not a link', () => {
  renderWithIntl(
    <NextSessionCard
      session={{ title: 'Studio', date: '2034-10-05', href: null }}
      view="student"
      browse={false}
      locale="en"
    />,
  )
  expect(screen.getByText('Studio')).toBeVisible()
  expect(screen.queryByRole('link')).toBeNull()
})

const studio = {
  id: 1,
  label: 'Studio',
  cover: null,
  href: '/en/spaces/community/1',
  unread: 12,
  archived: false,
  kind: 'community',
  lastActivity: null,
} as const

it('uses the capped unread number and speaks it as part of the space name', () => {
  renderWithIntl(<SpacesCard spaces={[studio]} student locale="en" />)
  expect(screen.getByText('9+')).toBeVisible()
  expect(
    screen.getByRole('link', {
      name: 'Studio, more than 9 unread posts Community No posts yet',
    }),
  ).toBeVisible()
  expect(screen.getByRole('region', { name: 'All your spaces' })).toHaveAttribute('tabindex', '0')
})

it('leaves an empty slot when a space cover fails to load', () => {
  const { container } = renderWithIntl(
    <SpacesCard spaces={[{ ...studio, cover: '/assets/images/gone.jpg' }]} student locale="en" />,
  )
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
})

it('announces the loading Home in the region the shell mounted first', async () => {
  renderWithIntl(<LiveRegion />)
  const region = screen.getByRole('status')
  expect(region).toBeEmptyDOMElement()
  renderWithIntl(<HomeLoading />)
  expect(screen.getAllByRole('status')).toEqual([region])
  await waitFor(() => expect(region).toHaveTextContent('Loading Home'))
})

it('offers Retry for a failed card and leaves the other cards visible', () => {
  const FailedCard = () => {
    throw new Error('test card failure')
  }
  renderWithIntl(
    <>
      <CardBoundary slot="next">
        <FailedCard />
      </CardBoundary>
      <CardBoundary slot="latest">
        <p>{messagesOf.en.Portal.latest.empty}</p>
      </CardBoundary>
    </>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('This could not load.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  expect(screen.getByText(messagesOf.en.Portal.latest.empty)).toBeVisible()
})

it('keeps the page heading and the cards when the greeting fails', () => {
  const FailedGreeting = () => {
    throw new Error('test greeting failure')
  }
  renderWithIntl(
    <>
      <GreetingBoundary>
        <FailedGreeting />
      </GreetingBoundary>
      <CardBoundary slot="latest">
        <p>{messagesOf.en.Portal.latest.empty}</p>
      </CardBoundary>
    </>,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello.')
  expect(screen.getByText(messagesOf.en.Portal.latest.empty)).toBeVisible()
})

describe('This week', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2034-10-11T09:00:00Z'))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const meeting = (
    kind: CalendarMeeting['kind'],
    key: string,
    date: string,
    extra: Partial<CalendarMeeting> = {},
  ) => ({ key, item: key, kind, title: key, href: null, type: kind, date, ...extra }) as const

  const own = [
    meeting('course', 'Studio', '2034-10-11', {
      courseId: 7,
      session: 3,
      sessionTitle: 'Listening',
      start: '19:00',
      place: 'In person · Darb 1718',
      href: '/study/courses/studio',
    }),
    meeting('course', 'Archive', '2034-10-11', {
      courseId: 8,
      session: 2,
      start: '20:00',
      href: '/study/courses/archive',
    }),
    meeting('course', 'Draft', '2034-10-08', { courseId: 9, session: 1 }),
  ]
  const talks = [meeting('event', 'Open talk', '2034-10-12', { href: '/events/open-talk' })]
  const rooms = {
    courses: [{ space: { course: 7 }, href: '/en/spaces/course/studio' }],
  } as unknown as Parameters<typeof WeekCard>[0]['rooms']

  const card = (
    today = '2034-10-11',
    meetings: readonly CalendarMeeting[] = own,
    events: readonly CalendarMeeting[] = talks,
    locale: 'en' | 'ar' = 'en',
  ) => (
    <WeekCard
      week={weekAgenda(meetings, events, today)}
      today={today}
      rooms={rooms}
      locale={locale}
    />
  )

  const section = () => screen.getByRole('region', { name: 'This week' })
  const dayButtons = () =>
    within(within(section()).getByRole('group', { name: 'This week' })).getAllByRole('button')
  const pressedDay = () =>
    dayButtons().filter((button) => button.getAttribute('aria-pressed') === 'true')
  const currentDay = () => dayButtons().filter((button) => button.hasAttribute('aria-current'))
  const press = (name: RegExp) => fireEvent.click(within(section()).getByRole('button', { name }))
  const rows = () =>
    within(section())
      .queryAllByRole('listitem')
      .map((row) => within(row).getByRole('link'))
  const wake = (instant: string) => {
    vi.setSystemTime(new Date(instant))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  it('This week shows seven day buttons from Saturday, with today pressed and current', () => {
    renderWithIntl(card())
    expect(dayButtons().map((button) => button.textContent?.slice(0, 3))).toEqual([
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
    ])
    expect(pressedDay()).toEqual([dayButtons()[4]])
    expect(currentDay()).toEqual([dayButtons()[4]])
    expect(dayButtons()[4]).toHaveAttribute('aria-current', 'date')
    expect(within(section()).getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'href',
      '/en/spaces/calendar',
    )
  })

  it('a day button’s name is its visible day and its count', () => {
    renderWithIntl(card())
    expect(dayButtons()[0]).toHaveAccessibleName('Sat 7, no sessions or events')
    expect(dayButtons()[1]).toHaveAccessibleName('Sun 8, 1 session or event')
    expect(dayButtons()[4]).toHaveAccessibleName('Wed 11, 2 sessions or events')
  })

  it('choosing a day moves aria-pressed and shows only that day’s rows', () => {
    renderWithIntl(card())
    expect(rows().map((row) => row.getAttribute('href'))).toEqual([
      '/en/spaces/course/studio',
      '/en/study/courses/archive',
    ])
    expect(rows()[0]).toHaveTextContent(/7:00.PM Listening Studio In person · Darb 1718/)
    expect(rows()[1]).toHaveTextContent(/8:00.PM Session 2 Archive/)
    press(/^Thu 12,/)
    expect(pressedDay()).toEqual([dayButtons()[5]])
    expect(currentDay()).toEqual([dayButtons()[4]])
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Open talk')
    expect(within(section()).getByRole('list')).toHaveAccessibleName('Thursday, October 12')
  })

  it('choosing the pressed day keeps it', () => {
    renderWithIntl(card())
    press(/^Wed 11,/)
    expect(pressedDay()).toEqual([dayButtons()[4]])
  })

  it('a change of day is read once in the shell’s region', async () => {
    renderWithIntl(<LiveRegion />)
    const region = screen.getByRole('status')
    renderWithIntl(card())
    press(/^Wed 11,/)
    press(/^Thu 12,/)
    await waitFor(() =>
      expect(region).toHaveTextContent('Thursday, October 12, 1 session or event'),
    )
    expect(screen.getAllByRole('status')).toEqual([region])
    region.textContent = ''
    press(/^Thu 12,/)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(region).toBeEmptyDOMElement()
  })

  it('a day with nothing says so', () => {
    renderWithIntl(card())
    press(/^Sat 7,/)
    expect(within(section()).getByText('No sessions or events on this day.')).toBeVisible()
    expect(within(section()).queryByRole('list')).toBeNull()
  })

  it('an empty week says so on every day', () => {
    renderWithIntl(card('2034-10-11', [], []))
    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      fireEvent.click(dayButtons()[index]!)
      expect(within(section()).getByText('No sessions or events this week.')).toBeVisible()
    }
  })

  it('a row with no start says All day', () => {
    renderWithIntl(card())
    press(/^Thu 12,/)
    expect(rows()[0]!.querySelector('time')).toHaveTextContent('All day')
    expect(rows()[0]!.querySelector('time')).toHaveAttribute('datetime', '2034-10-12')
  })

  it('a day with five meetings shows three dots and counts five', () => {
    const five = [1, 2, 3, 4, 5].map((n) => meeting('event', `Talk ${n}`, '2034-10-11'))
    renderWithIntl(card('2034-10-11', [], five))
    expect(dayButtons()[4]).toHaveAccessibleName('Wed 11, 5 sessions or events')
    const dots = dayButtons()[4]!.querySelector('[data-week-count]')!
    expect(dots).toHaveAttribute('data-week-count', '5')
    expect(dots.children).toHaveLength(3)
    expect(dayButtons()[0]!.querySelector('[data-week-count]')!.children).toHaveLength(0)
  })

  it('a row opens the room, else the public page, else the Calendar day', () => {
    renderWithIntl(card())
    const hrefs = () => rows().map((row) => row.getAttribute('href'))
    expect(hrefs()).toEqual(['/en/spaces/course/studio', '/en/study/courses/archive'])
    press(/^Sun 8,/)
    expect(hrefs()).toEqual(['/en/spaces/calendar?view=day&date=2034-10-08'])
  })

  it('an event never takes a course room’s link', () => {
    const talk = meeting('event', 'Public talk', '2034-10-11', { href: '/events/public-talk' })
    renderWithIntl(card('2034-10-11', [], [talk]))
    expect(rows().map((row) => row.getAttribute('href'))).toEqual(['/en/events/public-talk'])
  })

  it('in Arabic the numbers and times use Arabic digits', () => {
    renderWithIntl(card('2034-10-11', own, talks, 'ar'), { locale: 'ar' })
    const region = screen.getByRole('region', { name: 'هذا الأسبوع' })
    expect(within(region).getByRole('button', { name: 'أربعاء ١١، موعدان' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const time of region.querySelectorAll('li time')) {
      expect(time).toHaveTextContent(/[٠-٩]/u)
      expect(time).not.toHaveTextContent(/[0-9]/)
    }
    for (const button of within(region).getAllByRole('button'))
      expect(button).not.toHaveTextContent(/[0-9]/)
    expect(within(region).getByText('الجلسة ٢')).toBeVisible()
  })

  it('a chosen date that left the week falls back to today', () => {
    const { rerender } = renderWithIntl(card())
    press(/^Thu 12,/)
    rerender(card('2034-10-18'))
    expect(pressedDay()).toEqual([dayButtons()[4]])
    expect(dayButtons()[4]).toHaveAccessibleName(/^Wed 18,/)
  })

  it('with no choice, the pressed day follows today after midnight', () => {
    renderWithIntl(card())
    wake('2034-10-11T22:30:00Z')
    expect(pressedDay()).toEqual([dayButtons()[5]])
    expect(currentDay()).toEqual([dayButtons()[5]])
  })

  it('a chosen day stays pressed after midnight', () => {
    renderWithIntl(card())
    press(/^Sun 8,/)
    wake('2034-10-11T22:30:00Z')
    expect(pressedDay()).toEqual([dayButtons()[1]])
    expect(currentDay()).toEqual([dayButtons()[5]])
  })

  it('keeps a day pressed without marking it as today after the week ends', () => {
    renderWithIntl(card())
    wake('2034-10-14T09:00:00Z')
    expect(pressedDay()).toEqual([dayButtons()[4]])
    expect(currentDay()).toEqual([])
  })
})
