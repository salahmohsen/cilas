// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
// DOM assertions (`toBeDisabled`, `toBeInTheDocument`, …) in unit tests.
import '@testing-library/jest-dom/vitest'

// Integration specs need the migrated local schema. dotenv reads .env only,
// and .env still names the production database, so refusal is structural:
// the URL must be exported on the command and must be this branch's docker
// Postgres.
const isolatedSearchDB = process.env.DATABASE_URL === 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
if (!isolatedSearchDB && !process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point at the local docker Postgres. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.',
  )
}
