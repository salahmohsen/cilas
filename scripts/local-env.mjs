import { randomBytes } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'

// One whole definition of `key`, in the forms dotenv accepts: `KEY=v`, `export KEY=v`,
// `KEY = v`, `KEY: v`, indented, and a quoted value that spans several lines.
const definition = (key) =>
  new RegExp(
    `^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*(?:=|:[ \\t])[ \\t]*` +
      `(?:'(?:\\\\'|[^'])*'|"(?:\\\\"|[^"])*"|\`(?:\\\\\`|[^\`])*\`|[^\\r\\n]*)[^\\r\\n]*(?:\\r?\\n|$)`,
    'gm',
  )

// Sets `key` once: the first definition becomes `line`, later ones are removed.
function setKey(text, key, line, eol) {
  let seen = false
  const next = text.replace(definition(key), () => (seen++ ? '' : line + eol))
  if (seen) return next
  return `${text && !text.endsWith('\n') ? text + eol : text}${line}${eol}`
}

/**
 * Returns the text of a local env file with `overrides` set and a PAYLOAD_SECRET
 * of its own. A local secret that equals the production one would sign tokens
 * the live site accepts, so every line that holds it is removed and a new secret
 * is written. A different local secret stays exactly as the user wrote it.
 */
export function withLocalEnv(text, overrides, productionSecret) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const current = dotenv.parse(text).PAYLOAD_SECRET
  const values = { ...overrides }
  if (current && current !== productionSecret) {
    text = text.replace(definition('PAYLOAD_SECRET'), (match) =>
      dotenv.parse(match).PAYLOAD_SECRET === productionSecret ? '' : match,
    )
  } else {
    values.PAYLOAD_SECRET = randomBytes(32).toString('hex')
  }
  for (const [key, value] of Object.entries(values)) {
    text = setKey(text, key, `${key}=${JSON.stringify(value)}`, eol)
  }
  return text
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
