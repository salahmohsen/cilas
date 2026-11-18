import { describe, expect, it } from 'vitest'

import { statsFrom } from '@/lib/broadcast-stats'

describe('statsFrom', () => {
  it('reads totals, the daily rows and the clicked links from Resend answers', () => {
    const stats = statsFrom(
      {
        totals: {
          sent: 200,
          delivered: 190,
          unique_opened: 80,
          unique_clicked: 20,
          open_rate: 42.1,
        },
        data: [{ period: '2026-11-01', unique_opened: 50, unique_clicked: 12 }],
      },
      { data: [{ url: 'https://ci-las.org/en', clicks: 9, unique_clicks: 7 }] },
      '2026-11-02T00:00:00.000Z',
    )
    expect(stats).toMatchObject({
      sent: 200,
      delivered: 190,
      opened: 80,
      clicked: 20,
      openRate: 42.1,
      bounced: 0,
    })
    expect(stats.timeline).toEqual([{ day: '2026-11-01', opened: 50, clicked: 12 }])
    expect(stats.links).toEqual([{ url: 'https://ci-las.org/en', clicks: 9, uniqueClicks: 7 }])
  })
})
