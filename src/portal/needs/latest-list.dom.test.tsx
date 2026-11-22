import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { StoredNotification } from '@/lib/realtime/events'

import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'
import { LatestList } from './latest-list'
import type { LatestPage } from './latest'

afterEach(cleanup)

const note = (over: Partial<StoredNotification> = {}) =>
  ({
    id: 1,
    kind: 'comment',
    title: 'New comment',
    description: 'Sara replied',
    link: '/en/spaces/community/1',
    read_at: '2026-01-01T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    ...over,
  }) satisfies StoredNotification

const page = (rows: StoredNotification[], over: Partial<LatestPage> = {}) =>
  ({ rows, pages: 1, more: null, ...over }) satisfies LatestPage

describe('LatestList', () => {
  it('a Latest row links to its stored link unchanged', () => {
    renderWithIntl(
      <LatestList
        focus={false}
        page={page([
          note({ id: 1, link: '/admin/applicants?application=4' }),
          note({ id: 2, link: '/en/spaces/x' }),
          note({ id: 3, link: '/spaces/y', read_at: null }),
        ])}
      />,
    )
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/admin/applicants?application=4', '/en/spaces/x', '/spaces/y'])
  })

  it('a row with no link is not a link', () => {
    renderWithIntl(<LatestList focus={false} page={page([note({ link: null })])} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('listitem')).toHaveTextContent('New comment')
  })

  it.each([
    ['javaScript:alert(1)', null],
    ['data:text/html,test', '2026-01-01T00:00:00.000Z'],
    ['java\nscript:alert(1)', '2026-01-01T00:00:00.000Z'],
  ])('renders a notification with an invalid link as text (%s)', (link, read_at) => {
    renderWithIntl(<LatestList focus={false} page={page([note({ link, read_at })])} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('listitem')).toHaveTextContent('New comment')
  })

  it("a known kind uses the bell's words and glyph", () => {
    renderWithIntl(
      <LatestList
        focus={false}
        page={page([note({ kind: 'submitted', title: 'x', description: null })])}
      />,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent(
      messagesOf.en.Notifications.kinds.submitted,
    )
    expect(screen.getByRole('listitem').querySelector('svg')).not.toBeNull()
  })

  it('an unread row says Unread and shows a dot', () => {
    renderWithIntl(<LatestList focus={false} page={page([note({ read_at: null })])} />)
    expect(screen.getByRole('link')).toHaveAccessibleName(/^Unread,\s*New comment/)
  })

  it('an empty list says so', () => {
    renderWithIntl(<LatestList focus={false} page={page([])} />)
    expect(screen.getByText(messagesOf.en.Portal.latest.empty)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('Show more links to the next page with focus, and the cap shows a line', () => {
    const { unmount } = renderWithIntl(
      <LatestList focus={false} page={page([note()], { more: 'link', pages: 2 })} />,
    )
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/en/spaces/inbox?latest=3&focus=latest',
    )
    unmount()
    renderWithIntl(<LatestList focus={false} page={page([note()], { more: 'cap', pages: 10 })} />)
    expect(screen.getByText('Only the newest 300 show.')).toBeTruthy()
  })
})
