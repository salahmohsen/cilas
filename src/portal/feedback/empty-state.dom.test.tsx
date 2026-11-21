import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithIntl } from '../../../testing/intl.test-utils'
import { PortalEmptyState } from './empty-state'

describe('PortalEmptyState', () => {
  it('renders an h2 heading and its body', () => {
    renderWithIntl(<PortalEmptyState title="Your spaces" body="No spaces yet." />)
    expect(screen.getByRole('heading', { level: 2, name: 'Your spaces' })).toBeInTheDocument()
    expect(screen.getByText('No spaces yet.')).toBeInTheDocument()
  })

  it('a link action, then the next line', () => {
    renderWithIntl(
      <PortalEmptyState
        title="Your spaces"
        body="No spaces yet."
        next="Ask your fellow to add you."
        action={{ label: 'Browse courses', href: '/study' }}
      />,
    )
    const link = screen.getByRole('link', { name: 'Browse courses' })
    expect(link).toHaveAttribute('href', '/en/study')
    const next = screen.getByText('Ask your fellow to add you.')
    expect(link.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('an external action is a plain link with no locale prefix', () => {
    renderWithIntl(
      <PortalEmptyState
        title="Your articles"
        body="No articles yet."
        action={{
          label: 'New article',
          href: '/admin/collections/articles/create',
          external: true,
        }}
      />,
    )
    expect(screen.getByRole('link', { name: 'New article' })).toHaveAttribute(
      'href',
      '/admin/collections/articles/create',
    )
  })

  it('with no action it renders no link', () => {
    renderWithIntl(<PortalEmptyState title="Your spaces" body="No spaces yet." next="Later." />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
