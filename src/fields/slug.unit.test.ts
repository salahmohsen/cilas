import type { RowField } from 'payload'
import { describe, expect, it } from 'vitest'

import { slugField } from './slug'

const slugHook = () => {
  const row = slugField() as RowField
  const text = row.fields.find((field) => field.type === 'text')
  const hook = text?.type === 'text' ? text.hooks?.beforeChange?.[0] : undefined
  if (!hook) throw new Error('slugField built no slug hook')
  return hook
}

describe('slugField', () => {
  it('a new draft whose slug and every numbered suffix are taken gets a random suffix', async () => {
    const taken = async () => ({ totalDocs: 1 })
    const slug = await slugHook()({
      collection: { slug: 'articles', versions: { drafts: true } },
      data: { title: 'Taken Title' },
      operation: 'create',
      originalDoc: undefined,
      req: { payload: { config: {}, count: taken, countVersions: taken } },
      siblingData: { generateSlug: true },
      value: undefined,
    } as never)
    expect(slug).toMatch(/^taken-title-[0-9a-f]{8}$/)
  })
})
