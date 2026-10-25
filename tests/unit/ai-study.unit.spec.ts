import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import { aiLink, fillPrompt, providers, studyFiles } from '@/lib/ai-study'

const origin = 'https://cilas.salahmohsen.com'
const limitOf = (id: string) => providers.find((p) => p.id === id)!.maxUrl

describe('study prompts', () => {
  it('points at the page twin and the site index from the configured origin', () => {
    expect(studyFiles(`${origin}/`, '/ar/study/some-course')).toEqual({
      pageUrl: `${origin}/ar/study/some-course`,
      pageFile: `${origin}/ar/study/some-course/llms.txt`,
      siteFile: `${origin}/llms.txt`,
    })
  })

  it('fills slots and drops a line that only held an empty slot', () => {
    const out = fillPrompt('Session: {session}\n{readings}\nCourse page: {pageUrl}', {
      session: 'Week 2',
      readings: '',
      pageUrl: 'u',
    })
    expect(out).toBe('Session: Week 2\nCourse page: u')
  })

  it('hands each provider the fullest prompt its link can carry', () => {
    const long = 'x'.repeat(7_000)
    const longer = 'x'.repeat(21_000)
    expect(aiLink('claude', [long, 'short'])).toBe(`https://claude.ai/new?q=${long}`)
    expect(aiLink('claude', [longer, long])).toBe(`https://claude.ai/new?q=${long}`)
    expect(aiLink('grok', [long, 'short'])).toBe('https://grok.com/?q=short')
    expect(aiLink('grok', [long])).toBe(`https://grok.com/?q=${long}`)
  })

  // A real course title, session and readings, the longest kind of slot.
  const values = {
    ...studyFiles(origin, '/ar/study/abstract-systems-concrete-lives'),
    course:
      'Abstract Systems, Concrete Lives: Selected Readings in Modern and Contemporary Humanities',
    session: 'Session 7: Modern Abstraction in Thinking the Collective Human Life: The Second Wave',
    readings: '',
  }

  for (const [lang, messages] of [
    ['en', en],
    ['ar', ar],
  ] as const) {
    const prompts = messages.StudyPrompt
    it(`fits the short ${lang} prompts in every provider's link`, () => {
      for (const kind of ['course', 'article', 'session'] as const) {
        const link = aiLink('grok', [fillPrompt(prompts[kind].short, values)])
        expect(link.length).toBeLessThanOrEqual(limitOf('grok'))
      }
    })

    // Arabic grows sixfold when encoded, so only English is held to this.
    if (lang === 'en')
      it("fits the compact English prompts in Gemini's link", () => {
        for (const kind of ['course', 'article', 'session'] as const) {
          const link = aiLink('gemini', [fillPrompt(prompts[kind].compact, values)])
          expect(link.length).toBeLessThanOrEqual(limitOf('gemini'))
        }
      })

    it(`fits the full ${lang} prompts in Claude's and ChatGPT's links`, () => {
      for (const kind of ['course', 'article', 'session'] as const) {
        const link = aiLink('claude', [fillPrompt(prompts[kind].full, values)])
        expect(link.length).toBeLessThanOrEqual(limitOf('claude'))
      }
    })
  }
})
