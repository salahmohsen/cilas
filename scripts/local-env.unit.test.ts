import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

import { withLocalEnv, writeLocalEnvFiles } from './local-env.mjs'

const production = 'production-payload-secret'
const overrides = { R2_BUCKET: 'cilas-local' }
const generated = /^[0-9a-f]{64}$/

const secretOf = (text: string) => dotenv.parse(text).PAYLOAD_SECRET
const definitionsOf = (text: string, key: string) =>
  text.split(/\r?\n/).filter((line) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*[=:]`).test(line))

describe('withLocalEnv', () => {
  it('never writes the production PAYLOAD_SECRET', () => {
    for (const text of ['', `PAYLOAD_SECRET="${production}"\n`, `PAYLOAD_SECRET=${production}\n`]) {
      const out = withLocalEnv(text, overrides, production)
      expect(out).not.toContain(production)
      expect(secretOf(out)).toMatch(generated)
    }
  })

  it.each([
    ['export', `export PAYLOAD_SECRET=${production}\n`],
    ['spaces around =', `PAYLOAD_SECRET = ${production}\n`],
    ['indent', `  PAYLOAD_SECRET=${production}\n`],
    ['indent and export', `\texport PAYLOAD_SECRET="${production}"\n`],
    ['single quotes', `PAYLOAD_SECRET='${production}'\n`],
    ['CRLF', `RESEND_API_KEY=x\r\nPAYLOAD_SECRET=${production}\r\n`],
    ['trailing comment', `PAYLOAD_SECRET="${production}" # prod\n`],
    ['no final newline', `PAYLOAD_SECRET=${production}`],
    [
      'a multi-line override before it',
      `R2_BUCKET="old\nsecond line"\nPAYLOAD_SECRET=${production}\n`,
    ],
    ['duplicate, production last', `PAYLOAD_SECRET=${production}\nPAYLOAD_SECRET=${production}\n`],
    ['its quoted value on the next line', `PAYLOAD_SECRET=\n"${production}"\nA=1\n`],
  ])('replaces a production secret written with %s', (_name, text) => {
    const out = withLocalEnv(text, overrides, production)
    expect(out).not.toContain(production)
    expect(out).not.toContain('second line')
    expect(definitionsOf(out, 'PAYLOAD_SECRET')).toHaveLength(1)
    expect(secretOf(out)).toMatch(generated)
  })

  it('drops a production line that sits before a local secret, and keeps the local one', () => {
    const text = `export PAYLOAD_SECRET=${production}\nRESEND_API_KEY=x\nPAYLOAD_SECRET=local-only\n`
    const out = withLocalEnv(text, overrides, production)
    expect(out).not.toContain(production)
    expect(out).toContain('PAYLOAD_SECRET=local-only\n')
    expect(secretOf(out)).toBe('local-only')
  })

  it('keeps other keys and a CRLF file consistent', () => {
    const out = withLocalEnv(
      `A=1\r\nexport PAYLOAD_SECRET=${production}\r\nB=2\r\n`,
      overrides,
      production,
    )
    expect(dotenv.parse(out)).toMatchObject({ A: '1', B: '2', R2_BUCKET: 'cilas-local' })
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('keeps a local secret of its own and is idempotent', () => {
    const text = 'PAYLOAD_SECRET="local-only"\nRESEND_API_KEY="x"\n'
    const once = withLocalEnv(text, overrides, production)
    expect(dotenv.parse(once)).toEqual({
      PAYLOAD_SECRET: 'local-only',
      RESEND_API_KEY: 'x',
      R2_BUCKET: 'cilas-local',
    })
    expect(withLocalEnv(once, overrides, production)).toBe(once)
  })

  it.each([
    ['a double quote in single quotes', `PAYLOAD_SECRET='a"b'\n`, 'a"b'],
    ['a backslash in single quotes', `PAYLOAD_SECRET='a\\nb\\\\c'\n`, 'a\\nb\\\\c'],
    ['an unquoted value with export', `export PAYLOAD_SECRET=plain-local\n`, 'plain-local'],
  ])('leaves a kept secret with %s as written', (_name, text, value) => {
    const out = withLocalEnv(text, overrides, production)
    expect(out.startsWith(text)).toBe(true)
    expect(secretOf(out)).toBe(value)
    expect(withLocalEnv(out, overrides, production)).toBe(out)
  })

  it('updates an override in place, however it was written', () => {
    const out = withLocalEnv(
      'export R2_BUCKET = old\nA=1\n  R2_BUCKET=older\nPAYLOAD_SECRET=s\n',
      overrides,
      production,
    )
    expect(out).toBe('R2_BUCKET="cilas-local"\nA=1\nPAYLOAD_SECRET=s\n')
  })

  describe('a key name inside the quoted value of another key', () => {
    const foo = (eol: string, inner: string) => `FOO="a${eol}${inner}${eol}b"${eol}`
    const fooOf = (text: string) => dotenv.parse(text).FOO

    it.each(['\n', '\r\n'])('keeps a local secret and FOO (%j)', (eol) => {
      const text = `${foo(eol, `PAYLOAD_SECRET=${production}`)}PAYLOAD_SECRET=local${eol}`
      const out = withLocalEnv(text, overrides, production)
      expect(out.startsWith(text)).toBe(true)
      expect(fooOf(out)).toBe(fooOf(text))
      expect(secretOf(out)).toBe('local')
    })

    it.each(['\n', '\r\n'])('replaces a production secret and keeps FOO (%j)', (eol) => {
      const text = `${foo(eol, 'PAYLOAD_SECRET=other')}PAYLOAD_SECRET=${production}${eol}`
      const out = withLocalEnv(text, overrides, production)
      expect(out).not.toContain(production)
      expect(out.startsWith(foo(eol, 'PAYLOAD_SECRET=other'))).toBe(true)
      expect(fooOf(out)).toBe(fooOf(text))
      expect(secretOf(out)).toMatch(generated)
    })

    it.each(['\n', '\r\n'])('adds an override and keeps FOO (%j)', (eol) => {
      const text = foo(eol, 'R2_BUCKET=zzz')
      const out = withLocalEnv(text, overrides, production)
      expect(out.startsWith(text)).toBe(true)
      expect(fooOf(out)).toBe(fooOf(text))
      expect(dotenv.parse(out).R2_BUCKET).toBe('cilas-local')
    })
  })

  it('keeps keys named like Object.prototype members', () => {
    const text = 'toString=1\nconstructor=2\n'
    expect(withLocalEnv(text, overrides, production).startsWith(text)).toBe(true)
  })

  it('removes a production secret after a U+2028 line break', () => {
    const out = withLocalEnv(
      `FOO="x"\u2028export PAYLOAD_SECRET=${production}\n`,
      overrides,
      production,
    )
    expect(out).not.toContain('export')
    expect(out).not.toContain(production)
    expect(dotenv.parse(out).FOO).toBe('x')
  })

  it('makes a secret when production has none', () => {
    expect(secretOf(withLocalEnv('', overrides, undefined))).toMatch(generated)
  })
})

describe('writeLocalEnvFiles', () => {
  it('rewrites every app directory, which is what --env-only runs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-env-'))
    const [a, b] = [path.join(root, 'a'), path.join(root, 'b')]
    await mkdir(a)
    await mkdir(b)
    await writeFile(path.join(a, '.env.development.local'), `export PAYLOAD_SECRET=${production}\n`)
    const paths = await writeLocalEnvFiles([a, b], overrides, production)
    expect(paths).toEqual([a, b].map((dir) => path.join(dir, '.env.development.local')))
    for (const file of paths) {
      const text = await readFile(file, 'utf8')
      expect(text).not.toContain(production)
      expect(secretOf(text)).toMatch(generated)
      expect((await stat(file)).mode & 0o777).toBe(0o600)
    }
  })
})
