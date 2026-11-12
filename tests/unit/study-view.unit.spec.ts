import { describe, expect, it } from 'vitest'

import { readStudyView } from '@/lib/study-view'

describe('readStudyView', () => {
  it('shows the list unless the grid is asked for', () => {
    expect(readStudyView(new URLSearchParams(''))).toBe('list')
    expect(readStudyView(new URLSearchParams('view=other'))).toBe('list')
    expect(readStudyView(new URLSearchParams('view=grid&page=2'))).toBe('grid')
  })
})
