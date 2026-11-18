// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
// DOM assertions (`toBeDisabled`, `toBeInTheDocument`, …) in unit tests.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Each unit file has its own module state. Tests within a file also reset
// modules and unmount their DOM, so a later test starts with no rendered form.
vi.resetModules()

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

// Node 25+ defines its own `localStorage` global, which reads as undefined
// without `--localstorage-file`, and vitest's jsdom environment does not
// replace a global that already exists. Point it at jsdom's storage.
const jsdomStorage = (globalThis as { jsdom?: { window: Window } }).jsdom?.window.localStorage
if (jsdomStorage && globalThis.localStorage === undefined) {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdomStorage, configurable: true })
}

// jsdom has no matchMedia. By default no media query matches (a wide screen);
// a test that needs a phone stubs its own.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// Radix FocusScope schedules `setTimeout(0)` on unmount to dispatch an
// unmount-autofocus event. When the last test in a file unmounts an open
// dialog in `afterEach(cleanup)`, that timer used to fire after vitest tore
// the jsdom environment down. The global `CustomEvent` was then Node's, not
// jsdom's, and `dispatchEvent` threw an unhandled TypeError that failed the
// whole run. So: unmount first, wait one macrotask so those timers finish
// while the DOM still exists, then reset modules for the next test.
afterEach(async () => {
  cleanup()
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  vi.resetModules()
})
