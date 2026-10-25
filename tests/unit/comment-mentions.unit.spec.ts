import { describe, expect, it } from 'vitest'

import { matchMentions, type CommentAuthor } from '@/components/arc/comment-thread/comment-thread'

const person = (id: string, name: string): CommentAuthor => ({ id, name })

describe('comment mentions', () => {
  const first = person('1', 'Mona Farid')
  const second = person('2', 'Mona Farid')
  const other = person('3', 'Omar Said')

  it('gives two people with one name their own place, in the order they were picked', () => {
    const found = matchMentions('Hi @Mona Farid and @Mona Farid', [second, first], [first, second])
    expect(found.map((f) => f.person.id)).toEqual(['2', '1'])
  })

  it('falls back to the first person with that name when nobody was picked', () => {
    const found = matchMentions('Hi @Mona Farid', [], [first, second, other])
    expect(found.map((f) => f.person.id)).toEqual(['1'])
  })

  it('finds the position of each mention, and ignores names it does not know', () => {
    const text = 'a @Omar Said b @Nobody'
    const found = matchMentions(text, [other], [other])
    expect(found).toHaveLength(1)
    expect(text.slice(found[0]!.start, found[0]!.end)).toBe('@Omar Said')
  })
})
