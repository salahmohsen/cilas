import { BRIDGE_PATH } from '@/lib/paths'
import config from '@payload-config'
import { draftMode } from 'next/headers'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { pathOf } from '@/lib/paths'
import { previewWhere } from '@/lib/preview-access'
import { isPreviewCollection, PREVIEW_TARGET_FIELDS } from '@/lib/preview-url'
import { localeOf, routing } from '@/i18n/routing'

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
  const collection = searchParams.get('collection')
  const target = isPreviewCollection(collection)
    ? searchParams.get(PREVIEW_TARGET_FIELDS[collection])
    : null
  if (!isPreviewCollection(collection) || !target) {
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
    where: { and: [{ [PREVIEW_TARGET_FIELDS[collection]]: { equals: target } }, canUpdate] },
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

  // The language being edited (live preview passes it), else the editor's
  // saved site language, else English.
  const asked = searchParams.get('locale')
  const saved = localeOf(
    routing.locales.find((locale) => locale === asked) ??
      request.headers
        .get('cookie')
        ?.match(new RegExp(`(?:^|;\\s*)NEXT_LOCALE=(${routing.locales.join('|')})`))?.[1],
  )
  // A programme has no page of its own: the Bridge page shows the one it is given.
  const path =
    collection === 'forms'
      ? `/${saved}/forms/preview?form=${doc.id}`
      : collection === 'programmes'
        ? 'kind' in doc && doc.kind === 'bridge'
          ? `/${saved}${BRIDGE_PATH}?programme=${encodeURIComponent(target)}`
          : null
        : pathOf(collection, { slug: target }, saved)
  if (!path) {
    return new Response('This document has no page', { status: 404 })
  }
  redirect(path)
}
