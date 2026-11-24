import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { ToastStackProvider } from '@/components/arc/toast-stack/toast-stack'
import {
  BrowserNavigation,
  createBrowserRouter,
} from '../../../testing/browser-navigation.test-utils'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { emulateMedia, resetMedia } from '../../../testing/media.test-utils'
import { PendingProvider, usePending, usePendingItem } from './pending-provider'
import { PendingRing } from './pending-ring'

const itemKey = 'review:articles:12'
const label = 'Article'
let now = 0
const clock = { now: () => now, setTimeout: () => 0, clearTimeout: () => {} }

function Trial({ rtl = false }: { rtl?: boolean }) {
  const pending = usePending()
  const item = usePendingItem(itemKey)
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ display: 'flex', inlineSize: 240 }} data-ring-row>
      <button
        onClick={() =>
          pending.decide({ key: itemKey, label, request: { url: '/review', body: {} } })
        }
      >
        Decide
      </button>
      <output aria-label="State">{item?.state ?? 'none'}</output>
      <PendingRing itemKey={itemKey} label={label} />
    </div>
  )
}

function setup(options: { rtl?: boolean; undoMs?: number } = {}) {
  render(
    <BrowserNavigation browser={createBrowserRouter()}>
      <IntlProvider locale={options.rtl ? 'ar' : 'en'}>
        <ToastStackProvider>
          <PendingProvider
            undoMs={options.undoMs ?? 5000}
            clock={clock}
            fetcher={async () => Response.json({})}
          >
            <Trial rtl={options.rtl} />
          </PendingProvider>
        </ToastStackProvider>
      </IntlProvider>
    </BrowserNavigation>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
  return screen.getByRole('button', { name: /Article/ })
}

const state = () => screen.getByLabelText('State')
const touch = (el: HTMLElement) => {
  fireEvent(el, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
  fireEvent(el, new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
}

afterEach(async () => {
  now = 0
  await resetMedia()
})

describe('pending: ring', () => {
  it('reduced motion shows time as text and no arc', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'reduce' })
    const ring = setup()
    expect(ring).toHaveTextContent('5')
    expect(ring.querySelector('svg')).toBeNull()
    expect(ring.querySelector('[aria-hidden="true"]')).toHaveTextContent('5')
  })

  it('Esc on the ring undoes', async () => {
    const ring = setup()
    ring.focus()
    await userEvent.keyboard('{Escape}')
    expect(state()).toHaveTextContent('undone')
  })

  it('first touch pauses and the second undoes', () => {
    const ring = setup()
    touch(ring)
    expect(state()).toHaveTextContent('paused')
    touch(ring)
    expect(state()).toHaveTextContent('undone')
  })

  it('touch outside and Esc away resume a touch pause', async () => {
    const ring = setup()
    const outside = screen.getByRole('button', { name: 'Decide' })
    touch(ring)
    fireEvent(outside, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    expect(state()).toHaveTextContent('pending')
    touch(ring)
    outside.focus()
    await userEvent.keyboard('{Escape}')
    expect(state()).toHaveTextContent('pending')
  })

  it('a tap pauses once: the focus it causes adds no second pause', () => {
    const ring = setup()
    const outside = screen.getByRole('button', { name: 'Decide' })
    fireEvent(ring, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    fireEvent(ring, new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
    ring.focus()
    fireEvent(ring, new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
    expect(state()).toHaveTextContent('paused')
    fireEvent(outside, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    expect(state()).toHaveTextContent('pending')
  })

  it.each(['pointerout', 'pointercancel', 'contextmenu'])(
    'a touch that ends with %s does not hide a later keyboard focus',
    async (end) => {
      const ring = setup()
      fireEvent(ring, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
      fireEvent(ring, new PointerEvent(end, { bubbles: true, relatedTarget: document.body }))
      ring.focus()
      await expect.poll(() => state().textContent).toBe('paused')
    },
  )

  it('the name ends Timer paused while paused', async () => {
    const ring = setup()
    expect(ring).toHaveAccessibleName('Article. Undo. 5 seconds left.')
    touch(ring)
    await expect
      .poll(() => ring.getAttribute('aria-label'))
      .toBe('Article. Undo. 5 seconds left. Timer paused.')
  })

  it('counts down as the clock advances, holds while paused and goes on after', async () => {
    const ring = setup()
    const outside = screen.getByRole('button', { name: 'Decide' })
    const shows = async (seconds: number, paused = '') => {
      await expect.poll(() => ring.textContent).toBe(String(seconds))
      expect(ring).toHaveAccessibleName(`Article. Undo. ${seconds} seconds left.${paused}`)
    }
    now = 2000
    await shows(3)
    touch(ring)
    now = 9000
    await shows(3, ' Timer paused.')
    fireEvent(outside, new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
    now = 10_000
    await shows(2)
  })

  it('carries the configured undo window', () => {
    expect(setup({ undoMs: 1500 })).toHaveAttribute('data-undo-ms', '1500')
  })

  it('sits at the inline end in RTL', () => {
    const ring = setup({ rtl: true })
    const row = ring.closest('[data-ring-row]')!
    expect(ring.getBoundingClientRect().left).toBeCloseTo(row.getBoundingClientRect().left)
  })
})
