import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { ShareBar } from '@/components/share-bar'
import { StudyWithAI } from '@/components/study-with-ai'
import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import '../arc/foundation.css'
import '../../app/(frontend)/styles.css'
import { ArticleActionRow } from './article-action-row'

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

      viewport.scrollLeft = direction === 'rtl' ? -viewport.scrollWidth : viewport.scrollWidth
      await expect.poll(() => Math.abs(viewport.scrollLeft)).toBeGreaterThan(0)
      const endAction = within(viewport).getAllByRole('button').at(-1)!
      const bounds = viewport.getBoundingClientRect()
      const action = endAction.getBoundingClientRect()
      expect(action.left).toBeGreaterThanOrEqual(bounds.left - 1)
      expect(action.right).toBeLessThanOrEqual(bounds.right + 1)
    }
  },
)
