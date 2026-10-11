import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as z from 'zod'

/** Recorded on answers written by a Claude Code agent (subscription), not the API. */
export const AGENT_MODEL = 'claude-code:haiku'

/** The repository root, as it appears in prompts that list file paths. */
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

/**
 * The hash ignores where the repo lives: absolute paths in a prompt (page
 * images) are written relative to the repo root first, so committed answers
 * stay current on any machine.
 */
export const shaOf = (version: string, model: string, prompt: string): string =>
  createHash('sha256')
    .update(`${version}\n${model}\n${prompt.split(REPO_ROOT).join('<repo>')}`)
    .digest('hex')

type Key = { outDir: string; name: string; prompt: string; version: string }

/** A committed answer exists for this exact prompt (under whichever model wrote it). */
export const isCurrent = ({ outDir, name, prompt, version }: Key): boolean => {
  const file = path.join(outDir, `${name}.json`)
  if (!existsSync(file)) return false
  const cached = JSON.parse(readFileSync(file, 'utf8')) as { sha256: string; model: string }
  return cached.sha256 === shaOf(version, cached.model, prompt)
}

/** Validates an agent's answer and commits it, stamped with the prompt's hash. */
export const recordAnswer = <T>({
  schema,
  answerFile,
  ...key
}: Key & { schema: z.ZodType<T>; answerFile: string }): T => {
  const data = schema.parse(JSON.parse(readFileSync(answerFile, 'utf8')))
  mkdirSync(key.outDir, { recursive: true })
  writeFileSync(
    path.join(key.outDir, `${key.name}.json`),
    `${JSON.stringify({ sha256: shaOf(key.version, AGENT_MODEL, key.prompt), model: AGENT_MODEL, version: key.version, data }, null, 2)}\n`,
  )
  return data
}

/** The prompt plus the answer's JSON Schema, as an agent sees it. */
export const agentPrompt = (prompt: string, schema: z.ZodType): string => {
  const { $schema: _draft, ...json } = z.toJSONSchema(schema) as Record<string, unknown>
  return `${prompt.replace(/\n\nCall the record_page tool with the result\.$/, '')}\n\nAnswer with one JSON object matching this JSON Schema, and nothing else:\n\n${JSON.stringify(json)}`
}
