import { getPayload } from 'payload'
import type { Payload } from 'payload'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

const variants: Array<[string, () => Promise<unknown>]> = [
  ['find default depth', () => payload.find({ collection: 'users', limit: 2 })],
  [
    'find locale all',
    () => payload.find({ collection: 'users', limit: 2, locale: 'all', depth: 0 }),
  ],
  [
    'find depth 2 (populates courses virtual)',
    () => payload.find({ collection: 'users', limit: 2, depth: 2 }),
  ],
  ['findByID', () => payload.findByID({ collection: 'users', id: 1 })],
  ['me', () => payload.find({ collection: 'users', limit: 1, where: { id: { equals: 1 } } })],
  ['users with courses collection present', () => payload.count({ collection: 'courses' })],
]

for (const [label, run] of variants) {
  try {
    const res = (await run()) as any
    const n = res?.totalDocs ?? (Array.isArray(res?.docs) ? res.docs.length : 'ok')
    console.log(`OK   ${label} ->`, n)
  } catch (e: any) {
    console.log(`FAIL ${label} ->`, e?.message?.slice(0, 160))
    const c = e?.cause
    if (c) console.log('     cause:', c.code, c.message, c.detail ?? '')
  }
}

await payload.destroy()
process.exit(0)
