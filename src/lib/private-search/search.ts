import type { Payload, PayloadRequest, Where } from 'payload'
import type { Client } from 'typesense'
import { activeGeneration } from './generation'
import type { User } from '@/payload-types'
import { requestReadState } from '@/lib/spaces'
import {
  BATCH_SIZE,
  PAGE_SIZE,
  SCAN_LIMIT,
  CursorReset,
  decodeCursor,
  encodeCursor,
  fingerprint,
  numericId,
  permissionFilter,
  permits,
  projection,
  type Envelope,
  type SearchDocument,
  type SearchInput,
  type SearchPage,
  type SearchResult,
  type Source,
  type SpaceOption,
} from './model'

export class SelectionDenied extends Error {}
export const permissionEnvelope = async (
  payload: Payload,
  user: User,
  req: Partial<PayloadRequest>,
) => {
  req.context ??= {}
  const state = await requestReadState(payload, user, req.context)
  if (state.ids !== true) return { ids: state.ids || [], gated: state.gated }
  const spaces = await payload.find({
    collection: 'spaces',
    depth: 0,
    limit: 2000,
    overrideAccess: false,
    user,
    select: { kind: true },
  })
  if (spaces.hasNextPage) throw new Error('Space limit exceeded')
  return { ids: spaces.docs.map((s) => s.id), gated: state.gated }
}
export const spaceOptions = async (
  payload: Payload,
  user: User,
  envelope: Envelope,
  locale: 'en' | 'ar',
): Promise<SpaceOption[]> => {
  if (!envelope.ids.length) return []
  // Identity reads match My spaces: labels may belong to a tier-owner course.
  // Only the already-authorized set reaches this privileged identity read.
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { id: { in: envelope.ids } },
    locale,
    depth: 1,
    limit: envelope.ids.length,
    overrideAccess: true,
    select: { name: true, kind: true, course: true, programme: true },
    populate: { courses: { title: true, slug: true }, programmes: { title: true, slug: true } },
  })
  return docs.flatMap((s) => {
    const relation = s.kind === 'course' ? s.course : s.programme
    const parent = relation && typeof relation === 'object' ? relation : null
    if (s.kind !== 'community' && !parent?.slug) return []
    return [
      {
        id: s.id,
        label: parent?.title || s.name || (locale === 'ar' ? 'المجتمع' : 'Community'),
        href: `/${locale}/spaces/${s.kind}/${s.kind === 'community' ? s.id : encodeURIComponent(parent!.slug!)}`,
      },
    ]
  })
}

export const validateCandidates = async (
  payload: Payload,
  user: User,
  req: Partial<PayloadRequest>,
  envelope: Envelope,
  options: SpaceOption[],
  candidates: SearchDocument[],
  selected?: number,
): Promise<Map<string, SearchResult>> => {
  const safe = candidates.filter(
    (c) =>
      (c.kind === 'post' || c.kind === 'comment') &&
      numericId(c.sourceId) &&
      numericId(c.spaceId) &&
      numericId(c.postId) &&
      c.id === `${c.kind}:${c.sourceId}` &&
      permits(envelope, c.spaceId, c.postId) &&
      (selected === undefined || c.spaceId === selected),
  )
  const postIds = [...new Set(safe.map((c) => c.postId))]
  const commentIds = safe.filter((c) => c.kind === 'comment').map((c) => c.sourceId)
  if (!postIds.length) return new Map()
  const [posts, comments] = await Promise.all([
    payload.find({
      collection: 'space-posts',
      user,
      req,
      overrideAccess: false,
      depth: 0,
      pagination: false,
      limit: BATCH_SIZE,
      where: { id: { in: postIds } },
      select: { space: true, body: true, event_title: true, updatedAt: true, deleted_at: true },
    }),
    commentIds.length
      ? payload.find({
          collection: 'space-comments',
          user,
          req,
          overrideAccess: false,
          depth: 0,
          pagination: false,
          limit: BATCH_SIZE,
          where: { id: { in: commentIds } },
          select: {
            space: true,
            post: true,
            parent: true,
            body: true,
            updatedAt: true,
            deleted_at: true,
          },
        })
      : { docs: [] },
  ])
  const postMap = new Map<number, Source>(posts.docs.map((p) => [p.id, p]))
  const commentMap = new Map<number, Source>(comments.docs.map((c) => [c.id, c]))
  const parentIds = [...new Set(comments.docs.flatMap((c) => numericId(c.parent) ?? []))]
  const parents = parentIds.length
    ? await payload.find({
        collection: 'space-comments',
        user,
        req,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        limit: BATCH_SIZE,
        where: { id: { in: parentIds } },
        select: { space: true, post: true, parent: true },
      })
    : { docs: [] }
  const parentsById = new Map(parents.docs.map((c) => [c.id, c]))
  const bySpace = new Map(options.map((s) => [s.id, s]))
  const results = new Map<string, SearchResult>()
  for (const candidate of safe) {
    const parent = postMap.get(candidate.postId)
    const source = candidate.kind === 'post' ? parent : commentMap.get(candidate.sourceId)
    if (!parent || parent.deleted_at || !source || numericId(parent.space) !== candidate.spaceId)
      continue
    if (candidate.kind === 'comment' && numericId(source.parent)) {
      const commentParent = parentsById.get(numericId(source.parent)!)
      if (
        !commentParent ||
        numericId(commentParent.space) !== candidate.spaceId ||
        numericId(commentParent.post) !== candidate.postId ||
        numericId(commentParent.parent)
      )
        continue
    }
    const current = projection(candidate.kind, source)
    const space = bySpace.get(candidate.spaceId)
    if (
      !current ||
      !space ||
      current.sourceRevision !== candidate.sourceRevision ||
      current.spaceId !== candidate.spaceId ||
      current.postId !== candidate.postId
    )
      continue
    // A live child under a deleted comment remains readable. A deleted post hides its whole thread.
    results.set(candidate.id, {
      id: candidate.id,
      kind: candidate.kind,
      title: current.title || current.body.slice(0, 100),
      snippet: current.body.slice(0, 320),
      href: `${space.href}/posts/${candidate.postId}`,
      space: space.label,
      spaceId: space.id,
      updatedAt: current.updatedAt,
    })
  }
  return results
}

