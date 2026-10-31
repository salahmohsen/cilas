/**
 * One-off: apply-reviews.ts wrote each new course (extracted/new-courses)
 * into another course, because its new id went through review-index.json.
 * For each one, restores the overwritten course from its last version before
 * that write, then writes the new course's own fields and cover. Meta is
 * cleared on both, for fill-seo.ts to fill again.
 *
 *   npx tsx --env-file=.env migration/tools/fix-bicycle-swap.ts [--dry]
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { lexical } from '../../seed/seed.utils'
import { mediaFor } from '../lib/import-media'

const dry = process.argv.includes('--dry')
const here = import.meta.dirname
const raw = path.join(here, '..', 'raw')
const index = JSON.parse(
  readFileSync(path.join(here, '..', 'extracted', 'corrections', 'review-index.json'), 'utf8'),
).courses as Record<string, string>
const dir = path.join(here, '..', 'extracted', 'new-courses')

type Locale = 'en' | 'ar'
type Doc = Record<string, any>
const LOCALES: Locale[] = ['en', 'ar']
const LOCALIZED = [
  'subtitle',
  'summary',
  'epigraph',
  'facilitator_note',
  'content_warning',
  'language_note',
] as const
const RESTORE = [
  'title',
  'description',
  ...LOCALIZED,
  'course_type',
  'teaching_languages',
  'location',
  'schedule',
  'cover_image',
] as const
const emptyMeta = { title: null, description: null, image: null }
const paragraphs = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
const rich = (t: string | null | undefined, locale: Locale) =>
  t && paragraphs(t).length ? lexical(paragraphs(t), locale === 'ar' ? 'rtl' : 'ltr') : null

/** Covers the page shows that the archive path rules resolve to another file. */
const COVER_FIX: Record<string, { upload: string; file: string; alt: string }> = {
  '/winter-2023-2024.html#historical-perspectives-on-medicine-in-the-modern-middle-east-course': {
    upload: 'uploads/1/9/1/0/19102967/published/image1__q_a8ae8ab941.jpg',
    file: path.join(raw, 'mirror', 'uploads/1/9/1/0/19102967/published/image1__q_a8ae8ab941.jpg'),
    alt: 'Citadel Hospital, Cairo, 1915',
  },
}

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const byUrl = async (url: string) =>
  (
    await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: url } },
      limit: 1,
      depth: 0,
      draft: true,
      locale: 'all',
      overrideAccess: true,
    })
  ).docs[0] as unknown as Doc
const publish = (id: number) =>
  payload.update({
    collection: 'courses',
    id,
    data: { _status: 'published' },
    overrideAccess: true,
  })

