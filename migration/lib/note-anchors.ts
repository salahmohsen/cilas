import * as z from 'zod'

/**
 * Where each numbered note of an essay is marked in its text: the block (by
 * index in the essay's blocks) and the character offset its marker follows.
 * Stored in migration/extracted/content/notes__<unit>.json.
 */
export const NoteAnchors = z.object({
  unit: z.string(),
  anchors: z.array(z.object({ number: z.number().int().positive(), block: z.number().int().min(0), offset: z.number().int().min(0) })),
})
export type NoteAnchors = z.infer<typeof NoteAnchors>

/** "the words before it" → the offset just after them, if they occur exactly once. */
export const offsetAfter = (text: string, before: string): number | null => {
  const at = text.indexOf(before)
  if (at === -1 || text.indexOf(before, at + 1) !== -1) return null
  return at + before.length
}

/**
 * The essay's blocks with a `[^n]` marker at each anchored note's place
 * (blocks.ts turns these into footnotes). Offsets are applied from the end of
 * each block so earlier ones stay valid.
 */
export const markNotes = <B extends { text: string }>(blocks: B[], anchors: NoteAnchors['anchors']): B[] => {
  const byBlock = new Map<number, Array<{ number: number; offset: number }>>()
  for (const a of anchors) byBlock.set(a.block, [...(byBlock.get(a.block) ?? []), a])
  return blocks.map((b, i) => {
    const marks = byBlock.get(i)
    if (!marks) return b
    let text = b.text
    for (const m of [...marks].sort((x, y) => y.offset - x.offset)) {
      text = `${text.slice(0, m.offset)}[^${m.number}]${text.slice(m.offset)}`
    }
    return { ...b, text }
  })
}
