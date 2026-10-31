/**
 * Records where an essay's notes are marked in its text, from an answer that
 * names, for each note, its block and the words just before its marker:
 *
 *   npx tsx migration/record-note-anchors.ts <unit> <answer.json>
 *
 * The answer is [{ number, block, before }] (from the English PDF's word
 * positions, or an agent reading the Arabic page images). Each `before` must
 * occur exactly once in its block; otherwise nothing is written.
 * Output: migration/extracted/content/notes__<unit with : → __>.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as z from 'zod'

import { NoteAnchors, offsetAfter } from './lib/note-anchors'

const [unit, answerFile] = process.argv.slice(2)
if (!unit || !answerFile) throw new Error('Usage: record-note-anchors.ts <unit> <answer.json>')

const content = path.join(import.meta.dirname, 'extracted', 'content')
const file = (u: string) => path.join(content, `${u.replaceAll(':', '__')}.json`)
const essay = JSON.parse(readFileSync(file(unit), 'utf8')).data as {
  blocks: Array<{ type: string; text: string }>
}
const notes = new Set(
  essay.blocks
    .filter((b) => b.type === 'note')
    .flatMap((b) => (b.text.match(/^\s*(\d+)/) ? [Number(b.text.match(/^\s*(\d+)/)?.[1])] : [])),
)

const Answer = z.array(
  z.object({
    number: z.number().int().positive().nullable(),
    block: z.number().int().min(0),
    before: z.string().min(1),
  }),
)
const answer = Answer.parse(JSON.parse(readFileSync(answerFile, 'utf8')))

const problems: string[] = []
const anchors: NoteAnchors['anchors'] = []
for (const a of answer) {
  if (a.number === null) {
    problems.push(`an unnumbered note (after "${a.before}") is left in the notes list`)
    continue
  }
  if (!notes.has(a.number)) problems.push(`note ${a.number} is not among the essay's notes`)
  const block = essay.blocks[a.block]
  if (!block || block.type === 'note') {
    problems.push(`note ${a.number}: block ${a.block} is not body text`)
    continue
  }
  const offset = offsetAfter(block.text, a.before)
  if (offset === null)
    problems.push(`note ${a.number}: "${a.before}" is not found exactly once in block ${a.block}`)
  else anchors.push({ number: a.number, block: a.block, offset })
}
const fatal = problems.filter((p) => !p.includes('unnumbered'))
for (const p of problems) console.log(`- ${p}`)
if (fatal.length) process.exit(1)

const out = NoteAnchors.parse({ unit, anchors: anchors.sort((x, y) => x.number - y.number) })
writeFileSync(file(`notes:${unit}`), `${JSON.stringify(out, null, 2)}\n`)
console.log(`${unit}: ${anchors.length} of ${notes.size} notes anchored`)
