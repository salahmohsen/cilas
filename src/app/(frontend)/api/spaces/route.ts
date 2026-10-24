import config from '@payload-config'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { mode, readableSpaceIds, spacesSettings } from '@/lib/spaces'

export const dynamic = 'force-dynamic'

/**
 * Whether the site header shows "Spaces" for this account: the switch is not
 * off (spec §10) and the account reads at least one space. The header is
 * cached for everyone, so it asks here, the way it asks /api/open for Apply.
 */
export async function GET() {
  const user = await currentReader()
  if (!user) return Response.json({ spaces: false })
  const payload = await getPayload({ config })
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return Response.json({ spaces: false })
  const ids = await readableSpaceIds(payload, user, settings)
  return Response.json({ spaces: ids === true || (Array.isArray(ids) && ids.length > 0) })
}
