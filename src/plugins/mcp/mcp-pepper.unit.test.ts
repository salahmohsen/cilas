import { describe, expect, it } from 'vitest'

import { assertAssistantSecret } from '@/plugins/mcp/pepper'

const long = 'p'.repeat(32)

describe('the assistant sign-in secret', () => {
  it('is required by a running production server', () => {
    expect(() => assertAssistantSecret({ NODE_ENV: 'production' })).toThrow(
      'PMOAUTH_TOKEN_PEPPER is required',
    )
    expect(() =>
      assertAssistantSecret({ NODE_ENV: 'production', PMOAUTH_TOKEN_PEPPER: '' }),
    ).toThrow()
  })

  it('must be 32 characters or more', () => {
    expect(() =>
      assertAssistantSecret({ NODE_ENV: 'production', PMOAUTH_TOKEN_PEPPER: 'p'.repeat(31) }),
    ).toThrow()
    expect(() =>
      assertAssistantSecret({ NODE_ENV: 'production', PMOAUTH_TOKEN_PEPPER: long }),
    ).not.toThrow()
  })

  it('is not needed while building, in development or in tests', () => {
    expect(() =>
      assertAssistantSecret({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }),
    ).not.toThrow()
    expect(() => assertAssistantSecret({ NODE_ENV: 'development' })).not.toThrow()
    expect(() => assertAssistantSecret({ NODE_ENV: 'test' })).not.toThrow()
    expect(() => assertAssistantSecret({})).not.toThrow()
  })
})
