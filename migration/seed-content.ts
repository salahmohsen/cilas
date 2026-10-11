/**
 * Stage 4 for publishing content: upsert seed/data/archive's articles,
 * publications, press, events and newsletters into the database as drafts
 * marked "needs review". Reviewed documents are never touched.
 *
 *   npx tsx --env-file=.env migration/seed-content.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { importContent } from './lib/import-content'

const dir = path.join(import.meta.dirname, '..', 'seed', 'data', 'archive')
const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))

const main = async () => {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const result = await importContent(payload, {
    articles: read('articles.json'),
    publications: read('publications.json'),
    press: read('press.json'),
    events: read('events.json'),
    newsletters: read('newsletters.json'),
    images: read('images.json'),
    imagesDir: dir,
  })
  for (const [name, t] of Object.entries(result)) {
    console.log(`${name.padEnd(13)} created ${t.created}, updated ${t.updated}, skipped (reviewed) ${t.skipped}`)
  }
  await payload.destroy()
  process.exit(0)
}

main()
