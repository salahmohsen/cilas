import config from '@payload-config'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { findRedirect } from '@/lib/redirects'

type Params = { params: Promise<{ locale: string; path: string[] }> }

/**
 * Old Weebly URLs. Next tries every static route first, so this only sees
 * paths nothing else claims; each is looked up in `redirects`, which admins
 * edit without a deploy. `.html` pages and `/uploads/...` reach here through
 * the proxy, rewritten under the visitor's language.
 */
export default async function LegacyPath({ params }: Params) {
  const { locale, path } = await params
  const payload = await getPayload({ config })
  const target = await findRedirect(payload, `/${path.join('/')}`)
  if (!target) notFound()
  // A page on this site gets the visitor's language; an R2 file stays absolute.
  const url = target.url.startsWith('/') ? `/${locale}${target.url}` : target.url
  if (target.permanent) permanentRedirect(url)
  redirect(url)
}
