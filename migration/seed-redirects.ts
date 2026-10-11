/**
 * Stage 5: one redirect per legacy page, plus one per uploaded archive file.
 * Idempotent; a redirect an admin edited is kept. Run after the content import
 * and the media upload.
 *
 *   npx tsx --env-file=.env migration/seed-redirects.ts
 *
 * Writes migration/review/redirects.md.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { REDIRECT_COLLECTIONS, importRedirects, redirectTargets, type DocRef } from './lib/import-redirects'

const here = import.meta.dirname
type Page = { legacy_url: string; kind: string; title: string }
const pages = (JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as { pages: Page[] }).pages

const main = async () => {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })

  const docs: DocRef[] = []
  for (const collection of REDIRECT_COLLECTIONS) {
    for (let page = 1; ; page++) {
      const res = await payload.find({
        collection,
        where: { legacy_url: { exists: true } },
        draft: true,
        depth: 0,
        limit: 500,
        page,
        select: { legacy_url: true } as never,
        overrideAccess: true,
      })
      for (const d of res.docs as unknown as Array<{ id: number; legacy_url?: string | null }>) {
        if (d.legacy_url) docs.push({ collection, id: d.id, legacy_url: d.legacy_url })
      }
      if (!res.hasNextPage) break
    }
  }

  const uploads: Array<{ legacy_url: string; url: string }> = []
  for (let page = 1; ; page++) {
    const res = await payload.find({ collection: 'media', where: { legacy_url: { exists: true } }, depth: 0, limit: 500, page, overrideAccess: true })
    for (const m of res.docs as unknown as Array<{ legacy_url?: string | null; url?: string | null }>) {
      if (m.legacy_url && m.url) uploads.push({ legacy_url: m.legacy_url, url: m.url })
    }
    if (!res.hasNextPage) break
  }

  const plans = redirectTargets(pages, docs)
  const tally = await importRedirects(payload, plans, uploads)

  const byUrl = new Map(pages.map((p) => [p.legacy_url, p]))
  const label = (p: Page | undefined) => (p ? `${p.legacy_url} (${p.kind}) ${p.title}` : '')
  const missing = plans.filter((p) => !p.target && p.reason !== 'ambiguous' && p.reason !== 'space')
  const ambiguous = plans.filter((p) => p.reason === 'ambiguous')
  const spaces = plans.filter((p) => p.reason === 'space')
  const withTarget = plans.filter((p) => p.target).length
  const lines = [
    '# Redirects',
    '',
    `${withTarget} of ${plans.length} pages have a target; ${uploads.length} upload redirects.`,
    `Created ${tally.created}, unchanged ${tally.unchanged}, kept (edited by an admin) ${tally.kept}.`,
    '',
    `## No target (${missing.length})`,
    'An editor can add a redirect to a custom URL in the admin.',
    ...missing.map((p) => `- ${label(byUrl.get(p.from))}`),
    '',
    `## Ambiguous (${ambiguous.length})`,
    ...ambiguous.map((p) => `- ${label(byUrl.get(p.from))}: ${p.candidates?.map((c) => `${c.collection}/${c.id}`).join(', ')}`),
    '',
    `## Spaces (${spaces.length})`,
    'Spaces are not in the redirects plugin, so these pages get no redirect.',
    ...spaces.map((p) => `- ${label(byUrl.get(p.from))}`),
  ]
  writeFileSync(path.join(here, 'review', 'redirects.md'), lines.join('\n') + '\n')
  console.log(`pages ${plans.length}, with target ${withTarget}, upload redirects ${uploads.length}`)
  console.log(`created ${tally.created}, unchanged ${tally.unchanged}, kept ${tally.kept}`)
  await payload.destroy()
  process.exit(0)
}

main()
