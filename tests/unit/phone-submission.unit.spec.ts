import { it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'
import { validateApplication } from '@/forms/application-validation'

it.each(['+20100', '+201001234567890', '01001234567', '+20 1001234567'])(
  'server refuses invalid phone %s before saving',
  async (value) => {
    const req = {
      payload: {
        findByID: async () => ({ fields: [{ blockType: 'phone', name: 'phone', required: true }] }),
      },
    } as unknown as PayloadRequest
    await expect(
      validateApplication(req, { form: 1, submissionData: [{ field: 'phone', value }] }),
    ).rejects.toThrow('Enter a valid phone number with its country code.')
  },
)
