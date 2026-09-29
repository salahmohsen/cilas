import { getPayload } from 'payload'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload = await getPayload({ config })

const lexical = (text: string) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [{
      type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: '', textStyle: '',
      children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    }],
  },
})

const doc = await payload.create({
  collection: 'courses',
  overrideAccess: true,
  locale: "en",
  data: {
    course_type: 'THEMATIC',
    title: "TEST EN",
    description: {

    },
    schedule: {
      session_count: 8,
      first_session_date: '2026-04-30T00:00:00.000Z',
      Days: [{ days_of_week: 'Thu', start_time: '2026-04-30T18:00:00.000Z', end_time: '2026-04-30T20:30:00.000Z' }],
    },
  },
})
console.log('LOCAL API RETURN title:', JSON.stringify(doc.title))
console.log('LOCAL API RETURN schedule:', JSON.stringify(doc.schedule))
await payload.destroy()
process.exit(0)
