import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import { getPayload } from 'payload'
import type { Payload } from 'payload'

import type { Newsletter } from '../src/payload-types'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

/**
 * One-off: fills newsletter drafts from the old Mailchimp campaigns.
 * Existing drafts are updated by id, keeping title, date, slug and
 * legacy_url; campaigns with no draft become new drafts, matched by slug.
 * Nothing is published or sent. Safe to run again.
 *
 *   npx tsx seed/import-mailchimp-newsletters.ts <plan.json> <imagemap.json> [only-keys]
 */

type Run = { t: string; b: boolean; i: boolean; a: string | null }
type Text = { k: 'p' | 'h'; runs: Run[]; text: string }
type Img = { k: 'img'; src: string; alt: string }
type Pick = { k: 'pick'; course: number; note: string | null }
type Section =
  | { t: 'text'; x: Text[] }
  | { t: 'gallery'; x: Img[] }
  | { t: 'image'; x: Img[] }
  | { t: 'picks'; x: Pick[] }
type Plan = {
  kind: 'mc' | 'draft'
  key: number
  title: string
  date: string
  slug: string
  cover: string | null
  preheader: string | null
  body: Text[]
  sections: Section[]
}

const [planPath, mapPath, only] = process.argv.slice(2)
if (!planPath || !mapPath) throw new Error('Pass the plan and the image map.')
if (!process.env.R2_PUBLIC_URL?.startsWith('https://pub-'))
  throw new Error('Not the production bucket.')

const plans = JSON.parse(readFileSync(planPath, 'utf8')) as Plan[]
const files = JSON.parse(readFileSync(mapPath, 'utf8')) as Record<string, string>
const wanted = only ? new Set(only.split(',')) : null
// Already published in production as "Join CILAS's Spring semester of 2026".
const skip = new Set(['mc:1'])

const payload: Payload = await getPayload({ config })

const rtl = (text: string) =>
  (text.match(/[؀-ۿ]/g)?.length ?? 0) > (text.match(/[a-z]/gi)?.length ?? 0)

const safeUrl = (url: string | null) => (url && /^(https?:|mailto:)/.test(url) ? url : null)

const textNode = (run: Run) => ({
  type: 'text',
  text: run.t,
  format: (run.b ? 1 : 0) | (run.i ? 2 : 0),
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const inline = (runs: Run[], direction: 'ltr' | 'rtl') => {
  const clean = runs.filter((run) => run.t.length)
  const nodes: unknown[] = []
  for (const run of clean) {
    const url = safeUrl(run.a)
    nodes.push(
      url
        ? {
            type: 'link',
            fields: { linkType: 'custom', url, newTab: true },
            format: '',
            indent: 0,
            version: 3,
            direction,
            children: [textNode(run)],
          }
        : textNode(run),
    )
  }
  return nodes
}

const richText = (items: Text[]): NonNullable<Newsletter['body']> => {
  const direction = rtl(items.map((item) => item.text).join(' ')) ? 'rtl' : 'ltr'
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction,
      children: items.map((item) => {
        const own = rtl(item.text) ? 'rtl' : 'ltr'
        const base = {
          format: '',
          indent: 0,
          version: 1,
          direction: own,
          children: inline(item.runs, own),
        }
        return item.k === 'h'
          ? { ...base, type: 'heading', tag: 'h2' }
          : { ...base, type: 'paragraph', textFormat: 0, textStyle: '' }
      }),
    },
  } as unknown as NonNullable<Newsletter['body']>
}

const mediaIds = new Map<string, number>()

const mediaFor = async (src: string, alt: string): Promise<number | null> => {
  const path = files[src]
  if (!path) return null
  const known = mediaIds.get(src)
  if (known) return known
  const filename = basename(path)
  const found = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const id =
    found.docs[0]?.id ??
    (
      await payload.create({
        collection: 'media',
        data: { alt },
        filePath: path,
        overrideAccess: true,
      })
    ).id
  mediaIds.set(src, Number(id))
  return Number(id)
}

const sectionOf = async (section: Section, title: string) => {
  if (section.t === 'text') return { blockType: 'text' as const, body: richText(section.x) }
  if (section.t === 'picks') {
    return {
      blockType: 'picks' as const,
      items: section.x.map((pick) => ({
        type: 'course' as const,
        course: pick.course,
        note: pick.note,
      })),
    }
  }
  if (section.t === 'image') {
    const [img] = section.x
    const image = img ? await mediaFor(img.src, img.alt || title) : null
    return image ? { blockType: 'image' as const, image } : null
  }
  const images: { image: number }[] = []
  for (const img of section.x) {
    const image = await mediaFor(img.src, img.alt || title)
    if (image) images.push({ image })
  }
  return images.length ? { blockType: 'gallery' as const, columns: '2' as const, images } : null
}

let done = 0
for (const plan of plans) {
  const key = `${plan.kind}:${plan.key}`
  if (skip.has(key) || (wanted && !wanted.has(key))) continue

  const sections = []
  for (const section of plan.sections) {
    const built = await sectionOf(section, plan.title)
    if (built) sections.push(built)
  }
  const data = {
    _status: 'draft' as const,
    body: plan.body.length ? richText(plan.body) : undefined,
    sections,
    cover_image: plan.cover ? await mediaFor(plan.cover, plan.title) : undefined,
    sent_at: new Date(plan.date).toISOString(),
    ...(plan.preheader ? { preheader: plan.preheader } : {}),
  }

  // draft: false writes the main row as well as a version; _status keeps it a draft.
  const write = { draft: false, locale: 'en' as const, overrideAccess: true }
  if (plan.kind === 'draft') {
    const current = await payload.findByID({
      collection: 'newsletters',
      id: plan.key,
      depth: 0,
      overrideAccess: true,
    })
    if (current._status !== 'draft') throw new Error(`Issue ${plan.key} is not a draft.`)
    await payload.update({ collection: 'newsletters', id: plan.key, data, ...write })
  } else {
    const existing = await payload.find({
      collection: 'newsletters',
      where: { slug: { equals: plan.slug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const found = existing.docs[0]
    if (found && found._status !== 'draft') throw new Error(`${plan.slug} is published.`)
    if (found) await payload.update({ collection: 'newsletters', id: found.id, data, ...write })
    else
      await payload.create({
        collection: 'newsletters',
        data: { ...data, title: plan.title, slug: plan.slug, issue_date: plan.date },
        ...write,
      })
  }
  done += 1
  console.log(`done ${key} ${plan.title}: ${sections.length} sections`)
}

console.log(`finished ${done}, media ${mediaIds.size}`)
process.exit(0)
