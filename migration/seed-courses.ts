/**
 * Stage 4 for cycles and courses: upsert seed/data/archive into the database.
 *
 *   npx tsx --env-file=.env migration/seed-courses.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { importCourses } from './lib/import-courses'
import { applyArabicNames } from './lib/names-ar'

const dir = path.join(import.meta.dirname, '..', 'seed', 'data', 'archive')
const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))

const main = async () => {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const result = await importCourses(payload, { cycles: read('cycles.json'), courses: read('courses.json') })
  console.log(`cycles ${result.cycles}, courses ${result.courses}, new people ${result.people}`)
  if (result.skipped.length) console.log(`skipped (no cycle): ${result.skipped.join(', ')}`)
  console.log(`Arabic names given: ${await applyArabicNames(payload)}`)
  await payload.destroy()
  process.exit(0)
}

main()
