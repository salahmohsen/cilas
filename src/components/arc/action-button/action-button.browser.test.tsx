import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/components/arc/foundation.css'
import { ActionButton } from '@/components/arc/action-button/action-button'

const mount = (dir: 'ltr' | 'rtl', label: string) =>
  render(
    <div dir={dir}>
      <ActionButton label={label} onAction={() => {}} />
    </div>,
  )

const shownLabel = () =>
  screen.getByRole('button').querySelector<HTMLElement>('[aria-hidden="true"] > span > span')!

const oneRunWidth = (label: string, like: HTMLElement) => {
  const span = document.createElement('span')
  span.textContent = label
  span.style.cssText = `position:absolute;white-space:pre;font:${getComputedStyle(like).font}`
  like.closest('div')!.append(span)
  const { width } = span.getBoundingClientRect()
  span.remove()
  return width
}

const arrowDrawnSign = () => {
  const arrow = screen.getByRole('button').querySelector<SVGSVGElement>('svg')!
  return Math.sign(arrow.getScreenCTM()!.a)
}

afterEach(cleanup)

describe('ActionButton', () => {
  it('draws an Arabic label as one run, so its letters join', async () => {
    mount('rtl', 'احفظ الإعدادات')
    const label = shownLabel()
    await document.fonts.ready
    const measuredOutsideWaitFor = oneRunWidth('احفظ الإعدادات', label)
    await waitFor(() =>
      expect(label.getBoundingClientRect().width).toBeCloseTo(measuredOutsideWaitFor, 0),
    )
  })

  it('points its arrow forward in the reading direction', async () => {
    mount('ltr', 'Save settings')
    await waitFor(() => expect(arrowDrawnSign()).toBe(1))
    cleanup()
    mount('rtl', 'احفظ الإعدادات')
    await waitFor(() => expect(arrowDrawnSign()).toBe(-1))
  })
})
