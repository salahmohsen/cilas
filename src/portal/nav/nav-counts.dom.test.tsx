import { render, screen } from '@testing-library/react'
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { IntlProvider } from '../../../testing/intl.test-utils'
import { NavCountChip, NavCountsProvider, NavCountSpoken, useNavCount } from './nav-counts'

const router = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  bfcacheId: 'test',
} satisfies AppRouterInstance

it('renders a silent, empty chip in the shell HTML and starts no request', () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    const html = renderToString(
      <AppRouterContext.Provider value={router}>
        <IntlProvider>
          <NavCountsProvider>
            <span>
              Inbox
              <NavCountSpoken itemKey="inbox" />
            </span>
            <NavCountChip itemKey="inbox" />
          </NavCountsProvider>
        </IntlProvider>
      </AppRouterContext.Provider>,
    )
    expect(html).toContain('>Inbox</span>')
    expect(html).toContain('aria-hidden="true" dir="ltr"></span>')
    expect(html).not.toContain('data-nav-count')
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
