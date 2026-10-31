// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { SignJWT } from 'jose'
import { getFieldsToSign, getPayload, type Payload } from 'payload'
import { addPayloadSessionToUser } from 'payload-oauth2/dist/auth-sessions'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
let user: User

/** The cookie the Google callback sets, made the way payload-oauth2 makes it. */
const googleCookie = async (account: User) => {
  const collectionConfig = payload.collections.users.config
  const req = { payload, context: {} } as never
  const fresh = (await payload.findByID({
    collection: 'users',
    id: account.id,
    showHiddenFields: true,
  })) as User & { collection?: string }
  const sid = await addPayloadSessionToUser({ collectionConfig, req, user: fresh as never })
  fresh.collection = 'users'
  const token = await new SignJWT(
    getFieldsToSign({ collectionConfig, email: fresh.email, sid, user: fresh as never }),
  )
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('600 secs')
    .sign(new TextEncoder().encode(payload.secret))
  return `payload-token=${token}`
}

describe('Google sign-in', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = await payload.create({
      collection: 'users',
      data: { email: 'google-probe@cilas.test', password: 'probe-password-1', roles: ['member'] },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload
      .delete({ collection: 'users', id: user.id, overrideAccess: true })
      .catch(() => undefined)
    await payload.destroy()
  })

  it('authenticates with the cookie the callback sets', async () => {
    const headers = new Headers({ cookie: await googleCookie(user) })
    const { user: signedIn } = await payload.auth({ headers })
    expect(signedIn?.id).toBe(user.id)
  })
})
