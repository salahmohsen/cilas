/**
 * Mechanical clean-up after the course reviews (plan 6.7), over every
 * unreviewed imported course:
 *   - a start date from "the week of …" moves to the first day the course
 *     actually meets (its slots' weekday, within that week);
 *   - course bibliography rows that are a file name ("…_flow.pdf") or the
 *     cover's credit ("Course image …") go;
 *   - a schedule note or slot label holding extractor JSON (`{"en":null…}`) is cleared.
 *
 *   npx tsx --env-file=.env migration/tools/tidy-courses.ts [--dry]
 */
import { getPayload } from 'payload'

const dry = process.argv.includes('--dry')
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const JUNK_TITLE = /\.(pdf|docx?)$|^course image\b|^cover (image|art)/i
const isJson = (s: unknown) => typeof s === 'string' && /^\s*[{[]/.test(s)

type Loc = { en?: string | null; ar?: string | null }
type Course = {
  id: number
  legacy_url?: string | null
  schedule?: {
    start_date?: string | null
    slots?: Array<{ id?: string; weekday: string; label?: Loc | null }> | null
    note?: Loc | null
  } | null
  bibliography?: Array<{ id?: string; title?: Loc | null }> | null
}

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const { docs } = await payload.find({ collection: 'courses', limit: 1000, pagination: false, depth: 0, draft: true, locale: 'all', overrideAccess: true })

let changed = 0
for (const c of docs as unknown as Course[]) {
  if (!c.legacy_url) continue
  const log: string[] = []
  const en: Record<string, unknown> = {}
  const ar: Record<string, unknown> = {}
  const schedule = c.schedule ?? {}

  const weekdays = new Set((schedule.slots ?? []).map((s) => s.weekday))
  if (schedule.start_date && weekdays.size) {
    const d = new Date(schedule.start_date)
    if (!weekdays.has(DAYS[d.getUTCDay()])) {
      for (let i = 1; i < 7; i++) {
        const next = new Date(d.getTime() + i * 86_400_000)
        if (weekdays.has(DAYS[next.getUTCDay()])) {
          log.push(`start ${schedule.start_date.slice(0, 10)} → ${next.toISOString().slice(0, 10)} (first ${DAYS[next.getUTCDay()]})`)
          en.schedule = { ...(en.schedule as object), start_date: next.toISOString().slice(0, 10) }
          break
        }
      }
    }
  }

  for (const locale of ['en', 'ar'] as const) {
    const target = locale === 'en' ? en : ar
    if (isJson(schedule.note?.[locale])) {
      target.schedule = { ...(target.schedule as object), note: null }
      log.push(`schedule.note.${locale} was JSON`)
    }
    const slots = schedule.slots ?? []
    if (slots.some((s) => isJson(s.label?.[locale]))) {
      target.schedule = {
        ...(target.schedule as object),
        slots: slots.map((s) => ({ ...s, label: isJson(s.label?.[locale]) ? null : (s.label?.[locale] ?? null) })),
      }
      log.push(`slot labels.${locale} were JSON`)
    }
  }

  const bib = c.bibliography ?? []
  const keep = bib.filter((b) => !Object.values(b.title ?? {}).some((t) => t && JUNK_TITLE.test(t.trim())))
  if (keep.length < bib.length) {
    log.push(`bibliography: dropped ${bib.length - keep.length} file-name/credit row(s)`)
    en.bibliography = keep.map((b) => ({ ...b, title: b.title?.en ?? null }))
  }

  if (!log.length) continue
  changed++
  console.log(`${c.id} ${c.legacy_url}: ${log.join('; ')}`)
  if (dry) continue
  for (const [locale, data] of [['en', en], ['ar', ar]] as const) {
    if (!Object.keys(data).length) continue
    if (data.schedule) {
      const fresh = (await payload.findByID({ collection: 'courses', id: c.id, depth: 0, draft: true, locale, fallbackLocale: false, overrideAccess: true })) as unknown as Course
      data.schedule = { ...(fresh.schedule ?? {}), ...(data.schedule as object) }
    }
    await payload.update({ collection: 'courses', id: c.id, data, locale, draft: true, overrideAccess: true })
  }
  await payload.update({ collection: 'courses', id: c.id, data: { _status: 'published' }, overrideAccess: true })
}
console.log(`${changed} course(s)${dry ? ' (dry run)' : ''}`)
await payload.destroy()
process.exit(0)
