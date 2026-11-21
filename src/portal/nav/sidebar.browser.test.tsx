import { cleanup, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createTranslator } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { unreadCount } from '@/lib/unread-count'
import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-browser.test-utils'
import { renderWithBrowserNavigation } from '../../../testing/browser-navigation.test-utils'
import { FoldButton } from './fold-button'
import { FoldProvider } from './fold-state'
import type { PortalNavItem } from './portal-nav'
import { Sidebar } from './sidebar'
import { spaceRow } from './space-link.test-utils'
import type { SpaceLink } from './space-links'

const HOME: PortalNavItem = {
  key: 'home',
  labelKey: 'nav.home',
  group: 'top',
  href: '/spaces',
  icon: 'home',
  count: null,
  external: false,
}

const LONG_ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.repeat(3).slice(0, 60)

mockNetwork(http.get('/_next/image', () => new HttpResponse(null, { status: 404 })))

const countOf = (unread: number, locale: 'en' | 'ar') => {
  const t = createTranslator({ locale, messages: messagesOf[locale], namespace: 'Portal.nav' })
  return unreadCount(unread, locale, {
    some: (values) => t('unread', values),
    many: (values) => t('unreadMany', values),
  })
}

const clearCookies = () => {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]!.trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  }
}

const renderSidebar = ({
  folded = false,
  locale = 'en',
  spaces = [spaceRow({ label: 'Other course', unread: 12 })],
  box,
}: {
  folded?: boolean
  locale?: 'en' | 'ar'
  spaces?: SpaceLink[]
  box?: { width: number; height: number }
} = {}) =>
  renderWithBrowserNavigation(
    <IntlProvider locale={locale}>
      <FoldProvider folded={folded} accountId={7}>
        <div data-page="spaces">
          <FoldButton />
          <div style={box && { display: 'flex', inlineSize: box.width, blockSize: box.height }}>
            <Sidebar items={[HOME]} spaces={spaces} />
          </div>
        </div>
      </FoldProvider>
    </IntlProvider>,
  )

afterEach(() => {
  cleanup()
  clearCookies()
  window.history.replaceState(null, '', '/')
  document.documentElement.removeAttribute('dir')
})

describe('Sidebar', () => {
  it('folded and unfolded rows have the same accessible names', async () => {
    renderSidebar()
    const home = screen.getByRole('link', { name: 'Home' })
    const space = screen.getByRole('link', { name: /^Other course/ })
    const names = [home, space].map((link) => link.textContent)
    expect(space).toHaveAccessibleName('Other course, more than 9 unread posts')
    await userEvent.click(screen.getByRole('button', { name: 'Sidebar' }))
    expect(screen.getByRole('button', { name: 'Sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    const folded = [
      screen.getByRole('link', { name: 'Home' }),
      screen.getByRole('link', { name: 'Other course, more than 9 unread posts' }),
    ]
    expect(folded.every((link) => link.isConnected)).toBe(true)
    expect(folded.map((link) => link.textContent)).toEqual(names)
  })

  it('a focused or hovered folded row shows its label in a tooltip', async () => {
    renderSidebar({ folded: true })
    const space = screen.getByRole('link', { name: /^Other course/ })
    space.focus()
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Other course'))
    space.blur()
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    await userEvent.hover(screen.getByRole('link', { name: 'Home' }))
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Home'))
  })

  for (const width of [320, 720])
    for (const folded of [false, true])
      for (const locale of ['en', 'ar'] as const)
        it(`40 rows with 120 unread fit at ${width}px (${folded ? 'folded' : 'unfolded'}, ${locale})`, async () => {
          await page.viewport(width, 800)
          if (locale === 'ar') document.documentElement.setAttribute('dir', 'rtl')
          const spaces = Array.from({ length: 40 }, (_, i) =>
            spaceRow({
              label: i === 0 ? (locale === 'ar' ? LONG_ARABIC : 'Other course') : `Space ${i}`,
              unread: i === 0 ? 120 : i % 3,
            }),
          )
          renderSidebar({ folded, locale, spaces, box: { width, height: 600 } })
          const list = screen.getByRole('region', { name: messagesOf[locale].Portal.nav.scroll })
          expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
          expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
          const { shown, spoken } = countOf(120, locale)
          const first = screen.getAllByRole('link')[1]!
          expect(first).toHaveTextContent(shown)
          const circle = [...first.querySelectorAll('[aria-hidden="true"]')].find(
            (el) => el.textContent === shown,
          )!
          expect(getComputedStyle(circle).direction).toBe('ltr')
          expect(first).toHaveAccessibleName(new RegExp(`${spoken}$`))
        })
})

describe('Sidebar rows', () => {
  it('counts of 1 to 9 use the page digits (ar)', () => {
    renderSidebar({ locale: 'ar', spaces: [spaceRow({ label: 'Course', unread: 3 })] })
    const row = screen.getByRole('link', { name: /^Course/ })
    expect(row).toHaveTextContent('٣')
    expect(row).toHaveAccessibleName(`Course${countOf(3, 'ar').spoken}`)
  })

  it('the current item has weight 500 and a bar of at least 3px at its inline start', () => {
    window.history.replaceState(null, '', '/en/spaces')
    renderSidebar()
    const home = screen.getByRole('link', { name: 'Home' })
    expect(home).toHaveAttribute('aria-current', 'page')
    expect(getComputedStyle(home).fontWeight).toBe('500')
    expect(
      parseFloat(getComputedStyle(home, '::before').borderInlineStartWidth),
    ).toBeGreaterThanOrEqual(3)
  })

  it('a long name wraps and shows whole, beside the cover (ar)', async () => {
    await page.viewport(1440, 800)
    document.documentElement.setAttribute('dir', 'rtl')
    renderSidebar({
      locale: 'ar',
      spaces: [spaceRow({ label: 'Course on Arabic and Latin, part two' })],
    })
    const row = screen.getByRole('link', { name: /^Course on Arabic/ })
    const label = row.querySelector('bdi')!
    const cover = row.querySelector('span')!.getBoundingClientRect()
    const name = label.getBoundingClientRect()
    expect(label.parentElement!.scrollHeight).toBeLessThanOrEqual(label.parentElement!.clientHeight)
    expect(cover.left - name.right).toBeLessThan(16)
  })

  it('a cover that fails to load leaves the empty slot', async () => {
    renderSidebar({ spaces: [spaceRow({ label: 'Broken cover', cover: '/missing-cover.png' })] })
    const row = screen.getByRole('link', { name: /^Broken cover/ })
    await waitFor(() => expect(row.querySelector('img')).toBeNull())
  })
})
