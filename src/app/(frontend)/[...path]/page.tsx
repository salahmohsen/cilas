import config from '@payload-config'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { findRedirect } from '@/lib/redirects'

type Params = { params: Promise<{ path: string[] }> }

/**
 * Old Weebly URLs. Next tries every static route first, so this only sees
 * paths nothing else claims; each is looked up in `redirects`, which admins
 * edit without a deploy.
 */
export default async function LegacyPath({ params }: Params) {
  const { path } = await params
  const payload = await getPayload({ config })
  const target = await findRedirect(payload, `/${path.join('/')}`)
  if (!target) notFound()
  if (target.permanent) permanentRedirect(target.url)
  redirect(target.url)
}
