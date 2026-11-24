import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { LATEST_PAGE, latestPagesOf, latestRows } from './latest'

describe('latestPagesOf', () => {
  it.each([
    ['2', 60],
    ['10', 300],
    [undefined, 30],
    ['abc', 30],
    ['0', 30],
    ['-1', 30],
    ['1.5', 30],
    ['99999', 30],
    ['', 30],
  ])('latest=%s reads %i rows', (value, rows) => {
    expect(LATEST_PAGE * latestPagesOf(value)).toBe(rows)
  })

  it('reads the first value of a repeated parameter', () => {
    expect(latestPagesOf(['3', '5'])).toBe(3)
  })
})

describe('latestRows', () => {
  const links = [
    '/spaces/course/study/posts/4',
    '/en/spaces/community/3',
    '/ar/spaces/cohort/spring',
    '/spaces/community',
    'https://cilas.example/spaces/course/study?session=a',
    '/admin/collections/articles/1',
    '/en/spaces/courses',
    '/en/spaces/inbox',
    '/en/study',
    null,
  ]
  const linksWith = async (mode: 'on' | 'trial' | 'off') => {
    const payload = {
      findGlobal: async () => ({ spaces_mode: mode }),
      find: async () => ({ docs: links.map((link, id) => ({ id, link })), hasNextPage: false }),
    } as unknown as Payload
    const { rows } = await latestRows(payload, { id: 1 } as User, 30)
    return rows.map((row) => row.link)
  }

  it('drops the link of a row that opens a space page while spaces are off', async () => {
    expect(await linksWith('off')).toEqual([
      null,
      null,
      null,
      null,
      null,
      '/admin/collections/articles/1',
      '/en/spaces/courses',
      '/en/spaces/inbox',
      '/en/study',
      null,
    ])
  })

  it.each(['on', 'trial'] as const)('keeps every link while spaces are %s', async (mode) => {
    expect(await linksWith(mode)).toEqual(links)
  })
})