/** Counts are exact only after exhausting a bounded, live-validated scan.
 * Never use raw engine totals: stale or unreadable candidates must not count. */
export const searchPrivate = async ({
  payload,
  user,
  client,
  input,
  secret,
}: {
  payload: Payload
  user: User
  client: Client
  input: SearchInput
  secret: string
}): Promise<SearchPage> => {
  const req: Partial<PayloadRequest> = { context: {}, user }
  const envelope = await permissionEnvelope(payload, user, req)
  const selection =
    input.spaces === undefined
      ? input.space === undefined
        ? undefined
        : [input.space]
      : [...new Set(input.spaces)].sort((a, b) => a - b)
  if (selection?.some((id) => !envelope.ids.includes(id))) throw new SelectionDenied()
  const options = await spaceOptions(payload, user, envelope, input.locale)
  const empty: SearchPage = {
    results: [],
    hasMore: false,
    incomplete: false,
    spaces: options,
    account: user.id,
    aggregates: { total: 0, facets: options.map((option) => ({ id: option.id, found: 0 })) },
  }
  const filter = permissionFilter(envelope)
  if (!filter) {
    if (input.cursor) throw new CursorReset()
    return empty
  }
  const generation = await activeGeneration(payload)
  const permissionBinding = (value: Envelope) => [
    value.ids.slice().sort((a, b) => a - b),
    [...value.gated].sort((a, b) => a[0] - b[0]),
  ]
  const binding = fingerprint([
    'spaces-search-v2',
    user.id,
    user.roles,
    numericId(user.person),
    input.query,
    selection,
    input.sort,
    input.locale,
    generation,
    permissionBinding(envelope),
  ])
  const start = input.cursor ? decodeCursor(input.cursor, binding, secret) : 0
  const deadline = Date.now() + 3000
  const batches = new Map<
    number,
    { candidates: SearchDocument[]; validated: Map<string, SearchResult>; cutoff: boolean }
  >()
  const batch = async (offset: number) => {
    const cached = batches.get(offset)
    if (cached) return cached
    const parameters = {
      q: input.query.trim().length < 2 ? '*' : input.query,
      query_by: 'title,body',
      query_by_weights: '2,1',
      filter_by: filter,
      per_page: BATCH_SIZE,
      offset,
      sort_by:
        input.sort === 'newest'
          ? 'updatedAt:desc,sourceId:desc'
          : '_text_match:desc,updatedAt:desc,sourceId:desc',
      include_fields: 'id,sourceId,kind,spaceId,postId,sourceRevision',
      highlight_fields: 'none',
      highlight_full_fields: '',
      enable_highlight_v1: false,
      enable_curations: false,
      filter_curated_hits: true,
      use_cache: false,
      enable_analytics: false,
      num_typos: 1,
      prefix: false,
      search_cutoff_ms: 500,
    }
    const response = await client
      .collections<SearchDocument>(generation)
      .documents()
      .search(parameters)
    const candidates = (response.hits ?? []).map((hit) => hit.document)
    const value = {
      candidates,
      validated: await validateCandidates(payload, user, req, envelope, options, candidates),
      cutoff: Boolean(response.search_cutoff),
    }
    batches.set(offset, value)
    return value
  }
  const included = (row: SearchResult) => selection === undefined || selection.includes(row.spaceId)
  let offset = start
  let scanned = 0
  let exhausted = false
  let nextOffset: number | undefined
  let results: SearchResult[] = []
  const seen = new Set<string>()
  while (
    input.sort !== 'alpha' &&
    scanned < SCAN_LIMIT &&
    Date.now() < deadline &&
    offset < 10000
  ) {
    const value = await batch(offset)
    for (let i = 0; i < value.candidates.length; i++) {
      const row = value.validated.get(value.candidates[i].id)
      if (!row || !included(row) || seen.has(row.id)) continue
      if (results.length === PAGE_SIZE) {
        nextOffset = offset + i
        break
      }
      seen.add(row.id)
      results.push(row)
    }
    if (nextOffset !== undefined) break
    offset += value.candidates.length
    scanned += value.candidates.length
    if (value.cutoff) break
    if (value.candidates.length < BATCH_SIZE) {
      exhausted = true
      break
    }
  }
  // Aggregation is independent of selection, sharing the same validated batches.
  const all = new Map<string, SearchResult>()
  let aggregateOffset = 0
  let aggregateComplete = false
  while (aggregateOffset < SCAN_LIMIT && Date.now() < deadline) {
    const value = await batch(aggregateOffset)
    for (const [id, row] of value.validated) all.set(id, row)
    aggregateOffset += value.candidates.length
    if (value.cutoff) break
    if (value.candidates.length < BATCH_SIZE) {
      aggregateComplete = true
      break
    }
  }
  const facets = options.map((option) => ({
    id: option.id,
    found: [...all.values()].filter((row) => row.spaceId === option.id).length,
  }))
  const selected = [...all.values()].filter(included)
  if (input.sort === 'alpha') {
    // Sorting a partial page would imply an incorrect global order.
    results = aggregateComplete
      ? selected
          .sort((a, b) => a.title.localeCompare(b.title, input.locale) || a.id.localeCompare(b.id))
          .slice(start, start + PAGE_SIZE)
      : []
    nextOffset =
      aggregateComplete && start + PAGE_SIZE < selected.length ? start + PAGE_SIZE : undefined
    exhausted = aggregateComplete && nextOffset === undefined
  }
  // A membership or generation change invalidates both rows and aggregates.
  const current = await permissionEnvelope(payload, user, { context: {}, user })
  if (
    fingerprint(permissionBinding(current)) !== fingerprint(permissionBinding(envelope)) ||
    (await activeGeneration(payload)) !== generation
  )
    throw new CursorReset()
  results = await withResultImages(payload, user, req, results)
  return {
    ...empty,
    results,
    hasMore: nextOffset !== undefined,
    incomplete: !aggregateComplete || (!exhausted && nextOffset === undefined),
    aggregates: aggregateComplete ? { total: selected.length, facets } : null,
    ...(nextOffset === undefined
      ? {}
      : {
          cursor: encodeCursor(
            { binding, offset: nextOffset, expires: Date.now() + 300000 },
            secret,
          ),
        }),
  }
}

