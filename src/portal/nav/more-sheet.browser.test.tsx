import { act, cleanup, screen, within } from '@testing-library/react'
import { render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import '../../app/(frontend)/styles.css'
import {
  ToastStack,
  ToastStackProvider,
  useToastStack,
  type ToastStackApi,
} from '@/components/arc/toast-stack/toast-stack'
import {
  BrowserNavigation,
  createBrowserRouter,
} from '../../../testing/browser-navigation.test-utils'
import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import { MoreSheet } from './more-sheet'
import { spaceRow } from './space-link.test-utils'

const LONG_ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.repeat(3).slice(0, 60)

function Probe({ into }: { into: { current: ToastStackApi | null } }) {
  const api = useToastStack()
  useEffect(() => {
    into.current = api
  })
  return null
}

function Open({ locale }: { locale: 'en' | 'ar' }) {
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
        onSignOut={async () => {}}
      />
    </div>
  )
}

const renderSheet = (locale: 'en' | 'ar') => {
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  const toasts: { current: ToastStackApi | null } = { current: null }
  render(
    <BrowserNavigation browser={createBrowserRouter()}>
      <IntlProvider locale={locale}>
        <ToastStackProvider>
          <Probe into={toasts} />
          <Open locale={locale} />
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
        const links = within(dialog).getAllByRole('link')
        const first = links.find((link) => link.textContent?.includes('9+'))!
        const many = messagesOf[locale].Portal.nav.unreadMany.replace(/^[,،]\s*/, '')
        expect(first).toHaveAccessibleName(new RegExp(many))
        const last = within(dialog).getByRole('link', { name: /Space 39/ })
        last.scrollIntoView({ block: 'end' })
        await expect.poll(() => last.getBoundingClientRect().bottom).toBeLessThanOrEqual(844)
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
