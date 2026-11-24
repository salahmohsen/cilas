import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { renderWithBrowserNavigation } from '../../../testing/browser-navigation.test-utils'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { LiveRegion } from '../feedback/announce'
import { FoldButton } from './fold-button'
import { FoldProvider, useFold } from './fold-state'
import { Sidebar } from './sidebar'

const clearCookies = () => {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]!.trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  }
}

function ShortcutSwitch() {
  const { shortcutOn, setShortcutOn } = useFold()
  return (
    <button type="button" onClick={() => setShortcutOn(!shortcutOn)}>
      {shortcutOn ? 'turn off' : 'turn on'}
    </button>
  )
}

const renderFold = () =>
  renderWithBrowserNavigation(
    <IntlProvider locale="en">
      <LiveRegion />
      <FoldProvider folded={false} accountId={7}>
        <div data-page="spaces">
          <FoldButton />
          <ShortcutSwitch />
          <input aria-label="probe" />
          <Sidebar items={[]} spaces={[]} />
        </div>
      </FoldProvider>
    </IntlProvider>,
  )

const fold = () => screen.getByRole('button', { name: /^(Fold|Unfold) sidebar$/ })
const region = () => document.querySelector('[data-portal-live]')!
const sidebar = () => document.querySelector('nav')!.parentElement!

afterEach(() => {
  cleanup()
  clearCookies()
  localStorage.clear()
})

describe('FoldProvider', () => {
  it('[ on the page folds, writes the cookie and announces; a second [ unfolds', async () => {
    await page.viewport(1440, 800)
    renderFold()
    document.body.focus()
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar()).toHaveAttribute('data-folded')
    expect(document.cookie).toContain('portal-folded-7=1')
    await waitFor(() => expect(region()).toHaveTextContent('Sidebar folded'))
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'true')
    expect(document.cookie).not.toContain('portal-folded-7')
    await waitFor(() => expect(region()).toHaveTextContent('Sidebar unfolded'))
  })

  it('[ in an input changes nothing', async () => {
    await page.viewport(1440, 800)
    renderFold()
    screen.getByRole('textbox', { name: 'probe' }).focus()
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'true')
  })

  it('a click folds and announces nothing', async () => {
    await page.viewport(1440, 800)
    renderFold()
    await userEvent.click(fold())
    expect(fold()).toHaveAttribute('aria-expanded', 'false')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(region()).toHaveTextContent('')
  })

  it('the button names its key and its target', () => {
    renderFold()
    expect(fold()).toHaveAttribute('aria-keyshortcuts', '[')
    expect(fold()).toHaveAttribute('aria-controls', 'portal-nav')
    expect(document.getElementById('portal-nav')?.tagName).toBe('NAV')
  })

  it('with the shortcut off, [ does nothing, and a new mount keeps it off', async () => {
    await page.viewport(1440, 800)
    renderFold()
    await userEvent.click(screen.getByRole('button', { name: 'turn off' }))
    expect(fold()).not.toHaveAttribute('aria-keyshortcuts')
    document.body.focus()
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'true')
    expect(localStorage.getItem('portal-shortcut-off-7')).toBe('1')
    cleanup()
    renderFold()
    await screen.findByRole('button', { name: 'turn on' })
    document.body.focus()
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'true')
  })

  it('the key does nothing in the phone layout', async () => {
    await page.viewport(390, 800)
    renderFold()
    document.body.focus()
    await userEvent.keyboard('[[')
    expect(fold()).toHaveAttribute('aria-expanded', 'true')
  })
})
