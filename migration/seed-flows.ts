/**
 * Stage 4 for the course flows: write the extracted syllabi into their courses.
 *
 *   npx tsx --env-file=.env migration/seed-flows.ts
 *
 * Reads migration/flows.json, migration/extracted/flows/*.json and
 * seed/data/archive/courses.json. Running it again is safe: sessions are
 * replaced, not added, and reviewed courses are never touched.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { importFlows, type FlowEntry } from './lib/import-flows'
import { Syllabus } from './lib/syllabus-schema'

const here = import.meta.dirname
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

const main = async () => {
  const flows = read(path.join(here, 'flows.json')) as FlowEntry[]
  const syllabi = new Map<string, Syllabus>()
  for (const f of flows) {
    const file = path.join(here, 'extracted', 'flows', `${f.id}.json`)
    if (existsSync(file)) syllabi.set(f.id, Syllabus.parse((read(file) as { data: unknown }).data))
  }
  const courses = read(path.join(here, '..', 'seed', 'data', 'archive', 'courses.json'))

  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const result = await importFlows(payload, { flows, syllabi, courses })
  console.log(
    `${syllabi.size} syllabi of ${flows.length} flow(s): courses ${result.courses}, sessions ${result.sessions}`,
  )
  if (result.skipped.length)
    console.log(`skipped (missing or reviewed): ${result.skipped.join(', ')}`)
  await payload.destroy()
  process.exit(0)
}

main()
