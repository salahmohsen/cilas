// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const fromPayload = createRequire(import.meta.resolve('payload'))
const merge = fromPayload('deepmerge') as (
  target: object,
  source: object,
) => Record<string, unknown>

describe('the installed deepmerge security patch', () => {
  it.each([
    [JSON.parse('{"__proto__":{"admin":true}}'), {}],
    [Object.create(null), JSON.parse('{"__proto__":{"admin":true}}')],
    [{ nested: JSON.parse('{"__proto__":{"admin":true}}') }, {}],
  ])('does not inject a prototype through either input', (target, source) => {
    const result = merge(target, source)
    expect(result.admin).toBeUndefined()
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    if (result.nested) {
      expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype)
      expect((result.nested as Record<string, unknown>).admin).toBeUndefined()
    }
    expect(Object.prototype).not.toHaveProperty('admin')
  })

  it('still merges ordinary configuration, arrays, and symbols', () => {
    const symbol = Symbol('config')
    expect(
      merge({ nested: { a: 1 }, list: [1], [symbol]: 'kept' }, { nested: { b: 2 }, list: [2] }),
    ).toEqual({ nested: { a: 1, b: 2 }, list: [1, 2], [symbol]: 'kept' })
  })
})
