import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HomeNumbers } from '@/components/home/home-numbers'

const stats = [
  { value: 12, label: 'Years of teaching' },
  { value: 140, label: 'Courses' },
  { value: 85, label: 'Fellows' },
]

const render = (locale: string) =>
  renderToStaticMarkup(createElement(HomeNumbers, { stats, title: 'CILAS in numbers', locale }))

describe('HomeNumbers', () => {
  it('writes each final value with its label, so the row reads right before any script runs', () => {
    const html = render('en')
    expect(html).toContain('CILAS in numbers')
    for (const stat of stats) {
      expect(html).toContain(stat.label)
      expect(html).toContain(`>${stat.value}<`)
    }
  })

  it('writes Arabic pages’ numbers in Arabic-Indic digits', () => {
    const html = render('ar')
    expect(html).toContain('>١٢<')
    expect(html).toContain('>١٤٠<')
    expect(html).toContain('>٨٥<')
    expect(html).not.toContain('>12<')
  })
})
