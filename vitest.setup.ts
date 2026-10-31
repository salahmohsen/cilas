// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
// DOM assertions (`toBeDisabled`, `toBeInTheDocument`, …) in unit tests.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

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

// Radix FocusScope schedules `setTimeout(0)` on unmount to dispatch an
// unmount-autofocus event. When the last test in a file unmounts an open
// dialog in `afterEach(cleanup)`, that timer used to fire after vitest tore
// the jsdom environment down. The global `CustomEvent` was then Node's, not
// jsdom's, and `dispatchEvent` threw an unhandled TypeError that failed the
// whole run. This hook is registered first, so it runs last in each test and
// lets those timers finish while the DOM still exists.
afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
})
