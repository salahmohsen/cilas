import { describe, expect, it } from 'vitest'

import { titleOf } from './title-of'

describe('titleOf', () => {
  it('gives the title in the reader locale, else the other one', () => {
    expect(titleOf({ en: 'Hello', ar: 'مرحبا' }, 'ar')).toBe('مرحبا')
    expect(titleOf({ en: 'Hello', ar: null }, 'ar')).toBe('Hello')
    expect(titleOf({ en: null, ar: 'مرحبا' }, 'en')).toBe('مرحبا')
  })

  it('a plain string stands for itself', () => {
    expect(titleOf('Plain', 'en')).toBe('Plain')
  })

  it.each([[''], ['   '], ['\n\t ']])('a title of only whitespace (%j) is no title', (blank) => {
    expect(titleOf(blank, 'en')).toBeNull()
    expect(titleOf({ en: blank, ar: blank }, 'en')).toBeNull()
  })

  it('a blank title in the reader locale falls back to the other one', () => {
    expect(titleOf({ en: '  ', ar: 'مرحبا' }, 'en')).toBe('مرحبا')
  })

  it('trims the title it gives', () => {
    expect(titleOf({ en: '  Hello  ', ar: null }, 'en')).toBe('Hello')
    expect(titleOf('  Plain ', 'en')).toBe('Plain')
  })

  it('no value is no title', () => {
    expect(titleOf(null, 'en')).toBeNull()
    expect(titleOf(undefined, 'ar')).toBeNull()
  })
})
