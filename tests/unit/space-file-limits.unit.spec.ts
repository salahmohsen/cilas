import { describe, expect, it } from 'vitest'

import { UPLOAD_BODY_LIMIT, UPLOAD_TOTAL_MAX } from '@/lib/space-file-limits'

describe('upload limits', () => {
  it('lets the action body carry the whole allowed total plus the text and multipart framing', () => {
    const bodyBytes = Number.parseInt(UPLOAD_BODY_LIMIT, 10) * 1024 * 1024
    expect(UPLOAD_BODY_LIMIT).toMatch(/^\d+mb$/)
    expect(bodyBytes - UPLOAD_TOTAL_MAX).toBeGreaterThanOrEqual(4 * 1024 * 1024)
  })
})
