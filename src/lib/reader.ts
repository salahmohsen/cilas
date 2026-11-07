import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import type { User } from '@/payload-types'

export type Reader = User | null

/**
 * The account signed in on this request, or null. Reads Payload's cookie, so
 * a password login and a Google login look the same. Calling it makes the
 * page dynamic: only the signed-in pages use it.
 */
export const currentReader = async (): Promise<Reader> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return user && user.collection === 'users' ? user : null
}
