import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import { mySpaces } from '@/lib/spaces-data'
import type { User } from '@/payload-types'

const NO_SPACES = { communities: [], cohorts: [], courses: [] }

/** The shell's space navigation must load before the task queries start. */
export const portalSpaces = cache(async (user: User, locale: string) => {
  const payload = await getPayload({ config })
  return mySpaces(payload, user, locale).catch((err: unknown) => {
    payload.logger.error({ err }, 'portal nav: the spaces list did not load')
    return NO_SPACES
  })
})
