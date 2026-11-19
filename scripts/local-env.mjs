import { randomBytes } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'

// dotenv's own LINE grammar (dotenv 16.4.7, lib/main.js), with the `d` flag for
// match indices. A quoted value is consumed as one unit, so a line inside it is
// never read as a definition of its own.
const LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/dgm
const REST_OF_LINE = /[^\r\n]*(?:\r?\n|\r)?/y

// Every definition dotenv reads, as the span from the start of its key's line
// to the end of the line where its value ends.
function definitions(text) {
  const matches = [...text.matchAll(LINE)]
  const starts = matches.map((match) =>
    Math.max(match.index, text.lastIndexOf('\n', match.indices[1][0] - 1) + 1),
  )
  return matches.map((match, i) => {
    REST_OF_LINE.lastIndex =
      match.indices[2]?.[1] ?? match.index + match[0].replace(/\s*(?:#.*)?$/, '').length
    REST_OF_LINE.exec(text)
    // JS also starts a line after U+2028 and U+2029, so a span stops where the next one starts.
    const end = Math.min(REST_OF_LINE.lastIndex, starts[i + 1] ?? Infinity)
    return { key: match[1], start: starts[i], end, text: text.slice(starts[i], end) }
  })
}

/**
 * Returns the text of a local env file with `overrides` set and a PAYLOAD_SECRET
 * of its own. A local secret that equals the production one would sign tokens
 * the live site accepts, so every definition that holds it is removed and a new
 * secret is written. A different local secret stays exactly as the user wrote it.
 * Each set key takes the place of its first definition; later ones are removed.
 * All other text stays as it was.
 */
export function withLocalEnv(text, overrides, productionSecret) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const current = dotenv.parse(text).PAYLOAD_SECRET
  const values = { ...overrides }
  if (!current || current === productionSecret) {
    values.PAYLOAD_SECRET = randomBytes(32).toString('hex')
  }
  const line = (key) => `${key}=${JSON.stringify(values[key])}${eol}`
  const unwritten = new Set(Object.keys(values))
  let out = ''
  let at = 0
  for (const definition of definitions(text)) {
    out += text.slice(at, definition.start)
    at = definition.end
    const { key } = definition
    if (key === 'PAYLOAD_SECRET' && dotenv.parse(definition.text)[key] === productionSecret)
      continue
    if (!Object.hasOwn(values, key)) out += definition.text
    else if (unwritten.delete(key)) out += line(key)
  }
  out += text.slice(at)
  if (unwritten.size && out && !out.endsWith('\n')) out += eol
  for (const key of unwritten) out += line(key)
  return out
}

/** Applies `withLocalEnv` to `.env.development.local` in each app directory. */
export async function writeLocalEnvFiles(appDirs, overrides, productionSecret) {
  const written = []
  for (const appDir of appDirs) {
    const envPath = path.join(appDir, '.env.development.local')
    let text = ''
    try {
      text = await readFile(envPath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await writeFile(envPath, withLocalEnv(text, overrides, productionSecret), { mode: 0o600 })
    await chmod(envPath, 0o600)
    written.push(envPath)
  }
  return written
}
