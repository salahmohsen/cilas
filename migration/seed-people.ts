/**
 * Stage 4 for people: re-normalise the courses with the current aliases,
 * re-import them so their fellows point at canonical people, import people,
 * programmes, memberships and governance, then prune the people nothing
 * references any more.
 *
 *   npx tsx --env-file=.env migration/seed-people.ts
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { importCourses } from './lib/import-courses'
import { importPeople, prunePeople } from './lib/import-people'
import { applyArabicNames } from './lib/names-ar'

const root = path.join(import.meta.dirname, '..')
const dir = path.join(root, 'seed', 'data', 'archive')
const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))

const main = async () => {
  // courses.json must carry the canonical names from aliases.json.
  execFileSync('npx', ['tsx', 'migration/normalise-courses.ts'], { cwd: root, stdio: 'inherit' })

  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })

  const courses = await importCourses(payload, { cycles: read('cycles.json'), courses: read('courses.json') })
  console.log(`courses: cycles ${courses.cycles}, courses ${courses.courses}, new people ${courses.people}`)
  if (courses.skipped.length) console.log(`skipped (no cycle): ${courses.skipped.join(', ')}`)

  const people = await importPeople(payload, {
    people: read('people.json'),
    programmes: read('programmes.json'),
    memberships: read('memberships.json'),
    governance: read('governance.json'),
  })
  console.log(
    `created: people ${people.people}, programmes ${people.programmes}, memberships ${people.memberships}, governance ${people.governance}`,
  )

  const pruned = await prunePeople(payload)
  console.log(`pruned ${pruned.length} people${pruned.length ? `: ${pruned.join(', ')}` : ''}`)

  console.log(`Arabic names given: ${await applyArabicNames(payload)}`)
  await payload.destroy()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
