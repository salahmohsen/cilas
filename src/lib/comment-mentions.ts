import type { MentionValue } from '@/components/arc/mention-input/mention-input'

/**
 * Comments are plain text (spec §4). A mention is stored as the posts store
 * it, `[@Name](/people/{id})`, so `validateMentions` and notifications read
 * both the same way.
 */
const MENTION = /\[@([^\]]*)\]\(\/people\/(\d+)\)/g

export type CommentPiece = { text: string } | { person: number; name: string }

/** The stored body, split into text runs and mentions, for rendering. */
export const commentPieces = (body: string): CommentPiece[] => {
  const pieces: CommentPiece[] = []
  let at = 0
  for (const m of body.matchAll(MENTION)) {
    if (m.index > at) pieces.push({ text: body.slice(at, m.index) })
    pieces.push({ person: Number(m[2]), name: m[1] })
    at = m.index + m[0].length
  }
  if (at < body.length) pieces.push({ text: body.slice(at) })
  return pieces
}

/** The stored body as the mention input's value, for editing. */
export const toMentionValue = (body: string): MentionValue => {
  let text = ''
  const mentions: MentionValue['mentions'] = []
  for (const piece of commentPieces(body)) {
    if ('text' in piece) {
      text += piece.text
      continue
    }
    const start = text.length
    text += `@${piece.name}`
    mentions.push({
      kind: 'person',
      id: String(piece.person),
      label: piece.name,
      start,
      end: text.length,
    })
  }
  return { text, mentions }
}

/** The mention input's value as the stored body. Brackets in a name would end the link early. */
export const fromMentionValue = (value: MentionValue): string => {
  let out = ''
  let at = 0
  for (const m of [...value.mentions].sort((a, b) => a.start - b.start)) {
    if (m.kind !== 'person') continue
    out += `${value.text.slice(at, m.start)}[@${m.label.replace(/[[\]]/g, '')}](/people/${m.id})`
    at = m.end
  }
  return out + value.text.slice(at)
}
