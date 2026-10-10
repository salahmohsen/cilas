import { describe, expect, it } from 'vitest'

import { resolveUpload } from '../../migration/lib/uploads'

const files = new Set([
  'uploads/1/9/1/0/19102967/syllabus.pdf',
  'uploads/1/9/1/0/19102967/1022666471_orig.jpg',
])

describe('resolveUpload', () => {
  it('accepts relative, rooted, absolute and Wayback-wrapped links', () => {
    for (const href of [
      'uploads/1/9/1/0/19102967/syllabus.pdf',
      '/uploads/1/9/1/0/19102967/syllabus.pdf',
      'https://www.ci-las.org/uploads/1/9/1/0/19102967/syllabus.pdf',
      'https://cilas.lkssystems.com/uploads/1/9/1/0/19102967/syllabus.pdf',
      'https://web.archive.org/web/2025id_/https://www.ci-las.org/uploads/1/9/1/0/19102967/syllabus.pdf',
    ]) {
      expect(resolveUpload(href, files)).toEqual({
        path: 'uploads/1/9/1/0/19102967/syllabus.pdf',
        missing: false,
      })
    }
  })

  it('maps a published image to its _orig file', () => {
    expect(resolveUpload('uploads/1/9/1/0/19102967/published/1022666471.jpg?1510668144', files)).toEqual({
      path: 'uploads/1/9/1/0/19102967/1022666471_orig.jpg',
      missing: false,
    })
  })

  it('keeps an unknown upload, marked missing', () => {
    expect(resolveUpload('/uploads/1/9/1/0/19102967/gone.pdf', files)).toEqual({
      path: 'uploads/1/9/1/0/19102967/gone.pdf',
      missing: true,
    })
  })

  it('ignores links that are not uploads', () => {
    expect(resolveUpload('https://example.org/x.pdf', files)).toBeNull()
    expect(resolveUpload('fall-cycle-2024.html', files)).toBeNull()
  })
})
