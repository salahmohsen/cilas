import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@payloadcms/next/css'
import 'payload-theme/styles.css'
import '@/components/admin/admin-switch.css'

const mountPayloadCheckboxMarkup = (dir: 'ltr' | 'rtl', checked: boolean, width: number) =>
  render(
    <div dir={dir} style={{ width }}>
      <div className="field-type checkbox">
        <div className={`checkbox-input${checked ? ' checkbox-input--checked' : ''}`}>
          <div className="checkbox-input__input">
            <input type="checkbox" id="ai" defaultChecked={checked} />
            <span className="checkbox-input__icon check" data-testid="thumb" />
          </div>
          <label className="field-label" htmlFor="ai">
            Show the Study with AI buttons
          </label>
        </div>
      </div>
    </div>,
  )

const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()

afterEach(cleanup)

describe('the admin switch', () => {
  it.each([
    ['ltr', false],
    ['ltr', true],
    ['rtl', false],
    ['rtl', true],
  ] as const)(
    'keeps its thumb inside the track, evenly inset (%s, checked: %s)',
    async (dir, checked) => {
      mountPayloadCheckboxMarkup(dir, checked, 600)
      await waitFor(() => {
        const track = box('.checkbox-input__input')
        const thumb = screen.getByTestId('thumb').getBoundingClientRect()
        const inset = thumb.top - track.top
        expect(inset).toBeGreaterThan(0)
        expect(track.bottom - thumb.bottom).toBeCloseTo(inset, 0)
        const restsOnTheLeft = (dir === 'ltr') !== checked
        const sideInset = restsOnTheLeft ? thumb.left - track.left : track.right - thumb.right
        expect(sideInset).toBeCloseTo(inset, 0)
      })
    },
  )

  it.each(['ltr', 'rtl'] as const)('stays level with a label that wraps (%s)', async (dir) => {
    mountPayloadCheckboxMarkup(dir, true, 160)
    await waitFor(() => {
      const track = box('.checkbox-input__input')
      const label = box('label')
      expect(label.height).toBeGreaterThan(track.height * 1.5)
      expect(track.top + track.height / 2).toBeCloseTo(label.top + label.height / 2, 0)
    })
  })
})
