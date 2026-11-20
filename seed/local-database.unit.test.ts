import { describe, expect, it } from 'vitest'

import { requireLocalSeedDatabase } from './local-database'

describe('requireLocalSeedDatabase', () => {
  it.each([
    'postgres://cilas:dev@localhost:5433/cilas_dev',
    'postgres://cilas:dev@localhost:5433/cilas_empty',
  ])('returns %s', (url) => {
    expect(requireLocalSeedDatabase(url)).toBe(url)
  })

  it.each([
    'postgres://cilas:dev@127.0.0.1:5433/cilas_dev',
    'postgres://cilas:dev@localhost:5442/cilas',
    'postgres://cilas:dev@db.example.com:5433/cilas',
    'postgres://cilas:dev@localhost:5433/cilas?host=db.example.com',
    'postgres://cilas:dev@localhost:5433/cilas?port=5442',
    'postgres://cilas:dev@localhost:5433/cilas?host=db.example.com&port=5442',
    'postgres://cilas:dev@localhost:5433/cilas?options=-c%20search_path%3Dx',
    'postgres://cilas:dev@localhost:5433/cilas_dev?sslmode=disable',
    'postgres://cilas:dev@%2Fvar%2Frun%2Fpostgresql/cilas_dev',
    'postgres://cilas:dev@/cilas_dev?host=/var/run/postgresql',
    'postgres://cilas:dev@localhost:5433/cilas_dev#x',
    undefined,
  ])('refuses %s', (url) => {
    expect(() => requireLocalSeedDatabase(url)).toThrow(/Refusing to seed/)
  })

  it('tells the reader which URL to export', () => {
    expect(() => requireLocalSeedDatabase(undefined)).toThrow(
      'Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev',
    )
  })
})
