import { describe, expect, it } from 'vitest'

import { textDirection } from '@/lib/text-direction'

describe('textDirection', () => {
  it('reads the first strong letter', () => {
    expect(textDirection('Besides the course fee')).toBe('ltr')
    expect(textDirection('إرسال الصور الرقمية (Digital Negative)')).toBe('rtl')
    expect(textDirection('2026: the Bridge')).toBe('ltr')
    expect(textDirection('٢٠٢٦: برنامج الجسر')).toBe('rtl')
  })

  it('treats text with no letters as left to right', () => {
    expect(textDirection('')).toBe('ltr')
    expect(textDirection('200 EGP')).toBe('ltr')
    expect(textDirection('— 12 —')).toBe('ltr')
  })
})
