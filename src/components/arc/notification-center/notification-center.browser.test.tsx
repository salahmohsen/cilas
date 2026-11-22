import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import '../foundation.css'
import { NotificationCenter, type NotificationItem } from './notification-center'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('dir')
})

const LONG_LATIN = 'Quarterly review of the editorial calendar and the reading group schedule'

const item = (title: string) =>
  ({ id: '1', title, description: title, time: '2m' }) satisfies NotificationItem

const titleOf = async (dir: 'rtl' | 'ltr', title: string) => {
  await page.viewport(390, 800)
  document.documentElement.setAttribute('dir', dir)
  render(<NotificationCenter notifications={[item(title)]} open />)
  const strong = await vi.waitFor(() => {
    const found = document.querySelector<HTMLElement>('[role="dialog"] strong')
    if (!found) throw new Error('the panel is not open')
    return found
  })
  return strong
}

const firstCharVisible = (strong: HTMLElement) => {
  const text = strong.querySelector('bdi')?.firstChild ?? strong.firstChild!
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, 1)
  const char = range.getBoundingClientRect()
  const box = strong.getBoundingClientRect()
  return char.left >= box.left - 0.5 && char.right <= box.right + 0.5
}

describe('NotificationCenter titles', () => {
  it.each(['rtl', 'ltr'] as const)(
    'a Latin title that overflows keeps its first letter in view (%s page)',
    async (dir) => {
      const strong = await titleOf(dir, LONG_LATIN)
      expect(strong.scrollWidth).toBeGreaterThan(strong.clientWidth)
      expect(firstCharVisible(strong)).toBe(true)
    },
  )

  it('an Arabic title that overflows keeps its first letter in view (rtl page)', async () => {
    const strong = await titleOf(
      'rtl',
      'مراجعة فصلية لتقويم التحرير ومجموعة القراءة وجدول الاجتماعات',
    )
    expect(strong.scrollWidth).toBeGreaterThan(strong.clientWidth)
    expect(firstCharVisible(strong)).toBe(true)
  })
})
