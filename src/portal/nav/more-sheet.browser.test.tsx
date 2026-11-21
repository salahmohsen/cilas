import { act, cleanup, screen, within } from '@testing-library/react'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createTranslator } from 'next-intl'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import '../../app/(frontend)/styles.css'
import {
  ToastStack,
  ToastStackProvider,
  useToastStack,
  type ToastStackApi,
} from '@/components/arc/toast-stack/toast-stack'
import { unreadCount } from '@/lib/unread-count'
import {
  BrowserNavigation,
  createBrowserRouter,
} from '../../../testing/browser-navigation.test-utils'
import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-browser.test-utils'
import { MoreSheet } from './more-sheet'
import { spaceRow } from './space-link.test-utils'

const LONG_ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.repeat(3).slice(0, 60)

const session: { user: object | null } = { user: null }

mockNetwork(http.get('/api/users/me', () => HttpResponse.json({ user: session.user })))

const spokenMany = (locale: 'en' | 'ar') => {
  const t = createTranslator({ locale, messages: messagesOf[locale], namespace: 'Portal.nav' })
  return unreadCount(120, locale, {
    some: (values) => t('unread', values),
    many: (values) => t('unreadMany', values),
  })
}

function Probe({ into }: { into: { current: ToastStackApi | null } }) {
  const api = useToastStack()
  useEffect(() => {
    into.current = api
  })
  return null
}

function Open({ locale, onSignOut }: { locale: 'en' | 'ar'; onSignOut: () => Promise<void> }) {
  const more = useRef<HTMLButtonElement>(null)
  const spaces = Array.from({ length: 40 }, (_, i) =>
    spaceRow({
      label: i === 0 ? (locale === 'ar' ? LONG_ARABIC : 'Other course') : `Space ${i}`,
      unread: i === 0 ? 120 : i % 3,
    }),
  )
  return (
    <div data-page="spaces">
      <button ref={more} type="button">
        More
      </button>
      <MoreSheet
        open
        onOpenChange={() => {}}
        items={[]}
        spaces={spaces}
        returnFocus={more}
        onSignOut={onSignOut}
      />
    </div>
  )
}

const renderSheet = (
  locale: 'en' | 'ar',
  onSignOut: () => Promise<void> = () => Promise.resolve(),
) => {
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  const toasts: { current: ToastStackApi | null } = { current: null }
  render(
    <BrowserNavigation browser={createBrowserRouter()}>
      <IntlProvider locale={locale}>
        <ToastStackProvider>
          <Probe into={toasts} />
          <Open locale={locale} onSignOut={onSignOut} />
          <ToastStack label={messagesOf[locale].Notifications.label} />
        </ToastStackProvider>
      </IntlProvider>
    </BrowserNavigation>,
  )
  return toasts
}

const sheetBody = () => {
  const dialog = screen.getByRole('dialog')
  return { dialog, body: dialog.querySelector('[class*="body"]') as HTMLElement }
}

afterEach(() => {
  cleanup()
  session.user = null
  document.documentElement.removeAttribute('dir')
})

describe('MoreSheet', () => {
  for (const width of [320, 390])
    for (const locale of ['en', 'ar'] as const)
      it(`40 rows fit the More sheet at ${width} (${locale})`, async () => {
        await page.viewport(width, 844)
        renderSheet(locale)
        const { dialog, body } = sheetBody()
        await expect.poll(() => within(dialog).getAllByRole('link').length).toBeGreaterThan(40)
        expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
        const { shown, spoken } = spokenMany(locale)
        const first = within(dialog)
          .getAllByRole('link')
          .find((link) => link.textContent?.includes(shown))!
        expect(first).toHaveAccessibleName(new RegExp(`${spoken}$`))
        const last = within(dialog).getByRole('link', { name: /Space 39/ })
        last.scrollIntoView({ block: 'end' })
        await expect
          .poll(() => last.getBoundingClientRect().bottom)
          .toBeLessThanOrEqual(body.getBoundingClientRect().bottom)
      })

  it('the account comes first: who is signed in, then Profile and settings', async () => {
    session.user = { id: 7, email: 'reader@example.com', person: { id: 3, name: 'Reem Reader' } }
    renderSheet('en')
    const { dialog } = sheetBody()
    const account = within(dialog).getByRole('region', { name: 'Account' })
    await expect.poll(() => within(account).queryByText('Reem Reader')).not.toBeNull()
    expect(within(account).getByText('reader@example.com')).toBeVisible()
    expect(within(dialog).getAllByRole('link')[0]).toHaveAccessibleName('Profile and settings')
  })

  it('an account with no person shows its email once', async () => {
    session.user = { id: 8, email: 'admin-with-a-very-long-address@example.com', person: null }
    renderSheet('en')
    const { dialog } = sheetBody()
    const account = within(dialog).getByRole('region', { name: 'Account' })
    await expect
      .poll(() => within(account).queryAllByText('admin-with-a-very-long-address@example.com'))
      .toHaveLength(1)
  })

  it('a second tap while signing out does nothing, and the row says it is signing out', async () => {
    const calls: number[] = []
    let finish = () => {}
    renderSheet('en', () => {
      calls.push(calls.length)
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const button = within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign out' })
    await userEvent.click(button)
    await userEvent.click(button)
    expect(calls).toHaveLength(1)
    expect(button).toHaveAccessibleName('Signing out')
    expect(button).toHaveAttribute('aria-busy', 'true')
    act(() => finish())
    await expect.poll(() => button.getAttribute('aria-busy')).toBeNull()
    expect(button).toHaveAccessibleName('Sign out')
  })

  it('a toast in a More sheet scrolled to its end stays in view (390 x 844)', async () => {
    await page.viewport(390, 844)
    const toasts = renderSheet('en')
    const { dialog, body } = sheetBody()
    await expect.poll(() => within(dialog).getAllByRole('link').length).toBeGreaterThan(40)
    body.scrollTop = body.scrollHeight
    act(() => {
      toasts.current!.toast({ title: 'E2E comment', duration: Infinity })
    })
    const toast = await within(dialog).findByText('E2E comment')
    await expect.poll(() => toast.getBoundingClientRect().bottom).toBeLessThanOrEqual(844)
    const box = toast.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(844 - box.bottom).toBeLessThan(64)
  })
})
