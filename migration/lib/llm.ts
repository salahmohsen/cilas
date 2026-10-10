import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import * as z from 'zod'

export const EXTRACT_MODEL = 'claude-haiku-5-5'

type Cached = { sha256: string; model: string; version: string; data: unknown }

/**
 * Runs `call` only when this page's prompt (or the version or model) changed
 * since the committed result in `dir/<name>.json`; validates every result.
 */
export const extractCached = async <T>({
  dir,
  name,
  prompt,
  version,
  model,
  schema,
  call,
}: {
  dir: string
  name: string
  prompt: string
  version: string
  model: string
  schema: z.ZodType<T>
  call: (prompt: string) => Promise<unknown>
}): Promise<T> => {
  const sha256 = createHash('sha256').update(`${version}\n${model}\n${prompt}`).digest('hex')
  const file = path.join(dir, `${name}.json`)
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8')) as Cached
    if (cached.sha256 === sha256) return schema.parse(cached.data)
  }
  const data = schema.parse(await call(prompt))
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, `${JSON.stringify({ sha256, model, version, data } satisfies Cached, null, 2)}\n`)
  return data
}

/**
 * One forced tool call whose input schema is the zod schema, so the model
 * must answer in that shape. Reads ANTHROPIC_API_KEY.
 */
export const anthropicCall =
  (schema: z.ZodType, model = EXTRACT_MODEL) =>
  async (prompt: string): Promise<unknown> => {
    const client = new Anthropic()
    // zod adds a `$schema` key the tool input schema doesn't need.
    const { $schema: _draft, ...inputSchema } = z.toJSONSchema(schema) as Record<string, unknown>
    const res = await client.messages.create({
      model,
      max_tokens: 16000,
      tools: [
        {
          name: 'record_page',
          description: 'Record the structured data extracted from the page.',
          input_schema: inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'record_page' },
      messages: [{ role: 'user', content: prompt }],
    })
    const tool = res.content.find((b) => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') throw new Error(`No tool call (stop: ${res.stop_reason})`)
    return tool.input
  }
