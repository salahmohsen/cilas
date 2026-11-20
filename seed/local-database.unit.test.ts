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
    undefined,
  ])('refuses %s', (url) => {
    expect(() => requireLocalSeedDatabase(url)).toThrow(/Refusing to seed/)
  })
})
