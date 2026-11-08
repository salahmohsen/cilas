import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
type Text =
  | { k: 'p' | 'h'; runs: Run[]; text: string }
  | { k: 'hr' }
  | { k: 'inline'; src: string; alt: string }
type Img = { k: 'img'; src: string; alt: string; caption?: string | null; body?: Text[] }
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
  cover_caption: string | null
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

// Some old emails double the scheme: "http://   http://youtu.be/...".
const safeUrl = (raw: string | null) => {
  const url = raw?.replace(/^https?:\/\/[\s ]*(?=https?:\/\/)/, '').trim()
  return url && /^(https?:|mailto:)/.test(url) && !/\s/.test(url) ? url : null
}

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

const mediaIds = new Map<string, number>()

const nodeOf = (item: Text) => {
  if (item.k === 'hr') return { type: 'horizontalrule', version: 1 }
  if (item.k === 'inline') {
    return {
      type: 'upload',
      id: randomUUID().replaceAll('-', '').slice(0, 24),
      version: 3,
      format: '',
      fields: null,
      relationTo: 'media',
      value: mediaIds.get(item.src),
    }
  }
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
}

const withMedia = async (items: Text[], title: string) => {
  for (const item of items) if (item.k === 'inline') await mediaFor(item.src, item.alt || title)
  // An image whose file failed to download has no id: drop it rather than save a broken node.
  return items.filter((item) => item.k !== 'inline' || mediaIds.has(item.src))
}

const richText = async (raw: Text[], title: string): Promise<NonNullable<Newsletter['body']>> => {
  const items = await withMedia(raw, title)
  const words = items.flatMap((item) => ('text' in item ? [item.text] : [])).join(' ')
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: rtl(words) ? 'rtl' : 'ltr',
      children: items.map(nodeOf),
    },
  } as unknown as NonNullable<Newsletter['body']>
}

/** A caption is the image's description, so it replaces the alt; otherwise an existing alt stays. */
const mediaFor = async (
  src: string,
  alt: string,
  caption?: string | null,
): Promise<number | null> => {
  const path = files[src]
  if (!path) return null
  const filename = basename(path)
  const found = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const doc = found.docs[0]
  const id = doc
    ? doc.id
    : (
        await payload.create({
          collection: 'media',
          data: { alt: caption || alt },
          filePath: path,
          overrideAccess: true,
        })
      ).id
  if (doc && caption && doc.alt !== caption) {
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: { alt: caption },
      overrideAccess: true,
    })
  }
  mediaIds.set(src, Number(id))
  return Number(id)
}

const sectionOf = async (section: Section, title: string) => {
  if (section.t === 'text') {
    return { blockType: 'text' as const, body: await richText(section.x, title) }
  }
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
    if (!img) return null
    const image = await mediaFor(img.src, img.alt || title, img.caption)
    if (!image) return null
    return {
      blockType: 'image' as const,
      image,
      caption: img.caption ?? null,
      body: img.body?.length ? await richText(img.body, title) : null,
    }
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
    body: plan.body.length ? await richText(plan.body, plan.title) : undefined,
    sections,
    cover_image: plan.cover
      ? await mediaFor(plan.cover, plan.title, plan.cover_caption)
      : undefined,
    cover_caption: plan.cover_caption,
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
    // Issue 56 was published by hand and asked to be fixed; it stays published.
    if (found && found._status !== 'draft' && key !== 'mc:0')
      throw new Error(`${plan.slug} is published.`)
    if (found?._status === 'published') data._status = 'published' as never
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
