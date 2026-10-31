// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
// DOM assertions (`toBeDisabled`, `toBeInTheDocument`, …) in unit tests.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// CI runs unit tests with `--no-isolate`: workers keep one jsdom and Node's
// native module cache across files, so a file must not see another file's
// leftovers. Source modules are re-evaluated for every file (a mocked child
// component from one file cannot leak into the next), and rendered DOM is
// unmounted after every test. Without these two lines the suite is flaky.
vi.resetModules()
afterEach(() => cleanup())

// Integration specs need the migrated local schema. dotenv reads .env only,
// and .env still names the production database, so refusal is structural:
// the URL must be exported on the command and must be this branch's docker
// Postgres.
const isolatedSearchDB =
  process.env.DATABASE_URL === 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
if (!isolatedSearchDB && !process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point at the local docker Postgres. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.',
  )
}
