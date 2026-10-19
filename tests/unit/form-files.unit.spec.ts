import { describe, expect, it } from 'vitest'

import { acceptAttribute, fileAllowed, maxBytes, maxCount, MAX_SIZE_MB } from '@/lib/form-files'

describe('form file rules', () => {
  it('takes a PDF by default, and checks both the name and the type', () => {
    expect(fileAllowed({}, { name: 'cv.PDF', type: 'application/pdf' })).toBe(true)
    expect(fileAllowed({}, { name: 'cv.pdf', type: 'text/html' })).toBe(false)
    expect(fileAllowed({}, { name: 'cv.exe', type: 'application/pdf' })).toBe(false)
  })

  it('takes the kinds a question names', () => {
    const rule = { accept: ['word', 'image'] as const }
    expect(
      fileAllowed(
        { accept: [...rule.accept] },
        {
          name: 'a.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ),
    ).toBe(true)
    expect(
      fileAllowed({ accept: [...rule.accept] }, { name: 'a.pdf', type: 'application/pdf' }),
    ).toBe(false)
    expect(acceptAttribute({ accept: ['pdf'] })).toBe('.pdf,application/pdf')
  })

  it('caps the size whatever a question asks, and counts one file unless several', () => {
    expect(maxBytes({ maxSizeMB: 500 })).toBe(MAX_SIZE_MB * 1024 * 1024)
    expect(maxBytes({})).toBe(10 * 1024 * 1024)
    expect(maxCount({})).toBe(1)
    expect(maxCount({ multiple: true })).toBe(5)
  })
})
