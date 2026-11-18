import 'dotenv/config'
import 'next/dist/server/node-environment-baseline'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { requireLocalStorage } from './testing/local-env'

vi.resetModules()

const isolatedSearchDB =
  process.env.DATABASE_URL === 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
if (!isolatedSearchDB && !process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point at the local docker Postgres. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.',
  )
}
requireLocalStorage(process.env)

afterEach(() => {
  cleanup()
  vi.resetModules()
})
