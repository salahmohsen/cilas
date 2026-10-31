/** Validates new-course answers: npx tsx migration/tools/check-new-course.ts <file.json>... */
import { readFileSync } from 'node:fs'
import { NewCourse } from '../lib/review-schema'

let bad = 0
for (const file of process.argv.slice(2)) {
  const r = NewCourse.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  if (r.success) console.log(`OK ${file}`)
  else {
    bad++
    console.log(
      `INVALID ${file}\n${r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    )
  }
}
process.exit(bad ? 1 : 0)