for (const f of readdirSync(dir)
  .filter((x) => x.endsWith('.json'))
  .sort()) {
  const src = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
  const fresh = await byUrl(src.legacy_url)
  const victimUrl = index[String(fresh.id)]
  const victim = victimUrl ? await byUrl(victimUrl) : null
  if (!victim || victim.title?.en !== src.set.title.en) {
    console.log(`${f}: course ${fresh.id} -> ${victimUrl ?? 'nothing'}, not overwritten; skipped`)
    continue
  }

  // The overwritten course: its last version before the new course's title.
  const versions = (
    await payload.findVersions({
      collection: 'courses',
      where: { parent: { equals: victim.id } },
      sort: 'updatedAt',
      limit: 200,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
    })
  ).docs
  const bad = versions.findIndex((v) => (v.version as Doc).title?.en === src.set.title.en)
  const good = bad > 0 ? (versions[bad - 1].version as unknown as Doc) : null
  if (!good) throw new Error(`${f}: no version of ${victim.id} before the overwrite`)
  const changed = RESTORE.filter((k) => JSON.stringify(good[k]) !== JSON.stringify(victim[k]))
  console.log(
    `${f}: course ${victim.id} (${good.title.en}) restored from version ${versions[bad - 1].id}: ${changed.join(', ')}`,
  )
  const coverFix = COVER_FIX[victimUrl]
  if (coverFix) console.log(`  cover replaced with ${coverFix.upload}`)

  if (!dry) {
    const cover = coverFix
      ? (await mediaFor(payload, { path: coverFix.upload, file: coverFix.file, alt: coverFix.alt }))
          .id
      : (good.cover_image ?? null)
    for (const locale of LOCALES) {
      const { note, ...pattern } = good.schedule ?? {}
      await payload.update({
        collection: 'courses',
        id: victim.id,
        locale,
        draft: true,
        overrideAccess: true,
        data: {
          title: good.title?.[locale] ?? null,
          description: good.description?.[locale] ?? null,
          ...Object.fromEntries(LOCALIZED.map((k) => [k, good[k]?.[locale] ?? null])),
          schedule: {
            ...(locale === 'en'
              ? { ...pattern, slots: (pattern.slots ?? []).map(({ id: _, ...s }: Doc) => s) }
              : {}),
            note: note?.[locale] ?? null,
          },
          ...(locale === 'en'
            ? {
                course_type: good.course_type,
                teaching_languages: good.teaching_languages ?? [],
                location: good.location ?? [],
                cover_image: cover,
              }
            : {}),
          meta: emptyMeta,
        } as any,
      })
    }
    await publish(victim.id)
  }

  // The new course: its own fields, as apply-reviews.ts would have written them.
  const set = src.set
  console.log(
    `  course ${fresh.id} (${set.title.en}): ${Object.keys(set).join(', ')}${src.cover ? ', cover' : ''}`,
  )
  if (!dry) {
    const cover = src.cover
      ? (
          await mediaFor(payload, {
            path: src.cover.upload,
            file: path.join(raw, 'weebly-zip-2025-04-23', src.cover.upload),
            alt: src.cover.alt,
          })
        ).id
      : null
    for (const locale of LOCALES) {
      const { note, ...pattern } = set.schedule ?? {}
      await payload.update({
        collection: 'courses',
        id: fresh.id,
        locale,
        draft: true,
        overrideAccess: true,
        data: {
          ...(locale === 'en' || set.title.ar ? { title: set.title[locale] ?? set.title.en } : {}),
          ...(set.description ? { description: rich(set.description[locale], locale) } : {}),
          ...Object.fromEntries(
            LOCALIZED.filter((k) => set[k]).map((k) => [k, set[k][locale] ?? null]),
          ),
          schedule: {
            ...(locale === 'en' ? pattern : {}),
            ...(note ? { note: note[locale] } : {}),
          },
          ...(locale === 'en'
            ? {
                course_type: set.course_type,
                ...(set.teaching_languages ? { teaching_languages: set.teaching_languages } : {}),
                ...(set.location ? { location: set.location } : {}),
                ...(cover ? { cover_image: cover } : {}),
              }
            : {}),
          meta: emptyMeta,
        } as any,
      })
    }
    await publish(fresh.id)
  }
}

// The bicycle course page also holds a registration link and the fellow's bio.
const bicycle = await byUrl('/alexandrian-bicycle-diaries.html')
console.log(`bicycle ${bicycle.id}: registration link and fellow bio`)
if (!dry) {
  await payload.update({
    collection: 'courses',
    id: bicycle.id,
    draft: true,
    overrideAccess: true,
    data: {
      registration: { archived_registration_url: 'https://forms.gle/dzkPJYmGNJXME7zc7' },
    } as any,
  })
  await publish(bicycle.id)
  const bio =
    'مبادرة تبديل هي مجموعة من مخططين ومصممين ومتخصصين في علوم الاجتماع والعلوم الحضرية جمعهم شغفهم بالدراجة وحماسهم لها كوسيلة تنقل نظيفة وتجمعوا لمساعدة المدن المصرية لإدراج الدراجة من ضمن خطط التصميم العمراني ودعم ثقافة الدراجات على المستوى المحلى. قامت المجموعة حتى الآن بتنظيم ورش عمل تتناول ثقافة الدراجات في بورسعيد وأسيوط مع التركيز على المشكلات الإجتماعية المحلية مثل العوائق الإجتماعية أمام السيدات لتبني وسيلة التنقل هذه أو عوائق الأمان المروري ومشكلات الحوكمة المتعلقة بالموضوع. وقامت أيضاً بتقديم مقترحات تصميمية أو مناقشات عن البنية التحتية في القاهرة والإسكندرية وإستخدام وسائل تصميمية حديثة لتقديم الأفكار المقترحة للرأي العام وصناع القرار'
  for (const fellow of bicycle.fellows as number[]) {
    const person = (await payload.findByID({
      collection: 'people',
      id: fellow,
      depth: 0,
      locale: 'all',
      overrideAccess: true,
    })) as unknown as Doc
    if (person.name?.en !== 'مبادرة تبديل' || person.bio?.ar) continue
    await payload.update({
      collection: 'people',
      id: fellow,
      locale: 'ar',
      data: { name: person.name.en, bio: lexical([bio], 'rtl') } as any,
      overrideAccess: true,
    })
  }
}

await payload.destroy()
process.exit(0)
