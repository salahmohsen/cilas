import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { renderWithIntl } from '../../../testing/intl.test-utils'
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
}: { folded?: boolean; locale?: 'en' | 'ar'; spaces?: SpaceLink[] } = {}) =>
  renderWithIntl(
    <div data-page="spaces">
      <Sidebar items={[HOME]} spaces={spaces} folded={folded} accountId={7} />
    </div>,
    { locale },
  )

afterEach(() => {
  cleanup()
  clearCookies()
  document.documentElement.removeAttribute('dir')
})

describe('Sidebar', () => {
  it('[ folds only while focus is inside the sidebar', async () => {
    renderSidebar()
    const fold = screen.getByRole('button', { name: 'Fold the sidebar' })
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    document.body.focus()
    await userEvent.keyboard('[[')
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    expect(document.cookie).not.toContain('portal-folded-7')
    screen.getByRole('link', { name: 'Home' }).focus()
    await userEvent.keyboard('[[')
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(document.cookie).toContain('portal-folded-7=1')
  })

  it('folded and unfolded rows have the same accessible names', async () => {
    renderSidebar()
    const home = screen.getByRole('link', { name: 'Home' })
    const space = screen.getByRole('link', { name: /^Other course/ })
    const names = [home, space].map((link) => link.textContent)
    expect(space).toHaveAccessibleName(/^Other course\s?, more than 9 unread posts$/)
    await userEvent.click(screen.getByRole('button', { name: 'Fold the sidebar' }))
    expect(screen.getByRole('button', { name: 'Fold the sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(home).toHaveAccessibleName('Home')
    expect(space).toHaveAccessibleName(/^Other course\s?, more than 9 unread posts$/)
    expect([home, space].map((link) => link.textContent)).toEqual(names)
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
          renderSidebar({ folded, locale, spaces })
          const nav = screen.getByRole('navigation')
          expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth)
          const many = locale === 'ar' ? 'أكثر من 9' : 'more than 9'
          const first = screen.getAllByRole('link')[1]!
          expect(first).toHaveTextContent('9+')
          const circle = [...first.querySelectorAll('[aria-hidden="true"]')].find(
            (el) => el.textContent === '9+',
          )!
          expect(getComputedStyle(circle).direction).toBe('ltr')
          expect(first).toHaveAccessibleName(new RegExp(many))
        })
})
