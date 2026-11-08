import type { Payload, PayloadRequest } from 'payload'

import type { Issue } from './newsletter'
import { PICK_TYPES } from './pick-types'
import { walkEditorNodes } from '@/lib/rich-text-references'
import { relId } from '@/lib/relation'
import { resolveRichTextReferences } from '@/lib/resolve-rich-text-references'

type Pick = Record<string, unknown> & { type?: string | null }
type Bodies = ReadonlyArray<{ body?: unknown }> | null | undefined
type Read = {
  locale: 'en' | 'ar'
  overrideAccess: boolean
  fallbackLocale?: 'en' | 'ar'
  req?: PayloadRequest
}

/** Every pick in these bodies, wherever it sits, including inside columns. */
export const picksIn = (sections: Bodies): Pick[] => {
  const picks: Pick[] = []
  for (const section of sections ?? []) {
    walkEditorNodes(section.body, (node) => {
      if (node.fields?.blockType === 'newsletterPicks') {
        picks.push(...((node.fields.items ?? []) as Pick[]))
      }
    })
  }
  return picks
}

/**
 * Reads each pick's document again. Relationships inside rich text do not
 * populate to a depth a card can use, and a draft read leaves documents with
 * no version row as bare ids.
 */
export const fillPicks = async (payload: Payload, sections: Bodies, read: Read) => {
  for (const pick of picksIn(sections)) {
    const type = PICK_TYPES.find((t) => t.value === pick.type)
    const id = type ? relId(pick[type.value]) : null
    if (!type || typeof id !== 'number') continue
    pick[type.value] = await payload
      .findByID({ collection: type.relationTo, id, depth: 1, ...read })
      .catch(() => null)
  }
}

const fillMedia = async (payload: Payload, sections: Bodies, read: Read) => {
  const slots: { holder: Record<string, unknown>; key: string }[] = []
  for (const section of sections ?? []) {
    walkEditorNodes(section.body, (node) => {
      if (node.type === 'upload')
        slots.push({ holder: node as Record<string, unknown>, key: 'value' })
      const fields = node.fields
      if (fields?.blockType === 'newsletterImage') slots.push({ holder: fields, key: 'image' })
      if (fields?.blockType === 'gallery') {
        for (const row of (fields.images ?? []) as Record<string, unknown>[]) {
          slots.push({ holder: row, key: 'image' })
        }
      }
    })
  }
  const ids = [...new Set(slots.map((s) => relId(s.holder[s.key])))].filter(
    (id): id is number => typeof id === 'number',
  )
  if (!ids.length) return
  const { docs } = await payload.find({
    collection: 'media',
    where: { id: { in: ids } },
    depth: 0,
    pagination: false,
    ...read,
  })
  const byId = new Map(docs.map((doc) => [doc.id, doc]))
  for (const { holder, key } of slots) {
    const doc = byId.get(relId(holder[key]) as number)
    if (doc) holder[key] = doc
  }
}

/**
 * A newsletter issue's latest draft, its picks filled in for the cards.
 *
 * Reading the draft populates relationships from their drafts too, and a
 * document never saved as a draft (most imported ones) has no version row,
 * so it comes back as a bare id: those are read again as published. A
 * cycle's public courses are read with their covers and fellows, as each
 * shows as a full card.
 */
export const issueForEmail = async (payload: Payload, id: number, req?: PayloadRequest) => {
  const local = { overrideAccess: true, locale: 'en' as const, req }
  const issue = (await payload.findByID({
    collection: 'newsletters',
    id,
    depth: 2,
    draft: true,
    ...local,
  })) as Issue & {
    send_to?: number | { id: number } | null
    title: string
    sent_at?: string | null
  }
  await fillPicks(payload, issue.sections, local)
  for (const pick of picksIn(issue.sections)) {
    const doc = pick.cycle as { id?: number; courses?: unknown } | null | undefined
    if (pick.type !== 'cycle' || !doc?.id) continue
    const { docs } = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { cycle: { equals: doc.id } },
          { _status: { equals: 'published' } },
          { tier: { equals: 'public' } },
        ],
      },
      sort: 'title',
      depth: 1,
      limit: 20,
      ...local,
    })
    doc.courses = { docs }
  }
  await fillMedia(payload, issue.sections, local)
  issue.references = await resolveRichTextReferences(payload, issue, { locale: 'en', user: null })
  return issue
}
