import { afterEach, describe, expect, it, vi } from 'vitest'

import { PLACE_NAME_MAX, mapsPlace, meetingService, placeHost, titlePlace } from '@/lib/event-place'
import { placeName } from '@/lib/link-preview'

describe('an event place read from its address', () => {
  it('reads the place of a Google Maps link', () => {
    expect(
      mapsPlace(
        'https://www.google.com/maps/place/Miette+French+Bakery+Maadi/@29.95,31.27,15z/data=!4m6',
      ),
    ).toBe('Miette French Bakery Maadi')
    expect(mapsPlace('https://www.google.com.eg/maps/place/%D9%85%D9%82%D9%87%D9%89/@1,2')).toBe(
      'مقهى',
    )
    expect(mapsPlace('https://maps.google.com/?q=Zamalek+Art+Gallery')).toBe('Zamalek Art Gallery')
    expect(mapsPlace('https://www.google.com/maps/search/CILAS+Cairo/')).toBe('CILAS Cairo')
  })

  it('names nothing for a share link, bare coordinates or another page', () => {
    expect(mapsPlace('https://maps.app.goo.gl/Brtkyy2rvbjwLTRo6')).toBeNull()
    expect(mapsPlace('https://www.google.com/maps/place/29.95,31.27/@29.95,31.27,15z')).toBeNull()
    expect(mapsPlace('https://www.google.com/search?q=cafe')).toBeNull()
    expect(mapsPlace('https://example.org/maps/place/Cafe')).toBeNull()
    expect(mapsPlace('not a url')).toBeNull()
  })

  it('cuts a long name to the stored length', () => {
    const name = titlePlace('a'.repeat(300))!
    expect(name).toHaveLength(PLACE_NAME_MAX)
    expect(name.endsWith('…')).toBe(true)
    expect(titlePlace('  ')).toBeNull()
  })

  it('knows the meeting services and the host for anything else', () => {
    expect(meetingService('https://us02web.zoom.us/j/123')).toBe('zoom')
    expect(meetingService('https://meet.google.com/abc-defg-hij')).toBe('meet')
    expect(meetingService('https://teams.microsoft.com/l/meetup-join/x')).toBe('teams')
    expect(meetingService('https://zoom.example.org/')).toBeNull()
    expect(placeHost('https://www.example.org/a')).toBe('example.org')
  })
})

describe('placeName', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('follows a share link through the checked fetch and stops at the place', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://www.google.com/maps/place/Room+2,+Zamalek/@30,31,15z' },
        }),
    )
    vi.stubGlobal('fetch', fetch)
    expect(await placeName('https://93.184.216.34/share')).toBe('Room 2, Zamalek')
    // The Maps page itself is never fetched.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses a page title, and nothing for a site name or a failure', async () => {
    const page = (title: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(`<head><title>${title}</title></head>`, {
              status: 200,
              headers: { 'content-type': 'text/html' },
            }),
        ),
      )
    page('Reading room at the Townhouse')
    expect(await placeName('https://93.184.216.34/venue')).toBe('Reading room at the Townhouse')
    page('Google Maps')
    expect(await placeName('https://93.184.216.34/venue')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')))
    expect(await placeName('https://93.184.216.34/down')).toBeNull()
  })

  it('never fetches a private host or a meeting service', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await placeName('http://127.0.0.1:3000/')).toBeNull()
    expect(await placeName('https://us02web.zoom.us/j/123')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
