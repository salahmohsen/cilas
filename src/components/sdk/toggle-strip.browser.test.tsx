import { cleanup, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { ToggleStrip } from '@/components/sdk/toggle-strip'

import { emulateMedia } from '../../../testing/media.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const DAYS = ['Sat', 'Sun', 'Mon', 'Tue']

function Host({ start, onChange }: { start: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(start)
  return (
    <>
      <button type="button">before</button>
      <h2 id="strip-heading">This week</h2>
      <ToggleStrip
        labelledBy="strip-heading"
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
        items={DAYS.map((day) => ({
          value: day,
          current: day === 'Sun' ? ('date' as const) : undefined,
          content: day,
        }))}
      />
      <button type="button">after</button>
    </>
  )
}

const day = (name: string) => screen.getByRole('button', { name })
const pressed = () => DAYS.filter((name) => day(name).getAttribute('aria-pressed') === 'true')

describe('ToggleStrip', () => {
  beforeAll(() => {
    globalThis.__UI_SDK_STRICT__ = true
  })
  afterEach(cleanup)

  it('has a group named by the heading, with today marked current', () => {
    render(<Host start="Mon" />)
    expect(screen.getByRole('group', { name: 'This week' })).toBeInTheDocument()
    expect(day('Sun')).toHaveAttribute('aria-current', 'date')
    expect(day('Mon')).not.toHaveAttribute('aria-current')
  })

  it('exactly one toggle is pressed, and a press on it keeps it', async () => {
    const onChange = vi.fn()
    render(<Host start="Mon" onChange={onChange} />)
    expect(pressed()).toEqual(['Mon'])
    await userEvent.click(day('Mon'))
    expect(pressed()).toEqual(['Mon'])
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(day('Tue'))
    expect(pressed()).toEqual(['Tue'])
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Tue')
  })

  it('one Tab enters the strip and the next Tab leaves it', async () => {
    render(<Host start="Mon" />)
    day('before').focus()
    await userEvent.keyboard('{Tab}')
    expect(day('Mon')).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    expect(day('after')).toHaveFocus()
  })

  it('the arrow keys move focus and choose nothing; Enter and Space choose', async () => {
    render(<Host start="Mon" />)
    day('Mon').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(day('Tue')).toHaveFocus()
    expect(pressed()).toEqual(['Mon'])
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(day('Sun')).toHaveFocus()
    expect(pressed()).toEqual(['Mon'])
    await userEvent.keyboard('{Enter}')
    expect(pressed()).toEqual(['Sun'])
    await userEvent.keyboard('{ArrowLeft} ')
    expect(day('Sat')).toHaveFocus()
    expect(pressed()).toEqual(['Sat'])
  })

  it('in right to left, ArrowLeft goes to the next item on screen', async () => {
    render(
      <div dir="rtl">
        <Host start="Sun" />
      </div>,
    )
    const left = (name: string) => day(name).getBoundingClientRect().left
    expect(left('Mon')).toBeLessThan(left('Sun'))
    day('Sun').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(day('Mon')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(day('Sat')).toHaveFocus()
  })

  it('no transition with reduced motion', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'no-preference' })
    render(<Host start="Mon" />)
    const duration = () => getComputedStyle(day('Mon')).transitionDuration
    expect(duration()).not.toBe('0s')
    await emulateMedia({ 'prefers-reduced-motion': 'reduce' })
    expect(duration()).toBe('0s')
  })

  it('keeps the pressed toggle apart when forced colours drop the fills', async () => {
    await emulateMedia({ 'forced-colors': 'active' })
    render(<Host start="Mon" />)
    const border = (name: string) => getComputedStyle(day(name)).borderTopWidth
    expect(border('Mon')).not.toBe(border('Tue'))
  })
})
