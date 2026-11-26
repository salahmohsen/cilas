import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it } from 'vitest'
import { page } from 'vitest/browser'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import { createMemoryRouter, NavigationProvider } from '../../../testing/navigation.test-utils'
import { ArticlesGrid } from '../article/articles-grid'
import '../arc/foundation.css'
import '../../app/(frontend)/styles.css'
import { HomeArticles } from './home-articles'

it.each([
  { locale: 'en', width: 1440, word: 'Unbroken', normal: 'A note on reading in the city' },
  { locale: 'en', width: 390, word: 'Unbroken', normal: 'A note on reading in the city' },
  { locale: 'ar', width: 1440, word: 'العربية', normal: 'ملاحظات عن القراءة في المدينة' },
  { locale: 'ar', width: 390, word: 'العربية', normal: 'ملاحظات عن القراءة في المدينة' },
] as const)(
  'wraps unbroken titles in Latest articles and the featured grid at $width ($locale)',
  async ({ locale, width, word, normal }) => {
    await page.viewport(width, 900)
    const long = word.repeat(40)
    const posts = [long, normal, normal + ' II'].map((title, index) => ({
      id: String(index),
      href: `/${locale}/articles/card-${index}`,
      title,
      excerpt: 'An article description.',
      category: 'Article',
      date: '',
      dateLabel: '',
      readTime: 0,
      readTimeLabel: '',
      author: { name: '' },
    }))

    const messages = locale === 'ar' ? ar : en
    render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
        <NavigationProvider memory={createMemoryRouter(`/${locale}`)}>
          <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <HomeArticles posts={posts} title={messages.Home.latestTitle} />
            <ArticlesGrid
              categories={[]}
              description=""
              flush
              header={false}
              pageSize={posts.length}
              posts={[posts[1]!, posts[0]!, posts[2]!]}
              title={messages.Home.featuredTitle}
            />
          </div>
        </NavigationProvider>
      </NextIntlClientProvider>,
    )

    const checkTitle = (title: HTMLElement) => {
      const card = title.closest('a')!
      expect(card.scrollWidth).toBe(card.clientWidth)
      expect(title.scrollWidth).toBe(title.clientWidth)
      return card
    }
    const latest = within(screen.getByRole('region', { name: messages.Home.latestTitle }))
    const side = latest.getByText(long)
    const active = latest.getByText(normal)
    const sideCard = checkTitle(side)
    const activeCard = checkTitle(active)
    const slide = sideCard.closest('[aria-roledescription="slide"]')!
    expect(slide).toHaveAttribute('inert')
    expect(sideCard.offsetWidth).toBe(slide.clientWidth)
    expect(sideCard.offsetWidth).toBe(activeCard.offsetWidth)
    expect(side.offsetHeight).toBeGreaterThan(active.offsetHeight)
    fireEvent.click(latest.getByRole('button', { name: messages.Home.controls.previous }))
    await waitFor(() => expect(slide).not.toHaveAttribute('inert'))
    expect(checkTitle(side).offsetWidth).toBe(slide.clientWidth)

    const featured = within(screen.getByRole('region', { name: messages.Home.featuredTitle }))
    const gridLongCard = checkTitle(featured.getByRole('heading', { name: long }))
    const gridNormalCard = checkTitle(featured.getByRole('heading', { name: normal + ' II' }))
    expect(gridLongCard.offsetWidth).toBe(gridNormalCard.offsetWidth)
  },
)
