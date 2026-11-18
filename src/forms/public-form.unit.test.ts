import { describe, expect, it } from 'vitest'

import { publicForm } from '@/forms/public-form'

describe('publicForm', () => {
  it('drops the notification addresses and keeps what the renderer reads', () => {
    const form = {
      id: 1,
      title: 'Apply',
      fields: [{ blockType: 'text', name: 'q' }],
      confirmationType: 'message',
      emails: [{ emailTo: 'staff@example.org' }],
    } as never as Parameters<typeof publicForm>[0] & {
      id: number
      title: string
      fields: unknown[]
    }
    const result = publicForm(form)
    expect(result).not.toHaveProperty('emails')
    expect(JSON.stringify(result)).not.toContain('staff@example.org')
    expect(result).toMatchObject({ id: 1, title: 'Apply' })
    expect(result.fields).toHaveLength(1)
  })
})
