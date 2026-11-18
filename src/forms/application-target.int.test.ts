import { NotFound, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadApplicationTarget } from '@/forms/application-target'
import config from '@/payload.config'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.destroy()
})

describe('loadApplicationTarget', () => {
  it('treats only a missing application target as absent', async () => {
    expect(await loadApplicationTarget(payload, 'courses', 2_000_000_000)).toBeNull()
  })

  it('propagates database errors', async () => {
    const failure = await loadApplicationTarget(payload, 'courses', 2 ** 40).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(NotFound)
    expect(String((failure as Error).message)).toContain('Failed query')
  })
})
