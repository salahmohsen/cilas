import { describe, expect, it } from 'vitest'

import { editableIn } from '@/lib/editable'

describe('editableIn', () => {
  it('marks fields, rows, containers and the document in live preview', () => {
    const pe = editableIn(true)
    expect(pe('title')).toEqual({ 'data-pve-field': 'title' })
    expect(pe('sessions.2', { row: { id: 'abc' } })).toMatchObject({
      'data-pve-field': 'sessions.2',
      'data-pve-row': 'abc',
    })
    expect(pe.container('sessions')).toEqual({ 'data-pve-container': 'sessions' })
    expect(pe.scope({ collection: 'courses', id: 7 })).toEqual({ 'data-pve-scope': 'collection:courses;id:7' })
  })

  it('adds nothing to the public page', () => {
    const pe = editableIn(false)
    expect(pe('title')).toEqual({})
    expect(pe.container('sessions')).toEqual({})
    expect(pe.scope({ collection: 'courses', id: 7 })).toEqual({})
  })
})
