import { describe, expect, it } from 'vitest'

import { classifyPage, legacyUrlOf } from '../../migration/lib/classify'

describe('legacyUrlOf', () => {
  it('maps a file to its old path, and index to the root', () => {
    expect(legacyUrlOf('fall-cycle-2024.html')).toBe('/fall-cycle-2024.html')
    expect(legacyUrlOf('index.html')).toBe('/')
  })
})

describe('classifyPage', () => {
  it.each([
    ['fall-cycle-2024.html', 'cycle'],
    ['spring-labs-2023.html', 'cycle'],
    ['2014-2015-second-trimester.html', 'cycle'],
    ['2018-2019-cilas-alex-core-courses-2018---2019.html', 'cycle'],
    ['cilas-in-alex-2019-2020.html', 'cycle'],
    ['winter-2023-2024.html', 'cycle'],
    ['translation-lab.html', 'lab'],
    ['research-lab-post-captialism.html', 'lab'],
    ['cilasians-2015-2016.html', 'people'],
    ['advisors.html', 'people'],
    ['darb-el-labbana-current-space-in-cairo.html', 'space'],
    ['al-manshiya-cilas-in-alex.html', 'space'],
    ['bridge-programme.html', 'programme'],
    ['on-pigeon-towers.html', 'publication'],
    ['press.html', 'press'],
    ['-latest.html', 'blog'],
    ['faqs.html', 'info'],
    ['anarchist-recipes.html', 'course'],
    ['power-and-space-critical-approaches-to-the-built-environment.html', 'course'],
  ])('%s is a %s page', (file, kind) => {
    expect(classifyPage(file, {})).toBe(kind)
  })

  it('lets a hand override win', () => {
    expect(classifyPage('anarchist-recipes.html', { 'anarchist-recipes.html': 'info' })).toBe(
      'info',
    )
  })
})
