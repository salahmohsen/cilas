import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'

const out = process.argv[2]
const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const all = await payload.find({ collection: 'courses', limit: 1000, locale: 'all', depth: 1, draft: true, pagination: false })
const cycles = await payload.find({ collection: 'cycles', limit: 1000, locale: 'all', depth: 0, draft: true, pagination: false })
writeFileSync(out, JSON.stringify({ courses: all.docs, cycles: cycles.docs }, null, 1))
console.log(all.docs.length, cycles.docs.length)
await payload.destroy()
process.exit(0)
