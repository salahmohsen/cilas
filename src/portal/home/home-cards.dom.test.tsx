import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { LiveRegion } from '@/portal/feedback/announce'
import type { NeedRow } from '@/portal/needs/sources'

import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'
import { CardBoundary } from './card-boundary'
import { GreetingBoundary } from './greeting-boundary'
import { HomeLoading } from './home-loading'
import { NeedsCard } from './needs-card'
import { NextSessionCard } from './next-session-card'
import { SpacesCard } from './spaces-card'

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
  const link = screen.getByRole('link', { name: 'Studio, more than 9 unread posts' })
  expect(link).toHaveAccessibleDescription('Community No posts yet')
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
