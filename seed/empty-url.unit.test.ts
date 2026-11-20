import { describe, expect, it } from 'vitest'

import { emptyDatabaseUrl } from './empty-url'

describe('emptyDatabaseUrl', () => {
  it('names the cilas_empty database', () => {
    expect(emptyDatabaseUrl('postgres://cilas:dev@localhost:5433/cilas_dev')).toBe(
      'postgres://cilas:dev@localhost:5433/cilas_empty',
    )
  })

  it('keeps the query string', () => {
    expect(emptyDatabaseUrl('postgres://cilas:dev@localhost:5433/cilas_dev?sslmode=disable')).toBe(
      'postgres://cilas:dev@localhost:5433/cilas_empty?sslmode=disable',
    )
  })
})
