import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'

/**
 * Returns the text of a local env file with `overrides` set and a PAYLOAD_SECRET
 * of its own. A local secret that equals the production one would sign tokens
 * the live site accepts, so it is replaced; any other local secret is kept.
 */
export function withLocalEnv(text, overrides, productionSecret) {
  const current = parseEnv(text).PAYLOAD_SECRET
  const keep = current && current !== productionSecret
  const values = {
    ...overrides,
    PAYLOAD_SECRET: keep ? current : randomBytes(32).toString('hex'),
  }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`
    const pattern = new RegExp(`^${key}=.*$`, 'gm')
    text = pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`
  }
  return text
}
