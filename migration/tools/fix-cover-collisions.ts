/**
 * One-off: Weebly kept one file per upload name, so a page that uploaded
 * `image1.jpg` replaced every earlier `image1.jpg` (and `editor/` uploads
 * were resolved to the `published/` file of the same name). The ZIP and the
 * mirror hold only the last image, which the import gave to every course
 * that used the name.
 *
 * Each course below was checked against the Wayback capture of its own page
 * (the image link with its upload timestamp). `recover`: the capture from the
 * course's time, saved in raw/wayback/covers/. `keep`: the course owns the
 * stored file; only its alt text changes. `clear`: no capture from before the
 * file was replaced, so the wrong cover is removed.
 *
 *   npx tsx --env-file=.env migration/tools/fix-cover-collisions.ts [--dry]
 */
import path from 'node:path'
import { getPayload } from 'payload'

import { mediaFor } from '../lib/import-media'

const dry = process.argv.includes('--dry')
const covers = path.join(import.meta.dirname, '..', 'raw', 'wayback', 'covers')
const U = 'uploads/1/9/1/0/19102967/'

type Fix =
  | { action: 'recover'; course: string; file: string; upload: string; alt: string }
  | { action: 'keep'; course: string; alt: string }
  | { action: 'clear'; course: string }

const FIXES: Fix[] = [
  // image1.jpg
  { action: 'recover', course: '/winter-2023-2024.html#historical-perspectives-on-medicine-in-the-modern-middle-east-course', file: '277.jpg', upload: `${U}published/image1.jpg?1702750773`, alt: 'Citadel Hospital, Cairo, 1915: a hospital ward with rows of beds under a carved arch' },
  { action: 'recover', course: '/winter-2020.html#introduction-to-the-anthropology-of-the-magical-mystical-and-unseen', file: '269.jpg', upload: `${U}editor/image1.jpg?1608141011`, alt: 'Illustration of a woman tied to a stake above flames' },
  { action: 'recover', course: '/spring-cycle-20221.html#approaching-performativity-and-culture-in-modern-egypt', file: '152.jpg', upload: `${U}image1_orig.jpg?2022-05`, alt: 'Painting of a row of Egyptian women and men in traditional dress' },
  { action: 'keep', course: '/spring-labs-2023.html#translation-lab', alt: 'Detail of Michelangelo’s Creation of Adam: two hands reaching toward each other' },
  { action: 'keep', course: '/fall-cycle-2025.html#writing-capitalism', alt: 'An older man stands beside a blue car lying on its side in a street' },
  { action: 'clear', course: '/spring-semester-2022.html#contesting-the-visual-visible-the-image-as-critical-and-creative-method' },
  // image1.png
  { action: 'recover', course: '/spring-cycle-2024-2025.html#writing-lab', file: '168.png', upload: `${U}published/image1.png?1733939336`, alt: 'A vintage typewriter with a colourful marbled sheet in its roller' },
  { action: 'recover', course: '/spring-semester-2026.html#reclaiming-the-ancient-poetry-memory-and-living-traditions', file: '219.png', upload: `${U}image1_orig.png?2026`, alt: 'An ancient Egyptian relief beside a painting of a seated Buddha' },
  { action: 'keep', course: '/fall-cycle-2024.html#story-as-participative-enquiry', alt: 'Colourful shelves and doorways filled with books and objects' },
  { action: 'clear', course: '/winter-cycle-2024-2025.html#oppressed-voices-an-introduction-to-subaltern-studies-and-hidden-histories' },
  // course-image.png
  { action: 'recover', course: '/spring-semester-2026.html#global-esotericism-spirits-cults-and-a-history-of-magic', file: '215.png', upload: `${U}course-image_orig.png?2026`, alt: 'Cartoon of Shaggy from Scooby-Doo: “Hold on, man. We don’t go anywhere with ‘scary’, ‘spooky’, ‘haunted’ or ‘forbidden’ in the title”' },
  { action: 'keep', course: '/winter-2023-2024.html#film-theory-workshop', alt: 'Four black-and-white film stills' },
  // image1-1.jpg
  { action: 'recover', course: '/winter-2020.html#for-lack-of-a-better-word-interrogating-the-literal', file: '268.jpg', upload: `${U}published/image1-1.jpg?1608146594`, alt: 'Drawing of many small colourful heads' },
  { action: 'keep', course: '/spring-cycle-2024.html#us-and-them-social-psychology-and-psychoanalysis-in-conversation', alt: 'Protesters face a line of riot police in a field' },
  { action: 'clear', course: '/2023-cilas-cairo-hybrid-spring-semester.html#meaningful-conversations-with-the-prophets' },
  // image2 (editor/image2.png is another file than image2.jpg)
  { action: 'recover', course: '/winter-2020.html#discovering-biomimicry', file: '267.png', upload: `${U}editor/image2.png?1608146072`, alt: 'People sitting in dry grass above a waterfall' },
  // photo-from-sohair.jpg
  { action: 'keep', course: '/spring-semester-2025.html#confronting-modernity-art-politics-religion-and-science', alt: 'Collage of famous paintings: the Mona Lisa, The Scream and Girl with a Pearl Earring under The Starry Night' },
  { action: 'clear', course: '/fall-cycle-2024.html#ecology-between-east-and-west-philosophical-and-theological-dialogues-on-environmental-and-animal-ethics' },
  // image001.jpg
  { action: 'keep', course: '/spring-cycle-20221.html#towards-a-history-of-islamicate-print', alt: 'A page of an old Arabic printed book inside a decorated border' },
  { action: 'clear', course: '/spring-semester-2022.html#feminist-phenomenology-the-body-and-the-world' },
  { action: 'clear', course: '/fall-20211.html#healing-rituals-and-spirituality-an-introduction-to-the-anthropology-of-religion' },
  // 222186259.jpg
  { action: 'keep', course: '/fall-cycle-2024.html#enlightenment-to-the-death-of-god-a-philosophical-journey', alt: 'Detail of Michelangelo’s Creation of Adam: two hands reaching toward each other' },
  { action: 'clear', course: '/82032024-cilas-cairo-spring-semester8203.html#unveiling-heidegger-exploring-truth-art-technology-and-metaphysics' },
  // 1.jpg (editor/1.jpg is the fall 2020 upload)
  { action: 'recover', course: '/fall-2020.html#race-and-shakespeare', file: '59.jpg', upload: `${U}editor/1.jpg?1599851916`, alt: 'A man in glasses beside theatre posters and a Shakespeare figure' },
  { action: 'keep', course: '/fall-cycle-2024.html#a-journey-to-the-east', alt: 'A stone face of the Buddha' },
]

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })

