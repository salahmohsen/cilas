import type { Payload } from 'payload'

/**
 * Request headers that sign `account` in, from a real Payload login. Pass
 * them to `runInRequest`, and `currentReader()` reads this account the way
 * it reads a signed-in browser.
 */
export const signedInHeaders = async (
  payload: Payload,
  account: { email: string; password: string },
) => {
  const { token } = await payload.login({ collection: 'users', data: account })
  return { authorization: `JWT ${token}` }
}
