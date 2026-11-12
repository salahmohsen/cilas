import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { escapeRegExp } from '@/lib/regexp'

// Every side-card and apply-card class a component uses must have a rule in
// styles.css. A wide replace in that file once deleted the registration card's
// and the course facts' rules, and the side card rendered unstyled.
const css = readFileSync('src/app/(frontend)/styles.css', 'utf8')
const components = [
  'src/components/side-card.tsx',
  'src/components/person/contributors.tsx',
  'src/components/article/reading-tools.tsx',
  'src/components/events/event-attendance.tsx',
  'src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx',
  'src/components/course/RegisterBar.tsx',
]

describe('side card styles', () => {
  it('has a rule for every side-card and apply-card class in use', () => {
    const used = new Set(
      components.flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/\b((?:side|apply)-card[\w-]*)/g)].map(
          (m) => m[1]!,
        ),
      ),
    )
    expect(used.size).toBeGreaterThan(10)
    const missing = [...used].filter(
      (name) => !new RegExp(`\\.${escapeRegExp(name)}(?![\\w-])`).test(css),
    )
    expect(missing).toEqual([])
  })
})
