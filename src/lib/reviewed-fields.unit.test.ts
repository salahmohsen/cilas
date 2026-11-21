import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { NOT_REVIEWED, REVIEWED_FIELDS } from './reviewed-fields'

type AuditRow = { entity: string; field: string; rules: Record<string, string> }

const snapshot = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts/access-audit.snapshot.json'), 'utf8'),
) as AuditRow[]

const collections = ['articles', 'courses', 'publications'] as const

const ownerWritable = (collection: string) =>
  snapshot
    .filter(
      (row) =>
        row.entity === `collection:${collection}` &&
        !row.field.includes('.') &&
        row.field !== '*' &&
        row.rules.update === 'open',
    )
    .map((row) => row.field)
    .sort()

describe('reviewed fields', () => {
  it.each(collections)(
    'reviewed and not reviewed fields cover every owner-writable field of %s',
    (collection) => {
      const reviewed = REVIEWED_FIELDS[collection]
      const notReviewed = [...NOT_REVIEWED.all, ...NOT_REVIEWED[collection]]
      expect([...reviewed, ...notReviewed].sort()).toEqual(ownerWritable(collection))
      expect(reviewed.filter((name) => notReviewed.includes(name))).toEqual([])
    },
  )

  it('courses review fellows', () => {
    expect(REVIEWED_FIELDS.courses).toContain('fellows')
  })

  it('course sessions and schedule are not reviewed', () => {
    expect(NOT_REVIEWED.courses).toEqual(expect.arrayContaining(['sessions', 'schedule']))
    expect(REVIEWED_FIELDS.courses).not.toContain('sessions')
    expect(REVIEWED_FIELDS.courses).not.toContain('schedule')
  })
})
