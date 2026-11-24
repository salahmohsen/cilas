import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { createBrowserRouter } from '../../../testing/browser-navigation.test-utils'
import { StrictMode, useLayoutEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingProvider, usePending, usePendingItem } from './pending-provider'

const input = { key: 'one', label: 'Approve', request: { url: '/api/review', body: {} } }
const useFirstItem = () => usePendingItem(input.key)

function Probe({ start = false, children }: { start?: boolean; children?: ReactNode }) {
  const pending = usePending()
  const item = useFirstItem()
  useLayoutEffect(() => {
    if (start) pending.decide(input)
  }, [pending, start])
  return (
    <>
      <button onClick={() => pending.decide(input)}>Decide</button>
      <output aria-label="State">{item?.state ?? 'none'}</output>
      {children}
    </>
  )
}

function setup(children?: ReactNode) {
  const fetcher = vi.fn()
  const browser = createBrowserRouter()
  return {
    fetcher,
    browser,
    ui: (
      <AppRouterContext.Provider value={browser.router}>
        <PendingProvider
          fetcher={async (...args) => {
            fetcher(...args)
            return Response.json({ emailed: true })
          }}
        >
          {children ?? <Probe />}
        </PendingProvider>
      </AppRouterContext.Provider>
    ),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('pending: provider', () => {
  it('Strict Mode remount does not flush', () => {
    const { ui, fetcher } = setup(<Probe start />)
    render(<StrictMode>{ui}</StrictMode>)
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByLabelText('State')).toHaveTextContent('pending')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('pageshow persisted drops items and refreshes', () => {
    const { ui, fetcher, browser } = setup()
    render(ui)
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }))
    expect(screen.getByLabelText('State')).toHaveTextContent('none')
    expect(browser.refreshes).toBe(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('visibilitychange to hidden sends the pending item only once, even with pagehide', async () => {
    const { ui, fetcher } = setup()
    render(ui)
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    // oxlint-disable-next-line landmines-testing/no-test-doubles -- jsdom has no background tab.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    try {
      await act(async () => {
        fireEvent(document, new Event('visibilitychange'))
        fireEvent(window, new Event('pagehide'))
      })
    } finally {
      // oxlint-disable-next-line landmines-testing/no-test-doubles -- Restore jsdom's original visibility.
      Reflect.deleteProperty(document, 'visibilityState')
    }
    expect(fetcher).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('State')).toHaveTextContent('sent')
  })

  it('throws from usePending outside the provider and returns null from usePendingItem', () => {
    expect(() => renderHook(usePending)).toThrow(/PendingProvider/)
    expect(renderHook(useFirstItem).result.current).toBeNull()
  })

  it('an aria-modal pauses an item and removing it resumes it', async () => {
    const { ui } = setup()
    render(ui)
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    await act(async () => {
      document.body.append(modal)
    })
    expect(screen.getByLabelText('State')).toHaveTextContent('paused')
    await act(async () => {
      modal.remove()
    })
    expect(screen.getByLabelText('State')).toHaveTextContent('pending')
  })
})
