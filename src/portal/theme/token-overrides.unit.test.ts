import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import Color from 'colorjs.io'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import { buildScope } from '../../../scripts/build-arc-scope.mjs'
import { isRootScope, ratio } from './contrast'

const SRC = fileURLToPath(new URL('../../', import.meta.url))
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const ARC_SCOPE = 'src/components/admin/dashboard/arc-scope.css'

const cssFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css') && !path.includes('node_modules'))
  .map((path) => join(SRC, path))

const GUARDED = /^--(text-muted|border-strong|warning|focus-outline|radius-.+)$/
const SHADCN_RADIUS = /^--radius-(sm|md|lg|xl|2xl|3xl|4xl)$/
const SCALE = new Set(['8px', '12px', '16px', '24px', '6px', '18px'])

const PAPER = new Map([
  ['--text-muted', 'var(--paper-text-muted)'],
  ['--border-strong', 'var(--paper-border-strong)'],
])

const declared = (rule: postcss.Rule, prop: string) => {
  let value: string | undefined
  for (const node of rule.nodes) if (node.type === 'decl' && node.prop === prop) value = node.value
  return value
}

const posterRingFails = (rule: postcss.Rule) => {
  const ink = declared(rule, '--poster-ink')
  const paper = declared(rule, '--poster-paper')
  return !ink || !paper || ratio(new Color(ink), new Color(paper)) < 3
}

const violation = (decl: postcss.Declaration) => {
  const rule = decl.parent?.type === 'rule' ? (decl.parent as postcss.Rule) : undefined
  if (rule?.selectors.every(isRootScope)) return false
  if (SHADCN_RADIUS.test(decl.prop)) return false
  if (decl.prop.startsWith('--radius-')) return !SCALE.has(decl.value)
  if (PAPER.get(decl.prop) === decl.value) return false
  if (decl.prop === '--focus-outline' && decl.value === 'var(--poster-ink)')
    return !rule || posterRingFails(rule)
  return true
}

const sheets = cssFiles
  .map((path) => ({ file: relative(ROOT, path), css: readFileSync(path, 'utf8') }))
  .filter(({ file }) => file !== ARC_SCOPE)

describe('local token overrides', () => {
  it('scans the CSS it should', () => {
    expect(sheets.length).toBeGreaterThan(40)
    expect(sheets.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        'src/app/(frontend)/styles.css',
        'src/components/space/space.module.css',
      ]),
    )
  })

  it('declares no guarded token off the root scopes unless the table covers it', () => {
    const found: string[] = []
    for (const { file, css } of sheets) {
      postcss.parse(css, { from: file }).walkDecls(GUARDED, (decl) => {
        if (violation(decl))
          found.push(`${file}:${decl.source?.start?.line} ${decl.prop}: ${decl.value}`)
      })
    }
    expect(found).toEqual([])
  })

  it('draws the ring in ink on every printed panel, which stays white in the dark theme', () => {
    const found: string[] = []
    for (const { file, css } of sheets) {
      postcss.parse(css, { from: file }).walkRules((rule) => {
        const paper = declared(rule, '--poster-paper')
        if (
          paper &&
          !paper.startsWith('var(') &&
          declared(rule, '--focus-outline') !== 'var(--poster-ink)'
        )
          found.push(`${file}:${rule.source?.start?.line} ${rule.selector}`)
      })
    }
    expect(found).toEqual([])
  })

  it('keeps the default ring in every var(--focus-outline, ...) fallback', () => {
    const found: string[] = []
    for (const { file, css } of sheets) {
      postcss.parse(css, { from: file }).walkDecls((decl) => {
        const fallback = /var\(--focus-outline,\s*(.+)\)\s*!?\w*$/.exec(decl.value)?.[1]
        if (fallback && fallback !== 'var(--accent-strong)')
          found.push(`${file}:${decl.source?.start?.line} ${fallback}`)
      })
    }
    expect(found).toEqual([])
  })

  it('has an arc-scope.css that matches foundation.css', () => {
    const squash = (css: string) => css.replace(/\s+/g, '')
    const foundation = readFileSync(join(SRC, 'components/arc/foundation.css'), 'utf8')
    expect(squash(readFileSync(join(ROOT, ARC_SCOPE), 'utf8'))).toBe(squash(buildScope(foundation)))
  })
})
