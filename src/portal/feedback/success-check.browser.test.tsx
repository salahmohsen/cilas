import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { emulateMedia } from '../../../testing/media.test-utils'
import { SuccessCheck } from './success-check'

const renderCheck = (label: string) =>
  render(
    <div data-page="spaces">
      <SuccessCheck label={label} />
    </div>,
  )

const checkOf = (container: HTMLElement) => container.querySelector('svg')!

afterEach(async () => {
  cleanup()
  document.documentElement.removeAttribute('dir')
  await emulateMedia({})
})

describe('SuccessCheck', () => {
  it('draws the check once beside its text', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'no-preference' })
    const { container } = renderCheck('Saved')
    expect(screen.getByText('Saved')).toBeVisible()
    const check = checkOf(container)
    expect(getComputedStyle(check).display).not.toBe('none')
    expect(check).toHaveAttribute('aria-hidden', 'true')
    const animations = check.getAnimations({ subtree: true })
    expect(animations).toHaveLength(1)
    const timing = animations[0]!.effect!.getComputedTiming()
    expect(timing.iterations).toBe(1)
    expect(Number(timing.duration)).toBeGreaterThanOrEqual(120)
    expect(Number(timing.duration)).toBeLessThanOrEqual(200)
  })

  it('reduced motion shows the text only', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'reduce' })
    const { container } = renderCheck('Saved')
    expect(screen.getByText('Saved')).toBeVisible()
    expect(getComputedStyle(checkOf(container)).display).toBe('none')
  })

  it('an Arabic label in an rtl document keeps the check at the inline start', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'no-preference' })
    document.documentElement.setAttribute('dir', 'rtl')
    const { container } = renderCheck('تم الحفظ')
    const check = checkOf(container).getBoundingClientRect()
    const label = screen.getByText('تم الحفظ').getBoundingClientRect()
    expect(check.left).toBeGreaterThanOrEqual(label.right)
  })
})
