import { describe, expect, it } from 'vitest'

import { latinDigits, localDigits, numberingSystemOf } from '@/lib/digits'

describe('localDigits', () => {
  it('writes Arabic pages’ digits in Arabic-Indic and leaves English ones alone', () => {
    expect(localDigits('17:00–21:00', 'ar')).toBe('١٧:٠٠–٢١:٠٠')
    expect(localDigits(2014, 'ar')).toBe('٢٠١٤')
    expect(localDigits('17:00–21:00', 'en')).toBe('17:00–21:00')
  })
})

describe('latinDigits', () => {
  it('reads Arabic-Indic and Persian digits as Western ones', () => {
    expect(latinDigits('ربيع ٢٠٢٢')).toBe('ربيع 2022')
    expect(latinDigits('۱۴۰۲')).toBe('1402')
  })
})

describe('numberingSystemOf', () => {
  it('gives Arabic its own digits', () => {
    expect(numberingSystemOf('ar')).toBe('arab')
    expect(numberingSystemOf('en')).toBe('latn')
  })
})
