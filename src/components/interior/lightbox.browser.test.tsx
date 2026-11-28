import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import '../arc/foundation.css'
import { Lightbox } from './lightbox'

// WARNING: the image must load. A failed one adds a Retry button ahead of the caption in the tab order.
const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='

afterEach(() => document.documentElement.removeAttribute('data-theme'))

function open(locale: string, messages: typeof en) {
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
      <Lightbox alt="A photo" caption="Short caption" onClose={() => {}} open src={pixel} />
    </NextIntlClientProvider>,
  )
  return screen.getByRole('heading').parentElement!
}

it.each([
  { locale: 'en', messages: en, theme: 'light' },
  { locale: 'en', messages: en, theme: 'dark' },
  { locale: 'ar', messages: ar, theme: 'light' },
  { locale: 'ar', messages: ar, theme: 'dark' },
])(
  'draws the keyboard focus ring of the caption inside its clipped frame ($locale, $theme)',
  async ({ locale, messages, theme }) => {
    await page.viewport(1440, 900)
    document.documentElement.dataset.theme = theme
    const caption = open(locale, messages)
    await userEvent.tab()
    await expect.poll(() => document.activeElement).toBe(caption)

    const ring = getComputedStyle(caption)
    expect(ring.outlineStyle).toBe('solid')
    expect(ring.outlineWidth).toBe('2px')
    expect(ring.outlineColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(parseFloat(ring.outlineOffset)).toBeLessThanOrEqual(-parseFloat(ring.outlineWidth))
    expect(ring.borderTopLeftRadius).toBe(
      getComputedStyle(caption.parentElement!).borderTopLeftRadius,
    )
  },
)

it('gives a short caption its own 3rem-high row on a phone', async () => {
  await page.viewport(390, 844)
  const caption = open('en', en)
  const frame = caption.parentElement!
  const toolbar = frame.parentElement!
  await expect.poll(() => getComputedStyle(caption).maxHeight).toBe('48px')
  expect(getComputedStyle(screen.getByRole('heading')).maxHeight).toBe('none')
  const style = getComputedStyle(toolbar)
  const inner = toolbar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  expect(frame.getBoundingClientRect().width).toBeCloseTo(inner, 0)
})
