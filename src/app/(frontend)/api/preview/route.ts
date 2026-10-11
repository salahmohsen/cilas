import config from '@payload-config'
import { draftMode } from 'next/headers'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'

import { pathOf } from '@/lib/paths'

/**
 * Turns on Next's draft mode and sends the admin live-preview iframe to the
 * document, which is what lets `/study/[slug]` render an unpublished draft
 * (see `overrideAccess`/`draft` in that route).
 *
 * Draft mode is a cookie scoped to the requesting browser, so this endpoint must
 * never enable it for an anonymous or unauthorised caller. Anyone can hit this
 * URL, so the checks below are load-bearing, not decoration.
 */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const collection = searchParams.get('collection')

  if (!slug || collection !== 'courses') {
    return new Response('Missing or unsupported preview target', { status: 400 })
  }

  const { user } = await payload.auth({ headers: await getHeaders() })

  if (!user) {
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  const req = { user } as PayloadRequest

  // Editing a course is admin, or a fellow listed on that course. The live
  // preview renders the whole document, so the same bar applies to it.
  const canUpdate = await payload.collections.courses.config.access.update?.({ req })
  if (!canUpdate) {
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  const { docs } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = docs[0]
  if (!doc) {
    return new Response('Course not found', { status: 404 })
  }

  const draft = await draftMode()
  draft.enable()

  // pathOf, not a hand-built path: the course route has moved before.
  const path = pathOf('courses', doc)
  if (!path) {
    return new Response('Course has no page', { status: 404 })
  }
  redirect(path)
}
