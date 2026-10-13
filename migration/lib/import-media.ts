import type { CollectionSlug, Payload, Where } from 'payload'

import { rewriteLinks, uploadsPath, type MediaJob } from './media-plan'

export type ResolvedFile = { key: string; file: string | null }
export type MediaTally = {
  uploaded: number
  reused: number
  attached: number
  skippedSet: number
  missing: number
  noTarget: number
}
export type MediaResult = MediaTally & { urls: Map<string, string>; noTargetJobs: string[] }

type MediaDoc = { id: number; url?: string | null }

/**
 * The media document for an archive file: the one already imported
 * (`legacy_url` is the archive path), or a new upload from the local `file`.
 */
export const mediaFor = async (
  payload: Payload,
  { path, file, alt }: { path: string; file: string; alt: string },
): Promise<{ id: number; url: string; created: boolean }> => {
  const { docs } = await payload.find({ collection: 'media', where: { legacy_url: { equals: path } }, limit: 1, depth: 0, overrideAccess: true })
  const found = docs[0] as MediaDoc | undefined
  if (found) return { id: found.id, url: found.url ?? '', created: false }
  const doc = (await payload.create({
    collection: 'media',
    data: { alt, legacy_url: path },
    filePath: file,
    overrideAccess: true,
  })) as MediaDoc
  return { id: doc.id, url: doc.url ?? '', created: true }
}

const isArchiveUrl = (url: string): boolean => /(^|\/\/)(www\.)?ci-las\.org\//.test(url)

/**
 * Uploads each archive file once and sets the fields that point at it. A
 * reviewed document is left alone, as is an upload field that already has a
 * value (an editor may have chosen another image). `print_edition_url` is
 * replaced only while it still points at the old site.
 *
 * `extras` are files to upload that no job points at (the Arabic Pigeon Towers PDF).
 */
export const importMedia = async (
  payload: Payload,
  jobs: MediaJob[],
  resolve: (path: string) => ResolvedFile,
  extras: Array<{ path: string; alt: string }> = [],
): Promise<MediaResult> => {
  const result: MediaResult = { uploaded: 0, reused: 0, attached: 0, skippedSet: 0, missing: 0, noTarget: 0, urls: new Map(), noTargetJobs: [] }
  const cache = new Map<string, { id: number; url: string }>()

  /** null when the file is not in the archive. */
  const media = async (path: string, alt: string) => {
    const { key, file } = resolve(path)
    const known = cache.get(key)
    if (known) return known
    let got: { id: number; url: string; created: boolean }
    if (file) {
      got = await mediaFor(payload, { path: key, file, alt })
    } else {
      // No file: an earlier run may still have uploaded it.
      const { docs } = await payload.find({ collection: 'media', where: { legacy_url: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
      const found = docs[0] as MediaDoc | undefined
      if (!found) return null
      got = { id: found.id, url: found.url ?? '', created: false }
    }
    if (got.created) result.uploaded++
    else result.reused++
    const entry = { id: got.id, url: got.url }
    cache.set(key, entry)
    result.urls.set(path, got.url)
    return entry
  }

  const hasDrafts = (collection: CollectionSlug): boolean => Boolean(payload.collections[collection]?.config.versions?.drafts)

  for (const job of jobs) {
    // An outlet's logo: every press item from that outlet that has none yet.
    if (job.collection === 'press') {
      const { docs } = await payload.find({ collection: 'press', where: { 'outlet.name': { equals: job.name } }, pagination: false, depth: 0, overrideAccess: true })
      const bare = docs.filter((d) => !d.outlet?.logo)
      if (!docs.length) {
        result.noTarget++
        result.noTargetJobs.push(`press ${job.name} (outlet logo)`)
        continue
      }
      if (!bare.length) {
        result.skippedSet++
        continue
      }
      const m = await media(job.path, job.alt)
      if (!m) {
        result.missing++
        continue
      }
      for (const d of bare) {
        await payload.update({ collection: 'press', id: d.id, overrideAccess: true, data: { outlet: { ...d.outlet, logo: m.id } } })
      }
      result.attached++
      continue
    }
    const draft = hasDrafts(job.collection)
    const where: Where = job.name ? { name: { equals: job.name } } : { legacy_url: { equals: job.legacy_url ?? '' } }
    let { docs } = await payload.find({ collection: job.collection, where, limit: 1, depth: 0, overrideAccess: true, draft })
    // A person first met as a course fellow keeps that course's legacy_url;
    // the people import matched them by name, so the photo's page differs.
    if (!docs.length && job.collection === 'people' && job.alt) {
      ;({ docs } = await payload.find({ collection: 'people', where: { name: { equals: job.alt } }, limit: 1, depth: 0, overrideAccess: true }))
    }
    const doc = docs[0] as unknown as Record<string, unknown> & { id: number } | undefined
    if (!doc) {
      result.noTarget++
      result.noTargetJobs.push(`${job.collection} ${job.name ?? job.legacy_url} (${job.field})`)
      continue
    }
    // A published document stays published: the file is written to it, not
    // to a new draft that the site would not show.
    const args = { collection: job.collection, id: doc.id, overrideAccess: true, draft: draft && doc._status !== 'published' } as const

    if (job.field === 'body_pdf_link') {
      if (!doc.body) {
        result.skippedSet++
        continue
      }
      const hit = (url: string) => (uploadsPath(url) === job.path ? url : null)
      const matches = rewriteLinks(doc.body, (url) => (hit(url) ? 'x' : null)).count
      if (!matches) {
        result.skippedSet++
        continue
      }
      const m = await media(job.path, job.alt)
      if (!m) {
        result.missing++
        continue
      }
      const { tree } = rewriteLinks(doc.body, (url) => (hit(url) ? m.url : null))
      await payload.update({ ...args, data: { body: tree } } as Parameters<Payload['update']>[0])
      result.attached++
      continue
    }

    const current = doc[job.field]
    if (job.field === 'print_edition_url' ? typeof current === 'string' && current && !isArchiveUrl(current) : Boolean(current)) {
      result.skippedSet++
      continue
    }
    const m = await media(job.path, job.alt)
    if (!m) {
      result.missing++
      continue
    }
    if (job.field === 'print_edition_url' && current === m.url) {
      result.skippedSet++
      continue
    }
    await payload.update({
      ...args,
      data: { [job.field]: job.field === 'print_edition_url' ? m.url : m.id },
    } as Parameters<Payload['update']>[0])
    result.attached++
  }

  for (const extra of extras) {
    if (!(await media(extra.path, extra.alt))) result.missing++
  }

  return result
}
