import { fireEvent, render, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { describe, expect, it } from 'vitest'
import { ToastStackProvider } from '@/components/arc/toast-stack/toast-stack'
import { LiveRegion } from '@/portal/feedback/announce'
import { createBrowserRouter } from '../../../testing/browser-navigation.test-utils'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { PendingProvider, usePending, usePendingItem } from './pending-provider'
import { UndoAllBar } from './undo-all-bar'

function Trial() {
  const pending = usePending()
  const one = usePendingItem('one')
  const two = usePendingItem('two')
  return (
    <>
      <button
        onClick={() => {
          pending.decide({
            key: 'one',
            label: 'First article',
            focus: () => document.getElementById('first-article')?.focus(),
            request: { url: '/review', body: {} },
          })
        }}
      >
        Decide first
      </button>
      <button
        onClick={() =>
          pending.decide({
            key: 'two',
            label: 'Second article',
            request: { url: '/review', body: {} },
          })
        }
      >
        Decide second
      </button>
      <button
        onClick={() =>
          pending.decide({
            key: 'three',
            label: 'Third article',
            request: { url: '/review', body: {} },
          })
        }
      >
        Decide third
      </button>
      <span data-testid="first-state">{one?.state}</span>
      <span data-testid="second-state">{two?.state}</span>
      {one?.state === 'undone' && <button id="first-article">First article</button>}
      <LiveRegion />
      <UndoAllBar />
    </>
  )
}

function setup() {
  render(
    <AppRouterContext.Provider value={createBrowserRouter().router}>
      <IntlProvider>
        <ToastStackProvider>
          <PendingProvider
            clock={{ now: () => 0, setTimeout: () => 0, clearTimeout: () => {} }}
            fetcher={async () => Response.json({})}
          >
            <Trial />
          </PendingProvider>
        </ToastStackProvider>
      </IntlProvider>
    </AppRouterContext.Provider>,
  )
  return (which: 'first' | 'second' | 'third') =>
    fireEvent.click(screen.getByRole('button', { name: `Decide ${which}` }))
}

const bar = () => screen.getByRole('region', { name: 'Pending decisions' })

describe('pending: Undo all bar', () => {
  it('is hidden with one item', () => {
    setup()('first')
    expect(screen.queryByRole('region', { name: 'Pending decisions' })).toBeNull()
  })

  it('shows at two items and announces once while it stays open', async () => {
    const decide = setup()
    decide('first')
    decide('second')
    expect(bar()).toHaveTextContent('2 emails wait')
    expect(await screen.findByText('2 emails wait. Undo all is available.')).toBeInTheDocument()
    decide('third')
    expect(bar()).toHaveTextContent('3 emails wait')
    expect(screen.getByRole('status')).toHaveTextContent('2 emails wait. Undo all is available.')
  })

  it('undoes both items and focuses the first restored row', async () => {
    const decide = setup()
    decide('first')
    decide('second')
    fireEvent.click(screen.getByRole('button', { name: 'Undo all' }))
    expect(screen.getByTestId('first-state')).toHaveTextContent('undone')
    expect(screen.getByTestId('second-state')).toHaveTextContent('undone')
    const first = screen.getByRole('button', { name: 'First article' })
    await expect.poll(() => document.activeElement).toBe(first)
  })

  it('sets and clears the bar size and toast offset on the root', () => {
    const decide = setup()
    decide('first')
    decide('second')
    const style = document.documentElement.style
    expect(style.getPropertyValue('--pending-bar-block-size')).toBe('0px')
    expect(style.getPropertyValue('--toast-stack-offset')).toContain('var(--pending-bar-block-size')
    fireEvent.click(screen.getByRole('button', { name: 'Undo all' }))
    expect(style.getPropertyValue('--pending-bar-block-size')).toBe('')
    expect(style.getPropertyValue('--toast-stack-offset')).toBe('')
  })
})
