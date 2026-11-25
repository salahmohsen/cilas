import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse, sse } from 'msw'
import { expect, it } from 'vitest'

import { ToastStackProvider } from '@/components/arc/toast-stack/toast-stack'
import type { StoredNotification } from '@/lib/realtime/events'

import { messagesOf, renderWithIntl } from '../../testing/intl.test-utils'
import { mockNetwork } from '../../testing/msw-browser.test-utils'
import { SiteNotifications } from './site-notifications'

const docs = [
  { id: 1, title: 'Review article', link: '/spaces/review/articles/5' },
  { id: 2, title: 'Admin account', link: '/admin/collections/users/3' },
].map(
  (note) =>
    ({
      ...note,
      kind: '',
      createdAt: '2026-11-25T12:00:00Z',
      read_at: '2026-11-25T12:00:00Z',
    }) satisfies StoredNotification,
)

mockNetwork(
  http.get('/api/notifications', () => HttpResponse.json({ docs })),
  sse('/api/notifications/stream', () => {}),
)

it('opens Spaces links in Arabic and keeps admin links', async () => {
  const t = messagesOf.ar.Notifications
  renderWithIntl(
    <ToastStackProvider>
      <SiteNotifications />
    </ToastStackProvider>,
    { locale: 'ar' },
  )

  fireEvent.click(await screen.findByRole('button', { name: t.label }))
  fireEvent.click(screen.getByRole('button', { name: `Review article. ${t.showDetails}` }))
  expect(await screen.findByRole('link', { name: t.open })).toHaveAttribute(
    'href',
    '/ar/spaces/review/articles/5',
  )

  fireEvent.click(screen.getByRole('button', { name: `Admin account. ${t.showDetails}` }))
  expect(await screen.findByRole('link', { name: t.open })).toHaveAttribute(
    'href',
    '/admin/collections/users/3',
  )
})
