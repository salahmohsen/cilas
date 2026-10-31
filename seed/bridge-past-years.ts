import path from 'path'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import { getOrCreateId } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the past Bridge years the archive documents, made ready and
 * published. Each has a cohort page on the old site (CILASians 2013–2014 to
 * 2017–2018, CILAS in Alex 2018–2019 and 2019–2020); its people and courses
 * were imported from there and from the trimester pages. This adds what the
 * page needs and the import left out: the Arabic title, and the year's group
 * photo from its cohort page where it has one. The old site has no text of
 * its own for any single year, so no overview is written.
 *
 * 2020–2021, 2023–2024 and 2024–2025 stay drafts: no source shows a Bridge
 * year then, only open course cycles.
 *
 *   npx tsx seed/bridge-past-years.ts
 */

const UPLOADS = path.resolve(
  import.meta.dirname,
  '../migration/raw/weebly-zip-2025-04-23/uploads/1/9/1/0/19102967',
)

const SEASONS_AR: Record<string, string> = {
  Fall: 'الخريف',
  Winter: 'الشتاء',
  Spring: 'الربيع',
  Summer: 'الصيف',
}

const toArabicDigits = (s: string) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!)

const years: Array<{ year: string; alexandria?: boolean; photo?: { file: string; alt: string } }> =
  [
    { year: '2013-2014' },
    {
      year: '2014-2015',
      photo: {
        file: '11391153-973297076023464-6906753512235503569-n_orig.jpg',
        alt: 'The year-long students of 2014–2015 at their graduation, holding their certificates, the Nile behind them',
      },
    },
    {
      year: '2015-2016',
      photo: {
        file: '13754289-1200353016651201-7309911177955534658-n_orig.jpg',
        alt: 'The year-long students and fellows of 2015–2016 at their graduation, holding their certificates',
      },
    },
    {
      year: '2016-2017',
      photo: {
        file: '19399714-1530861923600307-9000652804757996412-n_orig.jpg',
        alt: 'The year-long students and fellows of 2016–2017 at their graduation on a boat on the Nile',
      },
    },
    {
      year: '2017-2018',
      photo: {
        file: 'dsc-0630_orig.jpg',
        alt: 'The year-long students and fellows of 2017–2018 at their graduation on a boat on the Nile',
      },
    },
    {
      year: '2018-2019',
      alexandria: true,
      photo: {
        file: '48362266-10157016434458921-3961457381749030912-o_orig.jpg',
        alt: 'The year-long students of CILAS in Alex 2018–2019 at their Secret Santa ceremony',
      },
    },
    { year: '2019-2020', alexandria: true },
  ]

for (const { year, alexandria, photo } of years) {
  const slug = `bridge-programme-${year}${alexandria ? '-alexandria' : ''}`
  const { docs } = await payload.find({
    collection: 'programmes',
    where: { slug: { equals: slug } },
    draft: true,
    limit: 1,
    depth: 0,
    locale: 'en',
    overrideAccess: true,
  })
  const programme = docs[0]
  if (!programme) throw new Error(`No programme ${slug}`)

  const cover = photo
    ? await getOrCreateId(payload, 'media', { alt: { equals: photo.alt } }, () =>
        payload.create({
          collection: 'media',
          data: { alt: photo.alt },
          filePath: `${UPLOADS}/${photo.file}`,
          overrideAccess: true,
        }),
      )
    : null

  const dashed = year.replace('-', '–')
  await payload.update({
    collection: 'programmes',
    id: programme.id,
    locale: 'en',
    overrideAccess: true,
    data: {
      title: `Bridge Programme ${dashed}${alexandria ? ' (Alexandria)' : ''}`,
      ...(cover ? { cover } : {}),
      // The import's placeholder for years without a cohort page; these have one.
      schedule_note: null,
      _status: 'published',
    },
  })
  // Each part's label in Arabic, worded as the current year's: «المقررات الأساسية، فصل الخريف».
  const components = (programme.components ?? []).map((c) => {
    const season = Object.entries(SEASONS_AR).find(([en]) => c.label.includes(en))?.[1]
    const kind = c.course_types?.includes('CORE')
      ? 'المقررات الأساسية'
      : 'المقررات الموضوعية والمختبرات'
    if (!season) throw new Error(`No season in "${c.label}"`)
    return { ...c, label: `${kind}، فصل ${season}` }
  })
  await payload.update({
    collection: 'programmes',
    id: programme.id,
    locale: 'ar',
    overrideAccess: true,
    data: {
      title: `برنامج الجسر ${toArabicDigits(dashed)}${alexandria ? ' (الإسكندرية)' : ''}`,
      components,
      schedule_note: null,
      _status: 'published',
    },
  })
  console.log(`published ${slug}${cover ? ' with its photo' : ''}`)
}

process.exit(0)
