import { getPayload } from 'payload'
import type { Payload } from 'payload'

import { slugify } from '@/lib/slugify'
import { getOrCreateId, lexical } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the "ورشة الطباعة الزرقاء وتأثير النباتات" cyanotype workshop
 * (Blue Alchemy & Botanical Impressions) with Aysha al-Hurr, Summer 2026.
 * Idempotent: person, media and course are matched by natural keys and only
 * created when missing. The five sessions carry explicit dates because the
 * workshop meets on irregular weekdays and hours. Source: the CILAS
 * announcement (EN/AR) and the images folder on the organiser's Desktop.
 *
 *   npx tsx seed/cyanotype-workshop.ts
 */

const TITLE_EN = 'Blue Alchemy & Botanical Impressions: A 5-Day Cyanotype Workshop'
const TITLE_AR = 'ورشة الطباعة الزرقاء وتأثير النباتات'
const SLUG = slugify(TITLE_EN)
const FORM_URL = 'https://forms.gle/GYQU9koU37FRGvJM9'
const APPLICATION_DEADLINE = '2026-08-15'
const IMAGES_DIR = `${'/Users/salah/Desktop'}/${(await import('fs')).readdirSync('/Users/salah/Desktop').find((name) => name.startsWith('ورشة الطباعة')) ?? ''}`
if (!(await import('fs')).existsSync(IMAGES_DIR)) {
  throw new Error(`cyanotype: images folder not found: ${IMAGES_DIR}`)
}

/* ==================================================================== people */

