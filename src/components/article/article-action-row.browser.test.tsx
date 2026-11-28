import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it } from 'vitest'
import { page } from 'vitest/browser'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import '../arc/foundation.css'
import '../../app/(frontend)/styles.css'

// WARNING: import components after styles.css, as in production, or the CSS order flips and the style checks cannot fail.
const { ArticleActionRow } = await import('./article-action-row')
const { ShareBar } = await import('@/components/share-bar')
const { StudyWithAI } = await import('@/components/study-with-ai')

it.each([
  { locale: 'en', direction: 'ltr', messages: en },
  { locale: 'ar', direction: 'rtl', messages: ar },
])(
  'keeps the Share and AI actions reachable in a narrow sidebar ($locale)',
  async ({ locale, direction, messages }) => {
    await page.viewport(1440, 900)
    const path = `/${locale}/articles/reading`
    render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
        <div dir={direction} style={{ width: 170 }}>
          <ArticleActionRow flush label={messages.Share.heading}>
            <ShareBar label={messages.Share.article} path={path} title="Reading" />
          </ArticleActionRow>
          <ArticleActionRow flush label={messages.Share.aiHeading}>
            <StudyWithAI kind="article" path={path} />
          </ArticleActionRow>
        </div>
      </NextIntlClientProvider>,
    )

    for (const label of [messages.Share.heading, messages.Share.aiHeading]) {
      const viewport = screen.getByRole('region', { name: label })
      const scrollArea = viewport.parentElement!
      const track = scrollArea.querySelector<HTMLElement>('[data-axis="x"]')!
      await expect.poll(() => track.hasAttribute('data-hidden')).toBe(false)
      expect(getComputedStyle(viewport).scrollbarWidth).toBe('none')
      expect(getComputedStyle(track).opacity).toBe('0')
      expect(viewport.clientWidth).toBe(170)

      const toolbar = within(viewport).getByRole('toolbar')
      await expect.poll(() => getComputedStyle(toolbar).borderTopWidth).toBe('0px')
      const group = getComputedStyle(toolbar)
      expect(group.borderTopLeftRadius).toBe('0px')
      expect(group.padding).toBe('0px')
      expect(group.backgroundColor).toBe('rgba(0, 0, 0, 0)')
      const buttons = within(toolbar).getAllByRole('button')
      for (const button of buttons) {
        await expect.poll(() => button.getBoundingClientRect().height).toBe(44)
        expect(getComputedStyle(button).borderTopLeftRadius).toBe('0px')
      }

      viewport.scrollLeft = direction === 'rtl' ? -viewport.scrollWidth : viewport.scrollWidth
      await expect.poll(() => Math.abs(viewport.scrollLeft)).toBeGreaterThan(0)
      const endAction = within(viewport).getAllByRole('button').at(-1)!
      const bounds = viewport.getBoundingClientRect()
      const action = endAction.getBoundingClientRect()
      expect(action.left).toBeGreaterThanOrEqual(bounds.left - 1)
      expect(action.right).toBeLessThanOrEqual(bounds.right + 1)
      await expect
        .poll(() => {
          const row = toolbar.getBoundingClientRect()
          return buttons.filter((button) => {
            const box = button.getBoundingClientRect()
            return box.left < row.left - 1 || box.right > row.right + 1
          }).length
        })
        .toBe(0)
    }
  },
)
