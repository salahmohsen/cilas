import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./calendar.module.css', import.meta.url), 'utf8')

describe('the calendar stylesheet', () => {
  it('uses no physical left or right', () => {
    expect(css).not.toMatch(
      /\b(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\b\s*:/,
    )
  })

  it('makes touch handles at least 24px, on selected blocks only', () => {
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toMatch(/\.block\[data-selected\] \.edge \{[^}]*block-size: 1\.75rem/)
    expect(coarse).toMatch(/\.edge \{\s*display: none;/)
    expect(css).not.toMatch(/\.track[^{]*\{[^}]*touch-action: none/)
  })

  it('draws an edge on every view-mode element that carries a tone, in the start direction', () => {
    const edged = ['block', 'pill', 'chip', 'monthBar', 'next', 'detailsMark', 'swatch'].filter(
      (selector) =>
        !css.includes(`.${selector}[data-edge] {`) && !css.includes(`.${selector}[data-edge],`),
    )
    expect(edged).toEqual([])
    expect(css).toMatch(
      /\[data-edge\][^{]*\{[^}]*border-inline-start: 3px solid var\(--tone-line\)/,
    )
    expect(css).toMatch(/\[data-edge='double'\][^{]*\{[^}]*border-inline-start-style: double/)
  })
})
