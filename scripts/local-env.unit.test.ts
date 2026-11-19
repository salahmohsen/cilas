import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'

import { withLocalEnv } from './local-env.mjs'

const production = 'production-payload-secret'
const overrides = { R2_BUCKET: 'cilas-local' }

describe('withLocalEnv', () => {
  it('never writes the production PAYLOAD_SECRET', () => {
    for (const text of ['', `PAYLOAD_SECRET="${production}"\n`, `PAYLOAD_SECRET=${production}\n`]) {
      const out = withLocalEnv(text, overrides, production)
      expect(out).not.toContain(production)
      expect(parseEnv(out).PAYLOAD_SECRET).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('keeps a local secret of its own and is idempotent', () => {
    const text = 'PAYLOAD_SECRET="local-only"\nRESEND_API_KEY="x"\n'
    const once = withLocalEnv(text, overrides, production)
    expect(parseEnv(once)).toEqual({
      PAYLOAD_SECRET: 'local-only',
      RESEND_API_KEY: 'x',
      R2_BUCKET: 'cilas-local',
    })
    expect(withLocalEnv(once, overrides, production)).toBe(once)
  })

  it('makes a secret when production has none', () => {
    const out = withLocalEnv('', overrides, undefined)
    expect(parseEnv(out).PAYLOAD_SECRET).toMatch(/^[0-9a-f]{64}$/)
  })
})