for (const fix of FIXES) {
  const course = (await payload.find({ collection: 'courses', where: { legacy_url: { equals: fix.course } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0]
  if (!course) throw new Error(`no course ${fix.course}`)
  const cover = typeof course.cover_image === 'object' ? course.cover_image?.id : course.cover_image
  console.log(`${course.id} ${fix.action} (cover ${cover ?? 'none'}) ${fix.course}`)
  if (dry) continue
  if (fix.action === 'keep') {
    if (cover) await payload.update({ collection: 'media', id: cover, data: { alt: fix.alt }, overrideAccess: true })
    continue
  }
  const media = fix.action === 'recover' ? await mediaFor(payload, { path: fix.upload, file: path.join(covers, fix.file), alt: fix.alt }) : null
  await payload.update({ collection: 'courses', id: course.id, data: { cover_image: media?.id ?? null }, draft: true, overrideAccess: true })
  // The OG image was the old cover; fill-seo.ts sets it again.
  for (const locale of ['en', 'ar'] as const) {
    const doc = await payload.findByID({ collection: 'courses', id: course.id, depth: 0, draft: true, locale, fallbackLocale: false, overrideAccess: true })
    const meta = (doc.meta ?? {}) as Record<string, unknown>
    await payload.update({ collection: 'courses', id: course.id, locale, data: { meta: { ...meta, image: null } }, draft: true, overrideAccess: true })
  }
  await payload.update({ collection: 'courses', id: course.id, data: { _status: 'published' }, overrideAccess: true })
}

// The medicine course's only bibliography entry was its cover's caption, not a reading.
const medicine = (await payload.find({ collection: 'courses', where: { legacy_url: { equals: FIXES[0].course } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0]
const bib = (medicine.bibliography ?? []) as { title?: string | null }[]
console.log(`${medicine.id} bibliography: ${bib.map((b) => b.title).join(' | ')}`)
if (!dry && bib.length === 1 && bib[0].title?.startsWith('Citadel Hospital')) {
  await payload.update({ collection: 'courses', id: medicine.id, data: { bibliography: [] }, draft: true, overrideAccess: true })
  await payload.update({ collection: 'courses', id: medicine.id, data: { _status: 'published' }, overrideAccess: true })
}

await payload.destroy()
process.exit(0)
