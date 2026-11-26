import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/components/arc/foundation.css'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'

const trackingInASheet = (lang: string, text: string) => {
  document.documentElement.lang = lang
  render(
    <BottomSheet title="Sheet" open onOpenChange={() => {}}>
      <p>{text}</p>
    </BottomSheet>,
  )
  return parseFloat(getComputedStyle(screen.getByText(text)).letterSpacing) || 0
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('lang')
})

describe('BottomSheet tracking', () => {
  it('tightens Latin text in a sheet', () => {
    expect(trackingInASheet('en', 'Save settings')).toBeLessThan(0)
  })

  it('leaves Arabic text in a sheet untracked, so its letters keep their joins', () => {
    expect(trackingInASheet('ar', 'احفظ الإعدادات')).toBe(0)
  })
})
