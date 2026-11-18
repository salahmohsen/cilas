// @vitest-environment node
import { describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { uncoveredFields } from '@/plugins/mcp/field-coverage'
import { flattenFields, type DraftCollection } from '@/plugins/mcp/field-registry'
import accepted from '@/plugins/mcp/accepted-fields.json'

describe('MCP field coverage of the real sanitized collection config', () => {
  it.each(['courses', 'articles'] as DraftCollection[])(
    '%s has no silently omitted field',
    async (collection) => {
      const fields = (await config).collections.find((c) => c.slug === collection)!.fields
      expect(uncoveredFields(collection, fields, accepted[collection])).toEqual([])
      const array = flattenFields(fields).find((field) => field.type === 'array')!
      expect(array?.type).toBe('array')
      if ('fields' in array) {
        array.fields.push({ name: 'dummy_nested_field', type: 'text' })
        try {
          expect(uncoveredFields(collection, fields, accepted[collection])).toContain(
            `${'name' in array ? array.name : ''}.dummy_nested_field`,
          )
        } finally {
          array.fields.pop()
        }
      }
      const dummy = { name: 'dummy_future_field', type: 'text' as const }
      expect(uncoveredFields(collection, [...fields, dummy], accepted[collection])).toContain(
        'dummy_future_field',
      )
    },
  )
})
