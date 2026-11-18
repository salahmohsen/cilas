import { vi } from 'vitest'

const requiredServerEnv = {
  PAYLOAD_SECRET: 'test-payload-secret',
  R2_BUCKET: 'test-bucket',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
  R2_PUBLIC_URL: 'https://media.example.test',
  NEXT_PUBLIC_SERVER_URL: 'https://example.test',
}

/**
 * Sets environment variables, clears the module cache, then runs `load`, so
 * the real `@/env` or `@/env.client` reads them. Supplies the variables
 * `@/env` requires with test values; a value in `vars` wins, and `''` unsets
 * an optional one. Call `load` with a dynamic `import()`: a static import
 * runs before the variables are set. For unit tests: the test values replace
 * PAYLOAD_SECRET and the R2 settings that a live Payload needs.
 */
export const importWithEnv = async <Module>(
  vars: Record<string, string>,
  load: () => Promise<Module>,
) => {
  for (const [name, value] of Object.entries({ ...requiredServerEnv, ...vars })) {
    vi.stubEnv(name, value)
  }
  vi.resetModules()
  return load()
}
