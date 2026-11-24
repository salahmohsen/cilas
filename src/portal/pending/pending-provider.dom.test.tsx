import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { createBrowserRouter } from '../../../testing/browser-navigation.test-utils'
import {
  ToastStack,
  ToastStackProvider,
  useToastStack,
} from '@/components/arc/toast-stack/toast-stack'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { pendingToastId } from './pending-toast'
import { usePortalSignOut } from './sign-out'
import { StrictMode, useLayoutEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingProvider, usePending, usePendingItem } from './pending-provider'
import { COMMIT_TIMEOUT_MS, type PendingApi, type PendingView } from './store'

const input = { key: 'one', label: 'Approve', request: { url: '/api/review', body: {} } }
const useFirstItem = () => usePendingItem(input.key)

function Probe({ start = false, children }: { start?: boolean; children?: ReactNode }) {
  const pending = usePending()
  const item = useFirstItem()
  const late = usePendingItem('late')
  useLayoutEffect(() => {
    if (start) pending.decide(input)
  }, [pending, start])
  return (
    <>
      <button onClick={() => pending.decide(input)}>Decide</button>
      <button onClick={() => pending.decide({ ...input, key: 'late' })}>Decide late</button>
      <output aria-label="State">{item?.state ?? 'none'}</output>
      <output aria-label="Late state">{late?.state ?? 'none'}</output>
      {children}
    </>
  )
}

