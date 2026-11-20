import Color from 'colorjs.io'
import postcss from 'postcss'

export type Context = {
  theme: 'light' | 'dark'
  contrast: 'normal' | 'more'
  page: 'site' | 'spaces'
}

type Scope = { specificity: number; dark: boolean; spaces: boolean }

const SCOPES: Record<string, Scope> = {
  ':root': { specificity: 1, dark: false, spaces: false },
  ":root[data-theme='dark']": { specificity: 2, dark: true, spaces: false },
  ":root:has([data-page='spaces'])": { specificity: 2, dark: false, spaces: true },
  ":root[data-theme='dark']:has([data-page='spaces'])": {
    specificity: 3,
    dark: true,
    spaces: true,
  },
}

type Declaration = { value: string; specificity: number; order: number }

const MAX_DEPTH = 32

const matches = (scope: Scope, context: Context) =>
  (!scope.dark || context.theme === 'dark') && (!scope.spaces || context.page === 'spaces')

const collect = (sheets: string[], context: Context) => {
  const declarations = new Map<string, Declaration>()
  let order = 0
  const read = (rule: postcss.Rule) => {
    for (const selector of rule.selectors) {
      const scope = SCOPES[selector.replaceAll('"', "'")]
      if (!scope || !matches(scope, context)) continue
      for (const node of rule.nodes) {
        if (node.type !== 'decl' || !node.prop.startsWith('--')) continue
        order += 1
        const current = declarations.get(node.prop)
        const wins =
          !current ||
          scope.specificity > current.specificity ||
          (scope.specificity === current.specificity && order > current.order)
        if (wins)
          declarations.set(node.prop, { value: node.value, specificity: scope.specificity, order })
      }
    }
  }
  for (const sheet of sheets) {
    for (const node of postcss.parse(sheet).nodes) {
      if (node.type === 'rule') read(node)
      else if (
        node.type === 'atrule' &&
        node.name === 'media' &&
        context.contrast === 'more' &&
        node.params.replace(/\s+/g, ' ') === '(prefers-contrast: more)'
      ) {
        node.walkRules(read)
      }
    }
  }
  return declarations
}

const splitTopLevel = (text: string, separator: string) => {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth += 1
    else if (text[i] === ')') depth -= 1
    else if (text[i] === separator && depth === 0) {
      parts.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(text.slice(start).trim())
  return parts
}

const inner = (value: string, name: string) =>
  value.startsWith(`${name}(`) && value.endsWith(')') ? value.slice(name.length + 1, -1) : null

export const tokenResolver = (sheets: string[], context: Context) => {
  const declarations = collect(sheets, context)

  const evaluate = (value: string, depth: number): Color => {
    if (depth > MAX_DEPTH) throw new Error(`Token cycle at ${value}`)
    const text = value.trim()
    const variable = inner(text, 'var')
    if (variable !== null) {
      const [name = '', ...fallback] = splitTopLevel(variable, ',')
      const declared = declarations.get(name)
      if (declared) return evaluate(declared.value, depth + 1)
      if (fallback.length) return evaluate(fallback.join(','), depth + 1)
      throw new Error(`Unresolved token ${name}`)
    }
    const mix = inner(text, 'color-mix')
    if (mix !== null) {
      const [space, first, second] = splitTopLevel(mix, ',')
      if (space !== 'in oklab' || !first || !second)
        throw new Error(`Unsupported color-mix ${text}`)
      const share = /^(.*\S)\s+(\d+(?:\.\d+)?)%$/.exec(first)
      if (!share?.[1] || !share[2]) throw new Error(`Unsupported color-mix ${text}`)
      return Color.mix(
        evaluate(share[1], depth + 1),
        evaluate(second, depth + 1),
        1 - Number(share[2]) / 100,
        { space: 'oklab', premultiplied: true },
      )
    }
    return new Color(text)
  }

  return (token: string) => evaluate(`var(${token})`, 0)
}

export const clip = (color: Color): Color => color.to('srgb').toGamut({ method: 'clip' })

export const over = (fg: Color, bg: Color): Color => {
  if ((bg.alpha ?? 1) < 1) throw new Error('The background must be opaque')
  const f = clip(fg)
  const b = clip(bg)
  const a = f.alpha ?? 1
  const mix = (i: number) => (f.coords[i] ?? 0) * a + (b.coords[i] ?? 0) * (1 - a)
  return new Color('srgb', [mix(0), mix(1), mix(2)])
}

export const ratio = (fg: Color, bg: Color): number => over(fg, bg).contrast(clip(bg), 'WCAG21')
