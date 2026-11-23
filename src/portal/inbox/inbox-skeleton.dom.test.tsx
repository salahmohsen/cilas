import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithIntl } from '../../../testing/intl.test-utils'
import { InboxSkeleton } from './inbox-skeleton'

afterEach(cleanup)

describe('InboxSkeleton', () => {
  it('has the data-inbox-skeleton marker and one h1', () => {
    const { container } = renderWithIntl(<InboxSkeleton />)
    expect(container.querySelector('[data-inbox-skeleton]')).not.toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inbox')
  })

  it('names the loading status and both placeholders in Arabic', () => {
    renderWithIntl(<InboxSkeleton />, { locale: 'ar' })
    expect(screen.getAllByRole('status', { name: 'جارٍ تحميل الوارد' })).toHaveLength(3)
  })
})
