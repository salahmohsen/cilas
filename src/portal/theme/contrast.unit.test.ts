import { readFileSync } from 'node:fs'

import Color from 'colorjs.io'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import { type Context, over, ratio, tokenResolver } from './contrast'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const tokensCss = read('./tokens.css')
const badgeCss = read('../../components/arc/badge/badge.module.css')
const sheets = [
  read('../../components/arc/foundation.css'),
  tokensCss,
  read('../../app/(frontend)/styles.css'),
]

const ringRule = postcss
  .parse(sheets[0] ?? '')
  .nodes.find((node) => node.type === 'rule' && node.selector.startsWith(':focus-visible:not('))
const ring =
  ringRule?.type === 'rule'
    ? ringRule.nodes.find((node) => node.type === 'decl' && node.prop === 'outline')
    : undefined
const RING = ring?.type === 'decl' ? ring.value.split(' solid ')[1] : undefined

const ringColour = () => {
  if (!RING) throw new Error('No focus ring rule in foundation.css')
  return RING
}

const SURFACES = ['--background', '--surface', '--surface-raised', '--surface-muted']
const PAPER_SURFACES = ['oklch(100% 0 0)', 'oklch(97.8% 0 0)']
const TONES = ['neutral', 'success', 'info', 'warning', 'danger']

const contexts: Context[] = (['site', 'spaces'] as const).flatMap((page) =>
  (['light', 'dark'] as const).flatMap((theme) =>
    (['normal', 'more'] as const).map((contrast) => ({ theme, contrast, page })),
  ),
)

const pairs = (context: Context) => [
  ...['--foreground', '--text-secondary', '--text-muted'].flatMap((fg) =>
    SURFACES.map((bg) => ({ context, fg, bg, min: 4.5 })),
  ),
  ...['--border-strong', 'ring', '--danger'].flatMap((fg) =>
    SURFACES.map((bg) => ({ context, fg, bg, min: 3 })),
  ),
  ...PAPER_SURFACES.flatMap((bg) => [
    { context, fg: '--paper-text-muted', bg, min: 4.5 },
    { context, fg: '--paper-border-strong', bg, min: 3 },
  ]),
  ...(context.page === 'spaces'
    ? [
        { context, fg: '--portal-unread-foreground', bg: '--portal-unread', min: 4.5 },
        { context, fg: '--portal-unread', bg: '--surface-muted', min: 3 },
        { context, fg: '--portal-current-mark', bg: '--surface-muted', min: 3 },
        { context, fg: '--portal-current-mark', bg: '--background', min: 3 },
      ]
    : []),
]

const rows = contexts.flatMap(pairs)

const toneSheet = (tone: string) => {
  const rule = postcss
    .parse(badgeCss)
    .nodes.find((node) => node.type === 'rule' && node.selector === `.${tone}`)
  if (rule?.type !== 'rule') throw new Error(`No .${tone} in badge.module.css`)
  return `:root { ${rule.nodes.map((node) => (node.type === 'decl' ? `${node.prop}: ${node.value};` : '')).join(' ')} }`
}

const badgeToken = (context: Context, tone: string, property: string) =>
  tokenResolver([...sheets, toneSheet(tone)], context)(property)

describe('portal contrast table', () => {
  it.each(rows)(
    '$context.page $context.theme $context.contrast: $fg on $bg is at least $min:1',
    ({ context, fg, bg, min }) => {
      const resolve = tokenResolver(sheets, context)
      expect(ratio(resolve(fg === 'ring' ? ringColour() : fg), resolve(bg))).toBeGreaterThanOrEqual(
        min,
      )
    },
  )

  describe.each(contexts)('badges, $page $theme $contrast', (context) => {
    it.each(TONES)('%s is at least 4.5:1', (tone) => {
      const surface = tokenResolver(sheets, context)('--surface')
      const background = over(badgeToken(context, tone, '--badge-background'), surface)
      expect(
        ratio(badgeToken(context, tone, '--badge-foreground'), background),
      ).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('lists every badge tone that badge.module.css defines', () => {
    const defined = postcss
      .parse(badgeCss)
      .nodes.flatMap((node) =>
        node.type === 'rule' &&
        node.nodes.some((child) => child.type === 'decl' && child.prop === '--badge-foreground')
          ? [node.selector.replace(/^\./, '')]
          : [],
      )
    expect(defined.toSorted()).toEqual(TONES.toSorted())
  })

  it('space pages set the spec radii', () => {
    const radii = new Map<string, string>()
    postcss.parse(tokensCss).walkRules(":root:has([data-page='spaces'])", (rule) => {
      rule.walkDecls(/^--radius-/, (decl) => {
        radii.set(decl.prop, decl.value)
      })
    })
    expect(Object.fromEntries(radii)).toMatchObject({
      '--radius-inner': '8px',
      '--radius-control': '12px',
      '--radius-panel': '16px',
      '--radius-surface': '24px',
    })
  })

  it('gives --radius-inner a default outside space pages', () => {
    const defaults = new Set<string>()
    postcss.parse(sheets[0] ?? '').walkRules(':root', (rule) => {
      rule.walkDecls('--radius-inner', (decl) => {
        defaults.add(decl.value)
      })
    })
    expect([...defaults]).toEqual(['0.375rem'])
  })

  it('parses unitless and percent oklch with alpha', () => {
    expect(new Color('oklch(1 0 0)').coords[0]).toBeCloseTo(1, 5)
    expect(new Color('oklch(100% 0 0 / 10%)').alpha).toBeCloseTo(0.1, 5)
  })

  it('matches Chrome: dark normal --danger on --surface is 6.6:1 within 0.1', () => {
    const resolve = tokenResolver(sheets, { theme: 'dark', contrast: 'normal', page: 'site' })
    expect(Math.abs(ratio(resolve('--danger'), resolve('--surface')) - 6.6)).toBeLessThan(0.1)
  })
})
