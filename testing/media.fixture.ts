import type { Payload } from 'payload'

import type { Media } from '../src/payload-types'
import { type createTracker, uniq } from './payload.fixture'

export const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export const makeMedia = async (
  payload: Payload,
  track: ReturnType<typeof createTracker>['track'],
  label: string,
) =>
  track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt: label },
      file: { name: `${uniq(label)}.gif`, mimetype: 'image/gif', data: GIF, size: GIF.length },
      overrideAccess: true,
    }),
  ) as Media
