import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { IntlProvider } from '../../../testing/intl.test-utils'
import { NavCountChip, NavCountsProvider, NavCountSpoken, useNavCount } from './nav-counts'

it('renders a silent, empty chip in the shell HTML and starts no request', () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    const html = renderToString(
      <IntlProvider>
        <NavCountsProvider>
          <span>
            Inbox
            <NavCountSpoken itemKey="inbox" />
          </span>
          <NavCountChip itemKey="inbox" />
        </NavCountsProvider>
      </IntlProvider>,
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const chip = doc.querySelector('span[aria-hidden="true"]')
    expect(doc.body.textContent).toBe('Inbox')
    expect(chip).not.toBeNull()
    expect(chip?.hasAttribute('data-nav-count')).toBe(false)
    expect(chip?.textContent).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    fetch.mockRestore()
  }
})

it('returns null outside the provider', () => {
  function Count() {
    return <span>{String(useNavCount('inbox'))}</span>
  }
  render(<Count />)
  expect(screen.getByText('null')).toBeInTheDocument()
})
