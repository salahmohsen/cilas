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
 * Existing issues keep their title, date, slug, legacy_url and status;
 * campaigns with no issue become new drafts, matched by slug. Nothing is
 * sent. Safe to run again.
 *
 *   npx tsx seed/import-mailchimp-newsletters.ts <plan.json> <imagemap.json> <layout-dir> [only-keys]
 */

type Run = { t: string; b: boolean; i: boolean; a: string | null }
type Img = { src: string; alt: string; caption?: string | null }
type Pick = { course: number; note: string | null }
type Text = { k: 'p' | 'h'; runs: Run[]; text: string }
type Plan = {
  kind: 'mc' | 'draft'
  key: number
  title: string
  date: string
  slug: string
  cover: string | null
  preheader: string | null
  cover_caption: string | null
}

type LayoutItem =
  | { kind: 'paragraph' | 'heading'; runs: Run[]; text: string }
  | ({ kind: 'image' } & Img)
  | ({ kind: 'pick' } & Pick)
  | { kind: 'divider' }
type LayoutEntry =
  | number
  | { figure: number; caption?: number[] }
  | { gallery: number[]; columns: number }
  | { columns: number[][]; ratio: string }
  | { quote: number; attribution?: string }
type Layout = { items: LayoutItem[]; sections: { items: LayoutEntry[] }[] }

/** One thing a body can hold, ready to become a node. */
type Item =
  | Text
  | { k: 'figure'; img: Img }
  | { k: 'gallery'; images: Img[]; columns: number }
  | { k: 'picks'; picks: Pick[] }
  | { k: 'columns'; columns: Item[][]; ratio: string }
  | { k: 'quote'; text: string; attribution?: string }

const [planPath, mapPath, layoutDir, only] = process.argv.slice(2)
if (!planPath || !mapPath || !layoutDir) throw new Error('Pass the plan, image map and layouts.')

const plans = JSON.parse(readFileSync(planPath, 'utf8')) as Plan[]
const files = JSON.parse(readFileSync(mapPath, 'utf8')) as Record<string, string>
const wanted = only ? new Set(only.split(',')) : null
// Already in the archive as "Join CILAS's Spring semester of 2026".
const skip = new Set(['mc:1'])

const payload: Payload = await getPayload({ config })

const rtl = (text: string) =>
  (text.match(/[؀-ۿ]/g)?.length ?? 0) > (text.match(/[a-z]/gi)?.length ?? 0)

// Some old emails double the scheme: "http://   http://youtu.be/...".
const safeUrl = (raw: string | null) => {
  const url = raw?.replace(/^https?:\/\/[\s ]*(?=https?:\/\/)/, '').trim()
  return url && /^(https?:|mailto:)/.test(url) && !/\s/.test(url) ? url : null
}

const nodeId = () => randomUUID().replaceAll('-', '').slice(0, 24)

const textNode = (run: Run) => ({
  type: 'text',
  text: run.t,
  format: (run.b ? 1 : 0) | (run.i ? 2 : 0),
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const inline = (runs: Run[], direction: 'ltr' | 'rtl') =>
  runs
    .filter((run) => run.t.length)
    .map((run) => {
      const url = safeUrl(run.a)
      return url
        ? {
            type: 'link',
            fields: { linkType: 'custom', url, newTab: true },
            format: '',
            indent: 0,
            version: 3,
            direction,
            children: [textNode(run)],
          }
        : textNode(run)
    })

const mediaIds = new Map<string, number>()

/** A caption is the image's description, so it replaces the alt; otherwise an existing alt stays. */
const mediaFor = async (src: string, alt: string, caption?: string | null) => {
  const path = files[src]
  if (!path) return null
  const known = mediaIds.get(src)
  if (known && !caption) return known
  const found = await payload.find({
    collection: 'media',
    // Stored names are rewritten (mc-abc.jpg becomes mc-abc-1.webp), so match the stem.
    where: { filename: { like: basename(path).replace(/\.[^.]+$/, '') } },
    sort: 'id',
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

const block = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: nodeId(), blockName: '', ...fields },
})

const richText = (children: unknown[], words: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: rtl(words) ? 'rtl' : 'ltr',
    children,
  },
})

const nodeFor = async (item: Item, title: string): Promise<unknown> => {
  switch (item.k) {
    case 'figure': {
      const image = await mediaFor(item.img.src, item.img.alt || title, item.img.caption)
      return image
        ? block({ blockType: 'newsletterImage', image, caption: item.img.caption ?? null })
        : null
    }
    case 'gallery': {
      const images = []
      for (const img of item.images) {
        const image = await mediaFor(img.src, img.alt || title, img.caption)
        if (image) images.push({ id: nodeId(), image, caption: img.caption ?? null })
      }
      return images.length
        ? block({ blockType: 'gallery', columnCount: String(item.columns), images })
        : null
    }
    case 'picks':
      return block({
        blockType: 'newsletterPicks',
        items: item.picks.map((pick) => ({
          id: nodeId(),
          type: 'course',
          course: pick.course,
          note: pick.note,
        })),
      })
    case 'quote':
      return block({
        blockType: 'newsletterQuote',
        text: item.text,
        attribution: item.attribution ?? null,
      })
    case 'columns': {
      const fields: Record<string, unknown> = {}
      const names = ['first', 'second', 'third']
      for (const [i, column] of item.columns.entries()) {
        const children = await nodesFor(column, title)
        fields[names[i] as string] = richText(children, wordsOf(column))
      }
      return block({
        blockType: 'columns',
        columnCount: String(item.columns.length),
        ratio: item.ratio,
        ...fields,
      })
    }
    default: {
      const direction = rtl(item.text) ? 'rtl' : 'ltr'
      const base = {
        format: '',
        indent: 0,
        version: 1,
        direction,
        children: inline(item.runs, direction),
      }
      return item.k === 'h'
        ? { ...base, type: 'heading', tag: 'h2' }
        : { ...base, type: 'paragraph', textFormat: 0, textStyle: '' }
    }
  }
}

