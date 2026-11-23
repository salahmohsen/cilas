import { describe, expect, it } from 'vitest'

import { publicItems, publicKinds } from '@/components/calendar/public-items'

import { meeting, meetings, words } from '../../../testing/public-calendar.fixture'

describe('publicItems', () => {
  const items = publicItems(meetings, words('en'))

  it('makes a session one item with its meetings as blocks, its cancelled ones apart', () => {
    const held = items.find((item) => item.id === 's1')!
    expect(held.blocks.map((block) => block.date)).toEqual(['2026-11-17', '2026-11-19'])
    expect(held).toMatchObject({
      kind: 'course:thematic',
      title: 'Reading the city',
      caption: 'Session 3',
      place: 'Online',
      tone: 'blue',
      cancelled: false,
      readOnly: true,
      href: '/en/study/reading-the-city#session-501',
      image: { url: '/media/city.jpg', alt: 'A street', position: '20% 80%' },
    })
    expect(items.find((item) => item.id === 's1-cancelled')).toMatchObject({
      cancelled: true,
      blocks: [
        { id: 's1-2026-11-21-1900', date: '2026-11-21', start_time: '19:00', end_time: '21:00' },
      ],
    })
  })

  it('keeps the id of a session whose every meeting is cancelled', () => {
    const all = publicItems(
      [
        meeting({ cancelled: true }),
        meeting({ key: 's1-2026-11-19-1900', date: '2026-11-19', cancelled: true }),
      ],
      words('en'),
    )
    expect(all.map((item) => [item.id, item.cancelled])).toEqual([['s1', true]])
  })

  it('writes the caption as the session number and its title, and the number alone without one', () => {
    const items = publicItems(
      [
        meeting({ sessionTitle: 'What is intelligence?' }),
        meeting({ key: 's2-x', item: 's2', sessionId: '502', session: 4 }),
      ],
      words('en'),
    )
    expect(items.find((item) => item.id === 's1')!.caption).toBe(
      'Session 3 · \u2068What is intelligence?\u2069',
    )
    expect(items.find((item) => item.id === 's2')!.caption).toBe('Session 4')
  })

  it('links the counts to the session row in the course page, in English and Arabic', () => {
    const counted = meeting({ materials: 3, activities: 1 })
    expect(publicItems([counted], words('en'))[0]!.more).toEqual({
      label: '3 materials · 1 activity',
      href: '/en/study/reading-the-city#session-501',
    })
    const [arabic] = publicItems([counted], words('ar'))
    expect(arabic!.more?.href).toBe('/ar/study/reading-the-city#session-501')
    expect(arabic!.more?.label).toBe('٣ مواد · نشاط واحد')
  })

  it.each([
    [{ materials: 2 }, '2 materials'],
    [{ activities: 2 }, '2 activities'],
    [{ materials: 1, activities: 1 }, '1 material · 1 activity'],
  ])('says only the counts there are: %j', (counts, label) => {
    expect(publicItems([meeting(counts)], words('en'))[0]!.more?.label).toBe(label)
  })

  it('has no counts row when the session has no materials and no activities, nor for an event', () => {
    expect(publicItems([meeting({})], words('en'))[0]).not.toHaveProperty('more')
    const event = meeting({ kind: 'event', sessionId: undefined, session: undefined })
    expect(publicItems([event], words('en'))[0]).not.toHaveProperty('more')
    expect(publicItems([event], words('en'))[0]!.href).toBe('/en/study/reading-the-city')
  })

  it('lists courses before events, each by type', () => {
    expect(items.map((item) => item.kind)).toEqual([
      'course:core',
      'course:thematic',
      'course:thematic',
      'event:screening',
    ])
    expect(items.at(-1)).toMatchObject({ href: '/en/events/film-night', title: 'Film night' })
    expect(items.at(-1)).not.toHaveProperty('caption')
  })
})

describe('publicKinds', () => {
  it('names course and event kinds as the public page did', () => {
    expect(
      publicKinds(
        [
          meeting({ kind: 'course', type: 'core' }),
          meeting({ kind: 'event', type: 'screening' }),
          meeting({ kind: 'course', type: 'core', key: 'again' }),
        ],
        {
          course: (type) => `course ${type}`,
          event: (type) => `event ${type}`,
          viewCourse: 'View course',
          viewEvent: 'View event',
        },
      ),
    ).toEqual({
      'course:core': { name: 'course core', open: 'View course' },
      'event:screening': { name: 'event screening', open: 'View event' },
    })
  })
})
