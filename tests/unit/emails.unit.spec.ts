// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import { describe, expect, it } from 'vitest'

import { DEFAULT_TEXTS, fill, paragraphs, withDefaults } from '@/emails/settings'

describe('fill', () => {
  it('puts values into {placeholders} and leaves unknown ones', () => {
    expect(fill('Dear {name}, see {title}. {other}', { name: 'Mona', title: 'Bridge' })).toBe(
      'Dear Mona, see Bridge. {other}',
    )
  })
})

describe('paragraphs', () => {
  it('splits on blank lines and drops empty ones', () => {
    expect(paragraphs('One\nstill one\n\n\nTwo\n')).toEqual(['One\nstill one', 'Two'])
  })
})

describe('withDefaults', () => {
  it('uses the default text where the global leaves one empty', () => {
    const s = withDefaults({ texts: { acceptance: { subject: '' } } })
    expect(s.texts.acceptance.subject).toBe(DEFAULT_TEXTS.acceptance.subject)
    expect(s.fromName).toBe('CILAS')
    expect(s.accent).toBe('#000000')
  })

  it('keeps what the admin wrote', () => {
    const s = withDefaults({ from_name: 'CILAS Admissions', accent: '#614500' })
    expect(s.fromName).toBe('CILAS Admissions')
    expect(s.accent).toBe('#614500')
  })
})