const wordsOf = (items: Item[]) =>
  items.flatMap((item) => ('text' in item ? [item.text] : [])).join(' ')

const nodesFor = async (items: Item[], title: string) => {
  const nodes = []
  for (const item of items) {
    const node = await nodeFor(item, title)
    if (node) nodes.push(node)
  }
  return nodes
}

const textOf = (item: LayoutItem | undefined) => (item && 'text' in item ? item.text : '')

const itemFor = (layout: Layout, id: number, inColumn: boolean): Item | null => {
  const item = layout.items[id]
  if (!item || item.kind === 'divider' || item.kind === 'pick') return null
  if (item.kind === 'image') {
    // A column's editor has no Image block, so one image there is a one-column gallery.
    return inColumn ? { k: 'gallery', images: [item], columns: 1 } : { k: 'figure', img: item }
  }
  return { k: item.kind === 'heading' ? 'h' : 'p', runs: item.runs, text: item.text }
}

const entryItems = (layout: Layout, entries: LayoutEntry[]): Item[] => {
  const out: Item[] = []
  for (const entry of entries) {
    if (typeof entry === 'number') {
      const item = layout.items[entry]
      if (item?.kind === 'pick') {
        const last = out.at(-1)
        if (last?.k === 'picks') last.picks.push(item)
        else out.push({ k: 'picks', picks: [item] })
      } else {
        const built = itemFor(layout, entry, false)
        if (built) out.push(built)
      }
    } else if ('figure' in entry) {
      const img = layout.items[entry.figure] as Img
      const written = (entry.caption ?? []).map((id) => textOf(layout.items[id])).join(' ')
      out.push({ k: 'figure', img: { ...img, caption: written || img.caption } })
    } else if ('gallery' in entry) {
      out.push({
        k: 'gallery',
        images: entry.gallery.map((id) => layout.items[id] as Img),
        columns: entry.columns,
      })
    } else if ('columns' in entry) {
      out.push({
        k: 'columns',
        ratio: entry.ratio,
        columns: entry.columns.map((column) =>
          column.flatMap((id) => {
            const built = itemFor(layout, id, true)
            return built ? [built] : []
          }),
        ),
      })
    } else {
      out.push({
        k: 'quote',
        text: textOf(layout.items[entry.quote]),
        attribution: entry.attribution,
      })
    }
  }
  return out
}

const sectionsOf = async (plan: Plan) => {
  const layout = JSON.parse(
    readFileSync(`${layoutDir}/${plan.kind}-${plan.key}.layout.json`, 'utf8'),
  ) as Layout
  const sections = []
  for (const section of layout.sections) {
    const items = entryItems(layout, section.items)
    const children = await nodesFor(items, plan.title)
    if (children.length) sections.push({ body: richText(children, wordsOf(items)) })
  }
  return sections as unknown as NonNullable<Newsletter['sections']>
}

const coverCaption = (text: string | null) =>
  text
    ? (richText(
        [
          {
            type: 'paragraph',
            version: 1,
            format: '',
            indent: 0,
            direction: rtl(text) ? 'rtl' : 'ltr',
            textFormat: 0,
            textStyle: '',
            children: [textNode({ t: text, b: false, i: false, a: null })],
          },
        ],
        text,
      ) as unknown as Newsletter['cover_caption'])
    : null

let done = 0
for (const plan of plans) {
  const key = `${plan.kind}:${plan.key}`
  if (skip.has(key) || (wanted && !wanted.has(key))) continue

  const data = {
    sections: await sectionsOf(plan),
    cover_image: plan.cover ? await mediaFor(plan.cover, plan.title, null) : undefined,
    cover_caption: coverCaption(plan.cover_caption),
    sent_at: new Date(plan.date).toISOString(),
    ...(plan.preheader ? { preheader: plan.preheader } : {}),
  }

  // draft: false writes the main row as well as a version; _status keeps what the issue is.
  const write = { draft: false, locale: 'en' as const, overrideAccess: true }
  const { docs } = await payload.find({
    collection: 'newsletters',
    where: plan.kind === 'draft' ? { id: { equals: plan.key } } : { slug: { equals: plan.slug } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = docs[0]
  if (found) {
    await payload.update({
      collection: 'newsletters',
      id: found.id,
      data: { ...data, _status: found._status ?? 'draft' },
      ...write,
    })
  } else {
    await payload.create({
      collection: 'newsletters',
      data: {
        ...data,
        _status: 'draft',
        title: plan.title,
        slug: plan.slug,
        issue_date: plan.date,
      },
      ...write,
    })
  }
  done += 1
  console.log(`done ${key} ${plan.title}: ${data.sections.length} sections`)
}

console.log(`finished ${done}, media ${mediaIds.size}`)
process.exit(0)
