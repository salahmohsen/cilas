import { describe, expect, it } from 'vitest'

import { withRetired } from '@/forms/applicants'
import { mediaImage } from '@/lib/media-image'

describe('applicant data projection', () => {
  it('shapes a course cover from its media, with the focal point', () => {
    expect(mediaImage({ url: '/cover.jpg', alt: 'Cover', focalX: 30, focalY: null })).toEqual({
      src: '/cover.jpg',
      alt: 'Cover',
      focalX: 30,
      focalY: null,
    })
    expect(mediaImage(null)).toBeUndefined()
  })
  it('keeps an answer to a removed question as a text question', () => {
    const fields = [{ blockType: 'text', name: 'kept' }]
    const shown = withRetired(fields, [
      { name: 'kept', label: 'Kept' },
      { name: 'removed', label: 'Removed question' },
    ])
    expect(shown).toEqual([
      { blockType: 'text', name: 'kept' },
      { blockType: 'textarea', name: 'removed', label: 'Removed question' },
    ])
  })
})
