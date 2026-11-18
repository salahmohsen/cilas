import { Suspense } from 'react'
import type { AdminViewServerProps, Payload } from 'payload'

import { isAdminUser } from '@/access'
import { env } from '@/env'
import { activeConnections } from '@/plugins/mcp/oauth'
import { mcpServerUrl } from '@/plugins/mcp/paths'

import { Alert } from '@/components/arc/alert/alert'
import { Skeleton } from '@/components/arc/skeleton/skeleton'

import { AiAccessGuideContent } from './ai-access-guide-content'
import { ArcAdminView } from './arc-admin-view'
import { ConnectionsTable, type ConnectionRow } from './ai-access-connections'

const ENDS = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

/** The live connections. Loads inside the frame, so only an administrator runs it. */
async function Connections({ payload }: { payload: Payload }) {
  let rows: ConnectionRow[]
  try {
    const { docs } = await payload.find({
      collection: 'oauth-tokens',
      where: activeConnections(),
      sort: 'expiresAt',
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    rows = docs.map((doc) => ({
      id: String(doc.id),
      person: doc.person ?? 'Deleted account',
      assistant: doc.assistant ?? 'Unknown',
      ends: doc.expiresAt,
      endsText: ENDS.format(new Date(doc.expiresAt)),
      href: `/admin/collections/oauth-tokens/${doc.id}`,
    }))
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Could not load connected assistants' })
    return (
      <Alert tone="danger" title="Could not load the connected assistants">
        Open Connected assistants to see them.
      </Alert>
    )
  }
  return <ConnectionsTable rows={rows} />
}

/** Admin → AI access guide. In English only, like the assistants it explains. */
export async function AiAccessGuideView(view: AdminViewServerProps) {
  const address = mcpServerUrl(env.NEXT_PUBLIC_SERVER_URL)

  return (
    <ArcAdminView
      view={view}
      language="en"
      title="Connect an AI assistant"
      allowed={isAdminUser(view.user)}
    >
      <AiAccessGuideContent
        address={address}
        connections={
          <Suspense fallback={<Skeleton lines={3} label="Loading connected assistants" />}>
            <Connections payload={view.initPageResult.req.payload} />
          </Suspense>
        }
      />
    </ArcAdminView>
  )
}
