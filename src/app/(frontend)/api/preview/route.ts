import config from '@payload-config'
import { draftMode } from 'next/headers'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { pathOf } from '@/lib/paths'
import { previewWhere } from '@/lib/preview-access'

/**
 * Turns on Next's draft mode and sends the admin live-preview iframe to the
 * document, which is what lets `/study/[slug]`, `/articles/[slug]` and `/study/bridge`
 * render an unpublished draft
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

  if (!slug || (collection !== 'courses' && collection !== 'articles' && collection !== 'programmes')) {
    return new Response('Missing or unsupported preview target', { status: 400 })
  }

  const { user } = await payload.auth({ headers: await getHeaders() })

  if (!user) {
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  // Editing a course is admin, or a fellow listed on it; an article, admin or
  // one of its authors. The live preview renders the whole document, so the
  // same bar applies to it.
  const canUpdate = await previewWhere(payload, collection, user)
  if (!canUpdate) {
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  const { docs } = await payload.find({
    collection,
    where: { and: [{ slug: { equals: slug } }, canUpdate] },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
    draft: true,
  })

  const doc = docs[0]
  if (!doc) {
    return new Response('Not found', { status: 404 })
  }

  const draft = await draftMode()
  draft.enable()

  // pathOf, not a hand-built path: the course route has moved before.
  // The language being edited (live preview passes it), else the editor's
  // saved site language, else English.
  const asked = searchParams.get('locale')
  const saved =
    (asked === 'en' || asked === 'ar' ? asked : null) ??
    request.headers.get('cookie')?.match(/(?:^|;\s*)NEXT_LOCALE=(en|ar)/)?.[1]
  // A programme has no page of its own: the Bridge page shows the one it is given.
  const path =
    collection === 'programmes'
      ? 'kind' in doc && doc.kind === 'bridge'
        ? `/${saved ?? 'en'}/study/bridge?programme=${encodeURIComponent(slug)}`
        : null
      : pathOf(collection, doc, saved ?? 'en')
  if (!path) {
    return new Response('This document has no page', { status: 404 })
  }
  redirect(path)
}
