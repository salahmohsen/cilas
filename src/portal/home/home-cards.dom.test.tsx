import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import type { NeedRow } from '@/portal/needs/sources'

import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'
import { CardBoundary } from './card-boundary'
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
  expect(screen.getByRole('link', { name: 'Review 6 items' })).toHaveAttribute(
    'href',
    '/admin/reviews',
  )
})

it('shows no total when a source failed and keeps the rows that loaded', () => {
  renderWithIntl(<NeedsCard result={{ rows: work(1), failed: ['applicants'] }} />)
  expect(screen.getByRole('heading', { name: /^Needs you$/ })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Some tasks could not load. Reload.')
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
      spacesOff={false}
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
  ['student', false, 'Browse spaces', '/en/spaces/community'],
  ['student', true, 'See open courses', '/en/study'],
  ['fellow', false, 'Open your courses', '/en/spaces/courses'],
  ['admin', false, 'Open the calendar', '/en/spaces/calendar'],
] as const)(
  'shows the next-session empty action for %s (spaces off: %s)',
  (view, spacesOff, label, href) => {
    renderWithIntl(<NextSessionCard session={null} view={view} spacesOff={spacesOff} locale="en" />)
    expect(screen.getByText('No sessions yet')).toBeVisible()
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
  },
)

it('hides Your spaces when spaces are off', () => {
  const { container } = renderWithIntl(<SpacesCard spaces={null} student locale="en" />)
  expect(container).toBeEmptyDOMElement()
})

it('uses the capped unread number and speaks it as part of the space name', () => {
  renderWithIntl(
    <SpacesCard
      spaces={[
        {
          id: 1,
          label: 'Studio',
          cover: null,
          href: '/en/spaces/community/1',
          unread: 12,
          archived: false,
        },
      ]}
      student
      locale="en"
    />,
  )
  expect(screen.getByText('9+')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Studio, more than 9 unread posts' })).toBeVisible()
})

it('offers Retry for a failed card and leaves the other cards visible', () => {
  const FailedCard = () => {
    throw new Error('test card failure')
  }
  renderWithIntl(
    <>
      <CardBoundary>
        <FailedCard />
      </CardBoundary>
      <CardBoundary>
        <p>{messagesOf.en.Portal.latest.empty}</p>
      </CardBoundary>
    </>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('This could not load.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  expect(screen.getByText(messagesOf.en.Portal.latest.empty)).toBeVisible()
})