/** Media stays out of the index. Read only images owned by validated results,
 * through the same access rules and file endpoint as the Spaces feed. */
async function withResultImages(
  payload: Payload,
  user: User,
  req: Partial<PayloadRequest>,
  rows: SearchResult[],
) {
  if (!rows.length) return rows
  const posts = rows.filter((row) => row.kind === 'post').map((row) => Number(row.id.split(':')[1]))
  const comments = rows
    .filter((row) => row.kind === 'comment')
    .map((row) => Number(row.id.split(':')[1]))
  const { docs: postRows } = posts.length
    ? await payload.find({
        collection: 'space-posts',
        user,
        req,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        where: { id: { in: posts } },
        select: { event_cover: true, space: true },
      })
    : { docs: [] }
  const covers = postRows.flatMap((post) => numericId(post.event_cover) ?? [])
  const clauses: Where[] = [
    ...(posts.length ? [{ and: [{ post: { in: posts } }, { comment: { exists: false } }] }] : []),
    ...(comments.length ? [{ comment: { in: comments } }] : []),
    ...(covers.length ? [{ id: { in: covers } }] : []),
  ]
  if (!clauses.length) return rows
  const files = await payload.find({
    collection: 'space-files',
    user,
    req,
    overrideAccess: false,
    depth: 0,
    limit: PAGE_SIZE * 10,
    sort: 'createdAt',
    where: {
      and: [
        { or: clauses },
        { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] } },
      ],
    },
  })
  return rows.map((row) => {
    const id = Number(row.id.split(':')[1])
    const cover = postRows.find((post) => post.id === id)?.event_cover
    const file = files.docs.find(
      (file) =>
        numericId(file.space) === row.spaceId &&
        (row.kind === 'post'
          ? numericId(file.id) === numericId(cover) ||
            (numericId(file.post) === id && !file.comment)
          : numericId(file.comment) === id),
    )
    return file?.filename
      ? { ...row, image: `/api/space-files/file/${encodeURIComponent(file.filename)}` }
      : row
  })
}
