/**
 * Stage 3 for the people pages: migration/extracted/people/*.json →
 * seed/data/archive/{people,programmes,memberships,governance}.json, and the
 * "Flagged" section of migration/review/people.md.
 *
 *   npx tsx migration/normalise-people.ts
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { slugify } from '../src/lib/slugify'
import { canonicalName } from './lib/normalise-courses'
import { UNVERIFIED_YEARS, completeBio, membershipRole, programmeTitle } from './lib/normalise-people'
import { PeoplePage } from './lib/people-schema'

const here = import.meta.dirname
const root = path.join(here, '..')
const aliases = JSON.parse(readFileSync(path.join(here, 'aliases.json'), 'utf8')) as Record<string, string[]>
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: Array<{ file: string; legacy_url: string }>
}
const urlOf = new Map(pages.map((p) => [p.file, p.legacy_url]))

type Person = { name: string; name_ar: string | null; bio: string; email: string | null; photo: string | null; legacy_url: string }
type Programme = { title: string; year: string; place: 'cairo' | 'alexandria'; verified: boolean; legacy_url: string | null }
type Membership = { person: string; programme: string; role: string; title: string | null; legacy_url: string }
type Governance = {
  person: string
  role: 'advisor' | 'trustee'
  title: string | null
  advises_on: string | null
  board_role: string | null
  order: number
  legacy_url: string
}

const people = new Map<string, Person>()
const programmes = new Map<string, Programme>()
const memberships = new Map<string, Membership>()
const governance: Governance[] = []
const flagged: string[] = []

const dir = path.join(here, 'extracted', 'people')
const parsed = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const file = f.replace(/\.json$/, '')
    const data = PeoplePage.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8')).data)
    return { file, pageUrl: urlOf.get(file) ?? `/${file}`, data }
  })
  // Cohorts in year order, then the board pages: so "first page" is the earliest.
  .sort((a, b) => (a.data.year ?? '9999').localeCompare(b.data.year ?? '9999') || a.file.localeCompare(b.file))

for (const { pageUrl, data } of parsed) {
  const programme =
    data.year && data.place
      ? { title: programmeTitle(data.year, data.place), year: data.year.replace('-', '–'), place: data.place }
      : null
  if (programme && data.year && data.place) {
    programmes.set(programme.title, { ...programme, place: data.place, verified: true, legacy_url: pageUrl })
  }

  data.people.forEach((p, index) => {
    const name = canonicalName(p.name, aliases)
    const slug = slugify(name)
    const bio = completeBio(name, p.bio.trim())
    const existing = people.get(name)
    if (!existing) {
      people.set(name, { name, name_ar: p.name_ar, bio, email: p.email, photo: p.photo, legacy_url: `${pageUrl}#${slug}` })
    } else {
      if (bio.length > existing.bio.length) existing.bio = bio
      existing.name_ar ??= p.name_ar
      existing.email ??= p.email
      existing.photo ??= p.photo
    }

    if (p.group === 'advisor' || p.group === 'trustee') {
      governance.push({
        person: name,
        role: p.group,
        title: p.title,
        advises_on: p.advises_on,
        board_role: p.board_role,
        order: index + 1,
        legacy_url: `${pageUrl}#${slug}`,
      })
      return
    }

    const mapped = membershipRole(p.group)
    if (!mapped || !programme) {
      flagged.push(`- ${pageUrl}: ${name} is listed under "${p.group}"${p.title ? ` (${p.title})` : ''}; no membership was created`)
      return
    }
    if (mapped.flagged) {
      flagged.push(`- ${pageUrl}: ${name} is under a plain "Fellows" section; set to ${mapped.role}, check it`)
    }
    const key = `${name}|${programme.title}|${mapped.role}`
    if (!memberships.has(key)) {
      memberships.set(key, { person: name, programme: programme.title, role: mapped.role, title: p.title, legacy_url: `${pageUrl}#${slug}` })
    }
  })
}

for (const year of UNVERIFIED_YEARS) {
  const title = programmeTitle(year, 'cairo')
  programmes.set(title, { title, year: year.replace('-', '–'), place: 'cairo', verified: false, legacy_url: null })
}

const outDir = path.join(root, 'seed', 'data', 'archive')
mkdirSync(outDir, { recursive: true })
const write = (name: string, rows: unknown[]) => writeFileSync(path.join(outDir, name), `${JSON.stringify(rows, null, 2)}\n`)
const by = <T>(xs: T[], key: (x: T) => string) => xs.sort((a, b) => key(a).localeCompare(key(b)))
write('people.json', by([...people.values()], (p) => p.name))
write('programmes.json', by([...programmes.values()], (p) => `${p.year}${p.place}`))
write('memberships.json', by([...memberships.values()], (m) => `${m.programme}|${m.person}|${m.role}`))
write('governance.json', governance)

// Replace the "## Flagged" section if present, else append it; leave the rest
// (the "Not merged" list from the name-merge step) alone.
mkdirSync(path.join(here, 'review'), { recursive: true })
const reviewFile = path.join(here, 'review', 'people.md')
const section = `## Flagged\n\nGenerated by \`normalise-people.ts\`.\n\n${flagged.sort().join('\n')}\n`
const existing = existsSync(reviewFile) ? readFileSync(reviewFile, 'utf8') : '# People: to check\n\n'
const at = existing.indexOf('## Flagged')
const next = at === -1 ? -1 : existing.indexOf('\n## ', at + 1)
const out =
  at === -1
    ? `${existing.trimEnd()}\n\n${section}`
    : `${existing.slice(0, at)}${section}${next === -1 ? '' : `\n${existing.slice(next + 1)}`}`
writeFileSync(reviewFile, out)
console.log(`${people.size} people, ${programmes.size} programmes, ${memberships.size} memberships, ${governance.length} governance, ${flagged.length} flagged`)
