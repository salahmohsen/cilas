import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export const isLocalUrl = (url: string | undefined) => {
  if (!url) return false
  try {
    return localHosts.has(new URL(url).hostname)
  } catch {
    return false
  }
}

const storageKeys = [
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_PUBLIC_URL',
  'R2_REGION',
] as const

const localStorageFile = '.env.development.local'

const storageSource = () => {
  if (process.env.R2_ENDPOINT) return process.env
  if (existsSync(localStorageFile)) return parse(readFileSync(localStorageFile))
  return {}
}

const pick = (source: Record<string, string | undefined>, keys: readonly string[]) =>
  Object.fromEntries(
    keys.flatMap((key) => (source[key] === undefined ? [] : [[key, source[key]] as const])),
  ) as Record<string, string>

export const requireLocalStorage = (env: Record<string, string | undefined>) => {
  for (const key of ['R2_ENDPOINT', 'R2_PUBLIC_URL']) {
    if (!isLocalUrl(env[key])) {
      throw new Error(
        `Refusing to run tests: ${key} must point at local storage (RustFS), not "${env[key] ?? 'unset'}". Put the local R2_* settings in ${localStorageFile} or export them.`,
      )
    }
  }
}

/**
 * The environment every Vitest worker starts with. Storage comes as one set:
 * the shell's R2_* when it exports R2_ENDPOINT (CI, the search test), otherwise
 * the R2_* lines of .env.development.local. `.env` never supplies storage, as
 * it holds the production bucket. Mail always gets a test Resend key: Payload
 * builds its real Resend adapter, MSW answers it, and no test holds the real key.
 */
export const testEnv = () => {
  const env = { ...pick(storageSource(), storageKeys), RESEND_API_KEY: 're_test_key' }
  requireLocalStorage(env)
  return env
}