function setup(children?: ReactNode, reply = async () => Response.json({ emailed: true })) {
  const fetcher = vi.fn()
  const browser = createBrowserRouter()
  return {
    fetcher,
    browser,
    ui: (
      <AppRouterContext.Provider value={browser.router}>
        <IntlProvider>
          <ToastStackProvider limit={2}>
            <PendingProvider
              fetcher={async (...args) => {
                fetcher(...args)
                return reply()
              }}
            >
              {children ?? <Probe />}
            </PendingProvider>
            <ToastStack label="Notifications" />
          </ToastStackProvider>
        </IntlProvider>
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

  it('a real unmount flushes after one task and destroys the store once the flush settles', async () => {
    let store: PendingApi | undefined
    function Capture() {
      store = usePending()
      return null
    }
    let reply: (response: Response) => void = () => {}
    const { ui, fetcher } = setup(
      <>
        <Probe />
        <Capture />
      </>,
      () => new Promise<Response>((resolve) => (reply = resolve)),
    )
    const view = render(ui)
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    view.unmount()
    expect(fetcher).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(store?.items).toHaveLength(1)
    await act(async () => {
      reply(Response.json({ emailed: true }))
    })
    expect(store?.items).toHaveLength(0)
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

  it('usePendingItem reads the time left now, 2 s after the decision', () => {
    const seen: { pending?: PendingApi; item?: PendingView | null } = {}
    function Capture() {
      const pending = usePending()
      const item = useFirstItem()
      useLayoutEffect(() => {
        seen.pending = pending
        seen.item = item
      })
      return null
    }
    render(setup(<Capture />).ui)
    act(() => void seen.pending?.decide(input))
    const first = seen.item
    act(() => vi.advanceTimersByTime(2000))
    expect(seen.item).toBe(first)
    expect(first?.remainingMs).toBeGreaterThan(2900)
    expect(first?.remainingMs).toBeLessThanOrEqual(3000)
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

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
// oxlint-disable-next-line landmines-testing/no-test-doubles -- Vitest cannot load the push server action through the browser sign-out module.
vi.mock('@/lib/sign-out', () => ({
  signOut: async () => {
    logout()
  },
}))

function SignOutButton() {
  const signOut = usePortalSignOut()
  return <button onClick={signOut}>Sign out</button>
}

function renderSignOut(reply: () => Promise<Response>) {
  logout.mockClear()
  const { ui, fetcher } = setup(
    <Probe>
      <SignOutButton />
    </Probe>,
    reply,
  )
  render(ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  return fetcher
}

describe('pending: sign out', () => {
  it('waits for a commit in flight, then signs out', async () => {
    let finish!: (reply: Response) => void
    const response = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetcher = renderSignOut(() => response)
    act(() => vi.advanceTimersByTime(5100))
    expect(fetcher).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logout).not.toHaveBeenCalled()
    await act(async () => {
      finish(Response.json({ emailed: true }))
    })
    expect(logout).toHaveBeenCalledOnce()
  })

  it('stops and shows a toast when a commit fails', async () => {
    const fetcher = renderSignOut(async () => new Response(null, { status: 500 }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(logout).not.toHaveBeenCalled()
    expect(screen.getByText('A decision was not saved. Sign out stopped.')).toBeInTheDocument()
  })

  it('stops after the commit time runs out, and the item can be tried again', async () => {
    const fetcher = renderSignOut(() => new Promise<Response>(() => {}))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    })
    expect(logout).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(COMMIT_TIMEOUT_MS)
    })
    expect(logout).not.toHaveBeenCalled()
    expect(screen.getByLabelText('State')).toHaveTextContent('failed')
    expect(screen.getByText('A decision was not saved. Sign out stopped.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('keeps a decision made while sign-out waits out of the queue', async () => {
    let finish!: (reply: Response) => void
    const response = new Promise<Response>((resolve) => {
      finish = resolve
    })
    renderSignOut(() => response)
    act(() => vi.advanceTimersByTime(5100))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decide late' }))
    await act(async () => {
      finish(Response.json({ emailed: true }))
    })
    expect(logout).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Late state')).toHaveTextContent('none')
  })
})

it('dropping the oldest toast leaves its item undoable and updating its id has no effect', async () => {
  vi.useRealTimers()

  function Decisions() {
    const pending = usePending()
    const { update } = useToastStack()
    const first = useFirstItem()
    return (
      <>
        <button
          onClick={() => {
            pending.decide({ ...input, toastLine: () => 'Approving first' })
            pending.decide({ ...input, key: 'two', toastLine: () => 'Approving second' })
            pending.decide({ ...input, key: 'three', toastLine: () => 'Approving third' })
          }}
        >
          Decide three
        </button>
        <button onClick={() => update(pendingToastId(input.key), { title: 'Resurrected first' })}>
          Update dropped toast
        </button>
        <button onClick={() => pending.undo(input.key)}>Undo first row</button>
        <output aria-label="First state">{first?.state}</output>
      </>
    )
  }
  const { ui } = setup(<Decisions />)
  render(ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide three' }))
  expect(screen.queryByText('Approving first')).toBeNull()
  expect(screen.getByText('Approving third')).toBeInTheDocument()
  expect(screen.getByLabelText('First state')).toHaveTextContent('pending')
  fireEvent.click(screen.getByRole('button', { name: 'Update dropped toast' }))
  expect(screen.queryByText('Resurrected first')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Undo first row' }))
  expect(screen.getByLabelText('First state')).toHaveTextContent('undone')
  expect(screen.queryByText('Approving first')).toBeNull()
})

it('focus in the toast stack holds the undo window until focus leaves', () => {
  const { ui, fetcher } = setup()
  render(ui)
  const decide = screen.getByRole('button', { name: 'Decide' })
  fireEvent.click(decide)
  const action = screen.getByRole('button', { name: 'Undo' })
  act(() => action.focus())
  expect(screen.getByLabelText('State')).toHaveTextContent('paused')
  act(() => vi.advanceTimersByTime(6000))
  expect(fetcher).not.toHaveBeenCalled()
  act(() => decide.focus())
  expect(screen.getByLabelText('State')).toHaveTextContent('pending')
})

it.each([
  [400, 'Not saved.'],
  [409, 'This changed while you reviewed it.'],
])('a %s refusal shows its message', async (status, message) => {
  const { ui } = setup(undefined, async () => Response.json({}, { status }))
  render(ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  await act(async () => {
    vi.advanceTimersByTime(5100)
  })
  expect(screen.getByLabelText('State')).toHaveTextContent('undone')
  expect(screen.getByText(message)).toBeInTheDocument()
})

it('a failed item keeps its toast past the eight seconds of a finished one', async () => {
  const { ui } = setup(undefined, async () => new Response(null, { status: 500 }))
  render(ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  await act(async () => {
    vi.advanceTimersByTime(5100)
  })
  expect(screen.getByText('Not saved.')).toBeInTheDocument()
  await act(async () => {
    vi.advanceTimersByTime(60_000)
  })
  expect(screen.getByText('Not saved.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('a toast that drops its focused button with no focusout lets the next decision run', async () => {
  vi.useRealTimers()
  const { ui } = setup()
  render(ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  const undo = screen.getByRole('button', { name: 'Undo' })
  act(() => undo.focus())
  expect(screen.getByLabelText('State')).toHaveTextContent('paused')
  await act(async () => undo.remove())
  fireEvent.click(screen.getByRole('button', { name: 'Decide late' }))
  expect(screen.getByLabelText('Late state')).toHaveTextContent('pending')
})

it('shows the leave hint only on the first pending toast of the tab session', () => {
  sessionStorage.clear()
  const hint = 'Emails go when you leave this page or switch app.'
  const first = render(setup().ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  expect(screen.getByText(hint)).toBeInTheDocument()
  first.unmount()
  render(setup().ui)
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  expect(screen.queryByText(hint)).toBeNull()
  sessionStorage.clear()
})
