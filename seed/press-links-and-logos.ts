import path from 'path'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import { getOrCreateId } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the press links that moved, and the outlets' logos.
 *
 * Links checked in October 2026. Mada Masr and Al-Fanar sit behind a
 * browser check, so they answer scripts with 403, but the articles are
 * there. Three stay as they are, with no working copy found: the
 * Goethe-Institut magazine page (403), the Sciences Po news item (404) and
 * because.bz (the site is down; the link takes its last known address).
 * The مشاهد القاهرة article was a PDF on the old site; it is now in Media.
 *
 * Logos for Mada Masr, openDemocracy and Mashallah News are their own
 * marks (from Wikimedia Commons and the outlets' sites), rendered to PNG,
 * since Media turns uploads into WebP.
 *
 *   npx tsx seed/press-links-and-logos.ts
 */

const ASSETS = path.resolve(import.meta.dirname, 'assets/press')
const UPLOADS = path.resolve(
  import.meta.dirname,
  '../migration/raw/weebly-zip-2025-04-23/uploads/1/9/1/0/19102967',
)

const MOVED: Record<string, string> = {
  'http://madamasr.com/content/looking-alternative-education-egypt':
    'https://www.madamasr.com/en/2014/02/02/opinion/society/looking-for-alternative-education-in-egypt/',
  'https://www.opendemocracy.net/north-africa-west-asia/mona-abaza-karim-yassin-goessinger/sitting-on-top-of-egyptian-civilisation':
    'https://www.opendemocracy.net/en/sitting-on-top-of-egyptian-civilisation/',
  'https://www.opendemocracy.net/en/north-africa-west-asia/mona-abaza-karim-yassin-goessinger/sitting-on-top-of-egyptian-civilisation/':
    'https://www.opendemocracy.net/en/sitting-on-top-of-egyptian-civilisation/',
  'http://egyptianstreets.com/2015/02/24/liberal-arts-and-sciences-institute-turns-to-crowdfunding-after-egyptian-government-blocks-funding/':
    'https://egyptianstreets.com/2015/02/24/liberal-arts-and-sciences-institute-turns-to-crowdfunding-after-egyptian-government-blocks-funding/',
  'http://www.al-fanarmedia.org/2013/08/new-institute-to-offer-one-year-dose-of-the-liberal-arts/':
    'https://www.al-fanarmedia.org/2013/08/new-institute-to-offer-one-year-dose-of-the-liberal-arts/',
  'https://www.mashallahnews.com/learning-on-wings/':
    'https://mashallahnews.com/learning-on-wings/',
  'http://because.bz/gamechangers/unconventional-education-in-the-heart-of-one-of-cairos-oldest-attractions/':
    'http://because.bz/education/unconventional-education-heart-one-cairo-oldest-attractions',
}

const OLD_PDF =
  'https://www.ci-las.org/uploads/1/9/1/0/19102967/%D9%85%D9%82%D8%A7%D9%84_%D9%81%D8%B1%D9%8A%D8%AF%D8%A9_%D9%85%D9%82%D8%A7%D8%B1.pdf'

const upload = (alt: string, filePath: string) =>
  getOrCreateId(payload, 'media', { alt: { equals: alt } }, () =>
    payload.create({ collection: 'media', data: { alt }, filePath, overrideAccess: true }),
  )

// The PDF, kept in Media now that the old site no longer serves it.
const pdfId = await upload(
  'Farida Makar’s article on CILAS, مشاهد القاهرة',
  `${UPLOADS}/مقال_فريدة_مقار.pdf`,
)
const pdf = await payload.findByID({ collection: 'media', id: pdfId, depth: 0 })
if (pdf.url) MOVED[OLD_PDF] = pdf.url

const { docs: pieces } = await payload.find({
  collection: 'press',
  limit: 0,
  depth: 0,
  overrideAccess: true,
})
for (const piece of pieces) {
  const links = piece.links ?? []
  if (!links.some((l) => l.url && MOVED[l.url])) continue
  await payload.update({
    collection: 'press',
    id: piece.id,
    overrideAccess: true,
    data: { links: links.map((l) => (l.url && MOVED[l.url] ? { ...l, url: MOVED[l.url] } : l)) },
  })
  console.log(`links updated: ${piece.title}`)
}

const logos: Array<{ outlet: string; file: string; alt: string }> = [
  { outlet: 'Mada Masr', file: 'madamasr.png', alt: 'Mada Masr logo' },
  { outlet: 'OpenDemocracy', file: 'opendemocracy.png', alt: 'openDemocracy logo' },
  { outlet: 'Mashallah News', file: 'mashallah.png', alt: 'Mashallah News logo' },
]
for (const { outlet, file, alt } of logos) {
  const { docs } = await payload.find({
    collection: 'partners',
    where: { name: { equals: outlet } },
    limit: 1,
    depth: 0,
    locale: 'en',
    overrideAccess: true,
  })
  const partner = docs[0]
  if (!partner) throw new Error(`No outlet ${outlet}`)
  const logo = await upload(alt, `${ASSETS}/${file}`)
  await payload.update({
    collection: 'partners',
    id: partner.id,
    overrideAccess: true,
    data: { logo },
  })
  console.log(`logo set: ${outlet}`)
}

process.exit(0)
