import config from '@payload-config'
import { getPayload } from 'payload'

import { env } from '@/env'
import { runSpacesCron } from '@/lib/space-cron'
import { handleSpacesCron, refuseSpacesCronMethod } from '@/lib/space-cron-request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = (request: Request) =>
  handleSpacesCron(request, {
    secret: env.CRON_SECRET,
    run: async () => runSpacesCron(await getPayload({ config })),
  })

export {
  refuseSpacesCronMethod as GET,
  refuseSpacesCronMethod as PUT,
  refuseSpacesCronMethod as PATCH,
  refuseSpacesCronMethod as DELETE,
}
