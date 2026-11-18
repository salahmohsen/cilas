import { describe, it, expect } from 'vitest'
import { isValidPhoneNumber, parsePhoneNumber, statusOf, formatPhoneNumber } from '@/lib/phone'
import { answerText } from '@/forms/answer-text'
import { questionDescription } from '@/migrations/lib/question-description'
import { questionSchema } from '@/plugins/mcp/form-questions'

describe('phone answers', () => {
  it('parses Egyptian national digits from pasted international input', () => {
    const parsed = parsePhoneNumber('+20 (0)100 123 4567')!
    expect(parsed.country.iso).toBe('EG')
    expect(parsed.national).toBe('1001234567')
    expect(statusOf(parsed.country, parsed.national)).toBe('valid')
  })
  it.each([
    '+20100',
    '+201001234567890',
    '01001234567',
    '+20 1001234567',
    '+201001234567x',
    '+999123456789',
  ])('refuses noncanonical or invalid answer %s', (value) => {
    expect(isValidPhoneNumber(value)).toBe(false)
  })
  it('preserves excess digits and exposes a too-long state', () => {
    const parsed = parsePhoneNumber('+201001234567890')!
    expect(parsed.national).toBe('1001234567890')
    expect(statusOf(parsed.country, parsed.national)).toBe('too-long')
  })
  it('formats phone answers for readers and preserves unknown numbers', () => {
    expect(answerText({ blockType: 'phone' }, '+201001234567')).toBe('+20 100 123 4567')
    expect(formatPhoneNumber('unknown')).toBe('unknown')
    expect(isValidPhoneNumber('+201001234567')).toBe(true)
  })
})
describe('description conversion', () => {
  it('keeps each line, blank paragraphs, URL targets and the former linked labels', () => {
    const state = questionDescription('Read https://www.example.org/.\n\nThen answer.')
    expect(state.root.children).toHaveLength(3)
    expect(state.root.children[0].children).toMatchObject([
      { text: 'Read ' },
      {
        type: 'link',
        fields: { url: 'https://www.example.org/', newTab: true },
        children: [{ text: 'example.org' }],
      },
      { text: '.' },
    ])
    expect(state.root.children[1].children).toEqual([])
    expect(state.root.children[2].children).toMatchObject([{ text: 'Then answer.' }])
  })
  it('accepts phone questions with localized Markdown and checks the ISO code', () => {
    expect(
      questionSchema.parse({
        type: 'phone',
        label: { en: 'Phone' },
        description: { en: '**Call** [us](https://example.org)\n\n- First' },
      }),
    ).toMatchObject({ type: 'phone', defaultCountry: 'EG' })
    expect(
      questionSchema.safeParse({ type: 'phone', label: { en: 'Phone' }, defaultCountry: 'XX' })
        .success,
    ).toBe(false)
  })
})

it('keeps a URL at the beginning of a description as a link', () => {
  expect(questionDescription('https://example.org').root.children[0].children[0]).toMatchObject({
    type: 'link',
    fields: { url: 'https://example.org' },
  })
})