const seedPerson = async (): Promise<number> => {
  const existing = await payload.find({
    collection: 'people',
    where: { name: { equals: 'Aysha al-Hurr' } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = existing.docs[0]
  if (found) {
    console.log('person exists:', found.id, found.name)
    return Number(found.id)
  }

  const bio =
    'Aysha al-Hurr is a visual artist, poet, and researcher. She works across multiple media, including painting, printmaking, and short filmmaking. Her practice primarily revolves around experimentation and visual manipulation as strategies for constructing contemporary art. She earned her Bachelor of Fine Arts from Helwan University in 2025 and is currently pursuing her Master’s degree at the same institution. Additionally, she studied filmmaking at the Jesuit Film School in Cairo.'
  const bio_ar =
    'عايشة الحُر فنانة بصرية، شاعرة، وباحثة. تعمل بوسائط متعددة من بينها التصوير، الطباعة، الفوتوغرافيا، وصناعة الفيلم القصير. يشغلها بالأساس التجريب والتلاعب البصري كاستراتيجيات لبناء العمل الفني المعاصر. حصلت على بكالوريوس الفنون الجميلة من جامعة حلوان ٢٠٢٥، وتتابع دراستها للحصول على درجة الماجستير من نفس الجامعة. بالإضافة لدراسة صناعة الفيلم في مدرسة السينما - جيزويت القاهرة.'

  const doc = await payload.create({
    collection: 'people',
    data: {
      name: 'Aysha al-Hurr',
      slug: slugify('Aysha al-Hurr'),
      bio: lexical(bio),
    },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'people',
    id: doc.id,
    data: { name: 'عايشة الحُر', bio: lexical(bio_ar, 'rtl') },
    locale: 'ar',
    overrideAccess: true,
  })
  console.log('person created:', doc.id)
  return Number(doc.id)
}

/* ===================================================================== media */

// The 7 cyanotype artworks shipped with the announcement, in upload order.
// The botanical print leads as the course cover.
const COVER_FILE = '761861306_1470473881779946_7349731002078376933_n.jpg'
const IMAGES: Array<{ file: string; alt: string }> = [
  {
    file: COVER_FILE,
    alt: 'Cyanotype print of pressed botanical branches in Prussian blue, from the workshop of Aysha al-Hurr',
  },
  {
    file: '761615177_1470473081780026_6445297152235980286_n.jpg',
    alt: 'Cyanotype collage of a headless figure cut from paper, stitched in red thread over a ground of repeated Arabic lettering',
  },
  {
    file: '762179166_1470473755113292_8918055639510883098_n.jpg',
    alt: 'Cyanotype and colour photograph collage of a woman feeding giraffes at a zoo, stitched with coloured threads',
  },
  {
    file: '762633482_1470474018446599_5247738509601125075_n.jpg',
    alt: 'Cyanotype of a boatman rowing on the Nile',
  },
  {
    file: '762680229_1470473598446641_2360513579872427784_n.jpg',
    alt: 'Cyanotype collage of a kneeling figure cut from paper over a dark blue ground, crossed by a drawn white ellipse',
  },
  {
    file: '762883147_1470473591779975_6459622735246693463_n.jpg',
    alt: 'Cyanotype of a child’s silhouette reflected in blue water beside a red handprint',
  },
  {
    file: '763694696_1470473601779974_1762102000546882479_n.jpg',
    alt: 'Cyanotype with four standing silhouettes on a dark blue ground crossed by a red line',
  },
]

const seedImages = async (dir: string): Promise<Record<string, number>> => {
  const ids: Record<string, number> = {}
  for (const { file, alt } of IMAGES) {
    const id = await getOrCreateId(payload, 'media', { alt: { equals: alt } }, () =>
      payload.create({
        collection: 'media',
        data: { alt },
        filePath: `${dir}/${file}`,
        overrideAccess: true,
      }),
    )
    ids[file] = id
    console.log('media:', id, file)
  }
  return ids
}

/* ==================================================================== course */

const day = (order: number, title: string, description: string, dates: Array<{ date: string; start_time: string; end_time: string }>) => ({
  order,
  session_title: title,
  meetings: 1,
  description: lexical(description),
  dates,
})

const sessions = [
  day(
    1,
    'The Vision & the Archive (I)',
    'We begin by exploring the history of printmaking and the work of master cyanotype artists. This session is designed to expand your visual vocabulary.',
    [{ date: '2026-08-22', start_time: '18:00', end_time: '22:00' }],
  ),
  day(
    2,
    'The Vision & the Archive (II)',
    'We will conduct a dedicated “potential check” for your submitted photographs to ensure they are optimized for the best possible print results.',
    [{ date: '2026-08-24', start_time: '18:00', end_time: '22:00' }],
  ),
  day(
    3,
    'The Practical Alchemy (I)',
    'The hands-on process begins. Using your photographs (printed as digital negatives) and your curated collection of botanical greens, we will harness the sun: you will brush your papers, sensitize them, and expose your compositions. You can manipulate the size or the shape of the artwork as your vision develops, and choose four botanical works, four photography-based works, or a mix of both.',
    [{ date: '2026-08-27', start_time: '15:00', end_time: '19:00' }],
  ),
  day(
    4,
    'The Practical Alchemy (II)',
    'The exposures continue, and once the printing process is complete and the works have dried, we explore two strategies — deconstruction and reconstruction, and juxtaposition — for building and reimagining the artwork. An additional 45 minutes are set aside for brainstorming and proposing ideas on how to present the works on the fifth day.',
    [{ date: '2026-08-28', start_time: '17:00', end_time: '21:00' }],
  ),
  day(
    5,
    'Reflection & the Pop-Up Exhibition',
    'After your prints have settled, we return for a day of reflection and refinement, adding final touches (within the scope of the workshop) and preparing the artworks for display. Those interested may write a text, poem, or reflection inspired by the printing experience or the story depicted in the artwork. The final hours transition into a celebratory Pop-Up Exhibition: your four works are displayed in the gallery space, to share your results and impressions with the community in a welcoming setting.',
    [{ date: '2026-08-29', start_time: '18:00', end_time: '22:00' }],
  ),
]

const DESCRIPTION_EN = [
  'Over the course of 5 days, we will explore the cyanotype technique together: its history, its ancient uses, and consequently its evolution and creative potential in contemporary art. We will reflect on the works of artists who have utilized this technique, pushing it far beyond the limitations of practical utility and the mere concept of printing and reproduction. Additionally, we will begin exploring its chemical nature together — how we can apply it independently in a safe yet creative manner to produce, within the scope of this workshop, 4 archival / aesthetic-quality artworks that merge digital photography, organic botanical forms, and simplified drawing!',
  'Day 1 & Day 2 — The Vision & the Archive: exploring the history of printmaking and the work of master cyanotype artists to expand your visual vocabulary, with a dedicated “potential check” of your submitted photographs to ensure the best possible print results.',
  'Day 3 & Day 4 — The Practical Alchemy: using your photographs (printed as digital negatives) and your curated collection of botanical greens to harness the sun — brushing, sensitizing and exposing your compositions to create four finished artworks, then exploring deconstruction and reconstruction / juxtaposition strategies for reimagining the work.',
  'Day 5 — Reflection & the Pop-Up Exhibition: a day of reflection and refinement, preparing the artworks for display, and a celebratory Pop-Up Exhibition to share your four works and your impressions with the community.',
]

const DESCRIPTION_AR = [
  'على مدار ٥ أيام، هانتعرف مع بعض على تقنية الطباعة الزرقاء، تاريخها، واستخداماتها قديمًا، وبالتالي تطورها وقدراتها الإبداعية في الفن المعاصر. هانعتبر مع بعض أعمال الفنانين/الفنانات اللي استخدموا التقنية وأخذوها في مكان أبعد من محدودية الاستخدام العملي وفكرة الطباعة والاستنساخ. كمان، هانبدأ سوا نستكشف طبيعتها الكيميائية؛ إزاي نقدر نطبقها لوحدنا بشكل آمن وإبداعي في نفس الوقت لإنتاج -في نطاق الورشة- ٤ أعمال فنية لها جودة أرشيفية/فنية بتدمج بين التصوير الرقمي والأشكال النباتية العضوية والرسم المبسط!',
  'اليوم الأول والثاني — الرؤية والأرشيف: نبدأ باستكشاف تاريخ فن الطباعة وأعمال كبار فناني/فنانات «الطباعة الزرقاء/السيانوتايب»، بجلسة مصممة لتوسيع مخزونكم البصري وتصوراتكم عن الخامة، مع مراجعة مخصصة لـ«إمكانيات الصور» اللي أرسلتموها لضمان تحويلها إلى أفضل نتائج طباعة ممكنة.',
  'اليوم الثالث والرابع — الكيمياء/العملي: تبدأ العملية التطبيقية. باستخدام صوركم (المطبوعة كـ«نيجاتيف» رقمي) ومجموعتكم المختارة من النباتات، هانستخدم قوة الشمس: هتطلّوا الأوراق، وتعرّوها للضوء، وتتابعوا إظهار تكويناتكم الفنية لإنتاج أربعة أعمال فنية متكاملة، وبعد جفاف الأعمال هنتناول استراتيجيتي (التفكيك وإعادة التركيب - التجاور) لبناء وإعادة تصور العمل الفني.',
  'اليوم الخامس — التأمل ومعرض ختامي (صغنطوط): بعد استقرار المطبوعات وجفافها نعود ليوم من التأمل ومحاولة تقييم التجربة، ووضع لمسات أخيرة (في نطاق الورشة) على الأعمال الفنية المنتجة وتجهيزها للعرض. الساعات الأخيرة من الورشة تتحول إلى معرض احتفالي (Pop-Up Exhibition) تُعرض فيه أعمالكم الأربعة بشكل بسيط في مساحة المكان، لتشاركوا نتائجكم وانطباعاتكم مع المجتمع في إطار فني مُرَحِّب.',
]

// The announcement's registration checklist, carried on the course.
const REQUIREMENTS_EN = [
  'Digital negative submission: upload two to four high-resolution photographs (JPEG/PNG) with your registration form. These will be printed on tracing paper for you.',
  'Botanical collection: bring a selection of greens/flowers on the third day. For sharp silhouettes: press them 48 hours in advance. For ethereal textures: bring them fresh on Day 2.',
  'Studio safety: cyanotype solution is a permanent pigment. Please wear studio-appropriate clothing or bring an apron — you can simply wear all black! All chemicals, glass, and specialty papers are provided.',
  'Creative intent: briefly share — or at length, really — whether you have a specific theme or story you want your four artworks to tell.',
  'To contact the artist conducting the workshop directly, email aayshaalhurr@gmail.com.',
]

const REQUIREMENTS_AR = [
  'إرسال الصور الرقمية (Digital Negative): يرجى رفع صورتين إلى أربع صور بدقة عالية (JPEG/PNG) مع نموذج التسجيل. سنقوم بطباعتها لك بشكل ملائم على ورق شفاف (Tracing paper).',
  'المجموعة النباتية: يرجى إحضار مجموعة مختارة من النباتات أو الزهور في اليوم الثالث. للحصول على ظلال حادة: يرجى ضغطها قبل ٤٨ ساعة (وضع الزهور أو الأوراق داخل كتاب وضغطها). للحصول على أنسجة وظلال ناعمة: يرجى إحضارها مباشرة (اقطفها وهاتها).',
  'سلامة الاستوديو: محلول «السيانوتايب» صبغة دائمة. يرجى ارتداء ملابس مناسبة للاستوديو أو إحضار مريلة — ممكن ببساطة تلبس/ـي هدوم سودا! جميع المواد الكيميائية والزجاج والأوراق المتخصصة متوفرة.',
  'القصد الإبداعي: شاركونا بإيجاز — أو مش بإيجاز عادي — ما إذا كان لديكم موضوع أو قصة محددة تودون التعبير عنها من خلال أعمالكم الأربعة.',
  'للتواصل مباشرة مع الفنانة المقيمة للورشة يمكنكم إرسال إيميل لـ aayshaalhurr@gmail.com.',
]

const seedCourse = async (cycleId: number, personId: number, coverId: number) => {
  const existing = await payload.find({
    collection: 'courses',
    where: { slug: { equals: SLUG } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    console.log('course exists:', existing.docs[0].id)
    return Number(existing.docs[0].id)
  }

  // Irregular five-day meeting pattern: every session carries its own date
  // and hour range. The weekly pattern (start date + Saturdays) only anchors
  // the schedule; the visible dates come from the sessions.
  const doc = await payload.create({
    collection: 'courses',
    data: {
      tier: 'public',
      course_type: 'WORKSHOP',
      cycle: cycleId,
      cover_image: coverId,
      title: TITLE_EN,
      slug: SLUG,
      subtitle: 'Cyanotype / Blue Printing Workshop',
      description: lexical(DESCRIPTION_EN),
      schedule: {
        start_date: '2026-08-22',
        start_precision: 'day',
        weeks: 2,
        slots: [{ weekday: 'sat', start_time: '18:00', end_time: '22:00' }],
        note: 'Five days over two weeks, with varying hours; see each session for its date and time.',
      },
      sessions,
      session_unit: 'session',
      registration: {
        method: 'external',
        url: FORM_URL,
        deadline: APPLICATION_DEADLINE,
        application_requirements: lexical(REQUIREMENTS_EN),
      },
      pricing_override: {
        min: 2500,
        max: 3000,
        currency: 'EGP',
        note: 'Sliding scale — please choose the tier that best fits your current budget: 2,500 / 2,750 / 3,000 EGP. All tiers include the same level of instruction, professional tracing-paper prints, chemicals, papers, artworks, and exhibition curation; all materials are yours to keep and reuse.',
      },
      location: ['OFFLINE'],
      teaching_languages: ['ar', 'en'],
      fellows: [personId],
      _status: 'published',
    },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'courses',
    id: doc.id,
    data: {
      title: TITLE_AR,
      subtitle: 'ورشة عمل السيانوتايب / الطباعة الزرقاء',
      description: lexical(DESCRIPTION_AR, 'rtl'),
      schedule: { note: 'خمسة أيام على مدى أسبوعين بساعات متفاوتة؛ التاريخ والوقت لكل جلسة مذكور عندها.' },
      registration: {
        application_requirements: lexical(REQUIREMENTS_AR, 'rtl'),
      },
      pricing_override: {
        note: 'تسعيرة متدرجة — يرجى اختيار الفئة التي تناسب ميزانيتك الحالية: ٢٥٠٠ / ٢٧٥٠ / ٣٠٠٠ جنيه مصري. تشمل جميع الفئات نفس المستوى من التعليم، وطباعة الصور على الورق الشفاف، والمحاليل الكيميائية، والأوراق-الأعمال، وتنظيم المعرض؛ وكل شيء تستخدمه ملك لك ويمكن الاحتفاظ به لاستخدامات أخرى في مساحتك الخاصة.',
      },
      sessions: [
        { ...sessions[0], session_title: 'الرؤية والأرشيف (١)' },
        { ...sessions[1], session_title: 'الرؤية والأرشيف (٢)' },
        { ...sessions[2], session_title: 'الكيمياء / العملي (١)' },
        { ...sessions[3], session_title: 'الكيمياء / العملي (٢)' },
        { ...sessions[4], session_title: 'التأمل ومعرض ختامي (صغنطوط)' },
      ],
    },
    locale: 'ar',
    overrideAccess: true,
  })

  console.log('course created:', doc.id, TITLE_EN)
  return Number(doc.id)
}

/* =====================================================================  main */

const cycleId = await getOrCreateId(
  payload,
  'cycles',
  { and: [{ season: { equals: 'summer' } }, { start_year: { equals: 2026 } }] },
  () => {
    throw new Error('summer-2026 cycle should already exist')
  },
)
console.log('cycle:', cycleId)

const personId = await seedPerson()
const imageIds = await seedImages(IMAGES_DIR)
const courseId = await seedCourse(cycleId, personId, imageIds[COVER_FILE])

// Sanity: expanded meetings must be the five announced days.
const course = await payload.findByID({
  collection: 'courses',
  id: courseId,
  depth: 0,
  overrideAccess: true,
})
const { expandSchedule } = await import('@/lib/schedule')
const meetings = expandSchedule(course.schedule, course.sessions).filter((m) => !m.cancelled)
console.log(
  'meetings:',
  meetings.map((m) => `${m.date} ${m.start_time}-${m.end_time} (session ${m.session})`).join(' | '),
)

await payload.destroy()
process.exit(0)
