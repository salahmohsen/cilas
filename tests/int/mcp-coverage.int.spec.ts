// @vitest-environment node
import { describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { uncoveredFields } from '@/plugins/mcp/field-coverage'
import { type DraftCollection } from '@/plugins/mcp/field-registry'
import accepted from '@/plugins/mcp/accepted-fields.json'

describe('MCP field coverage of the real sanitized collection config', () => {
  it.each(['courses', 'articles'] as DraftCollection[])(
    '%s has no silently omitted field',
    async (collection) => {
      const fields = (await config).collections.find((c) => c.slug === collection)!.fields
      expect(uncoveredFields(collection, fields, accepted[collection])).toEqual([])
      const dummy = { name: 'dummy_future_field', type: 'text' as const }
      expect(uncoveredFields(collection, [...fields, dummy], accepted[collection])).toContain(
        'dummy_future_field',
      )
    },
  )
})
