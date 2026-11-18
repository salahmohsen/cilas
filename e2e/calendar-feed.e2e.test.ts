import { expect, test } from '@playwright/test'

const unfold = (feed: string) => feed.replace(/\r\n[ \t]/g, '')

const blocks = (lines: string[], name: string) => {
  const found: string[][] = []
  let open: string[] | null = null
  for (const line of lines) {
    if (line === `BEGIN:${name}`) open = []
    else if (line === `END:${name}`) {
      found.push(open ?? [])
      open = null
    } else open?.push(line)
  }
  return found
}

test.describe('calendar feed', () => {
  for (const locale of ['en', 'ar']) {
    test(`/${locale}/calendar.ics is an iCalendar feed`, async ({ request }) => {
      const response = await request.get(`/${locale}/calendar.ics`)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8')
      expect(response.headers()['content-disposition']).toBeUndefined()

      const feed = await response.text()
      const rawLines = feed.split('\r\n')
      expect(feed.endsWith('\r\n')).toBe(true)
      expect(feed.replace(/\r\n/g, '')).not.toContain('\n')
      for (const line of rawLines)
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)

      const lines = unfold(feed).split('\r\n').filter(Boolean)
      expect(lines[0]).toBe('BEGIN:VCALENDAR')
      expect(lines.at(-1)).toBe('END:VCALENDAR')
      const [calendar] = blocks(lines, 'VCALENDAR')
      expect(calendar).toContain('VERSION:2.0')
      expect(calendar!.some((line) => line.startsWith('PRODID:'))).toBe(true)

      const events = blocks(lines, 'VEVENT')
      expect(events.length).toBe(lines.filter((line) => line === 'BEGIN:VEVENT').length)
      expect(events.length).toBeGreaterThan(0)
      const uids = new Set<string>()
      for (const event of events) {
        const value = (name: string) =>
          event.find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`))
        expect(value('UID')).toBeDefined()
        expect(value('DTSTAMP')).toMatch(/:\d{8}T\d{6}Z$/)
        expect(value('DTSTART')).toMatch(/:\d{8}(T\d{6}Z)?$/)
        expect(value('SUMMARY')).toBeDefined()
        uids.add(value('UID')!)
      }
      expect(uids.size).toBe(events.length)
    })
  }

  test('?download asks the browser to save the file', async ({ request }) => {
    const response = await request.get('/en/calendar.ics?download')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-disposition']).toBe(
      'attachment; filename="cilas-calendar-en.ics"',
    )
  })
})
