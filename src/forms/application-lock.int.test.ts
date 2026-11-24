import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applicationFixture, removeApplicationFixture } from '../../testing/application.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { holdRow, waitForLockWaiters } from '../../testing/row-lock.test-utils'

let f: Awaited<ReturnType<typeof applicationFixture>>
let token: string
let submission: number
let adminId: number

beforeAll(async () => {
  f = await applicationFixture()
  const email = `application-lock-${f.suffix}@cilas.test`
  const password = crypto.randomUUID()
  adminId = (
    await f.payload.create({
      collection: 'users',
      data: { email, password, roles: ['admin'] },
    })
  ).id
  const login = await f.payload.login({ collection: 'users', data: { email, password } })
  if (!login.token) throw new Error('The fixture admin did not receive a token')
  token = login.token
  submission = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: [
          { field: 'name', value: 'Lock Applicant' },
          { field: 'email', value: 'lock-applicant@cilas.test' },
          { field: 'shared', value: 'Shared reply' },
        ],
      },
    })
  ).id
})

afterAll(async () => {
  if (!f) return
  await f.payload.delete({ collection: 'users', id: adminId })
  await removeApplicationFixture(f)
})

const decide = () => rest('POST', `form-submissions/${submission}/reject`, { token })

describe('application decision: row lock', () => {
  it('waits for the submission row, then runs', async () => {
    const holder = await holdRow(f.payload, 'form-submissions', submission)
    const pending = decide()
    void pending.catch(() => {})
    try {
      await waitForLockWaiters(f.payload, holder.pid, 1)
    } finally {
      await holder.release()
    }
    expect((await pending).status).toBe(400)
  })

  it('answers 409 when the row stays busy', async () => {
    const holder = await holdRow(f.payload, 'form-submissions', submission)
    try {
      expect((await decide()).status).toBe(409)
    } finally {
      await holder.release()
    }
  })
})
