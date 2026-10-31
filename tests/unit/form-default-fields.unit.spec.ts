import { describe, expect, it } from 'vitest'

import { ensureNameEmail, nameEmailBlocks } from '@/forms/form-fields'
import type { Form } from '@/payload-types'

const question = (name: string, blockType = 'text') => ({ blockType, name, label: name })
const message = { blockType: 'message' }
const asFields = (fields: unknown[]) => fields as unknown as NonNullable<Form['fields']>

describe('the two default questions', () => {
  it('asks first who applies, then their email', () => {
    expect(nameEmailBlocks.map((b) => [b.name, b.blockType])).toEqual([
      ['name', 'text'],
      ['email', 'email'],
    ])
  })
})

describe('ensureNameEmail', () => {
  const run = (fields: unknown[]) =>
    ensureNameEmail({
      data: { fields: asFields(fields) },
    } as never) as { fields: unknown[] }

  it('prepends both questions to a form that has none', () => {
    const saved = run([question('track', 'select'), question('why', 'textarea'), message])
    expect(saved.fields.map((b) => (b as { name?: string }).name)).toEqual([
      'name',
      'email',
      'track',
      'why',
      undefined, // the text block has no name.
    ])
  })

  it('gives an empty form both questions', () => {
    const saved = run([])
    expect(saved.fields).toHaveLength(2)
    expect(saved.fields.every((b) => (b as { required: boolean }).required)).toBe(true)
  })

  it('puts them back when removed, and once only', () => {
    expect(run([message]).fields.map((b) => (b as { name?: string }).name)).toEqual([
      'name',
      'email',
      undefined,
    ])
    expect(
      run([question('name'), question('email', 'email'), question('name')]).fields.filter(
        (b) => (b as { name?: string }).name === 'name',
      ),
    ).toHaveLength(1)
  })

  it('keeps the default labels: a rename is not a way out', () => {
    const saved = run([question('name'), question('email', 'email'), question('track')])
    const first = saved.fields.map((b) => ({
      name: (b as { name?: string }).name,
      label: (b as { label?: string }).label,
    }))
    expect(first.slice(0, 3)).toEqual([
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'track', label: 'track' },
    ])
  })
})
