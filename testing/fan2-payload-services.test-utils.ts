import { http, HttpResponse, passthrough } from 'msw'

export const payloadServices = [
  http.all('http://localhost:8108/*', () => passthrough()),
  http.post(
    'https://telemetry.payloadcms.com/events',
    () => new HttpResponse(null, { status: 204 }),
  ),
]
