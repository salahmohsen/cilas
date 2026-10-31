import { getPayload } from 'payload'
import type { Payload } from 'payload'

import { slugify } from '@/lib/slugify'
import type { MaterialSeed } from './seed.type'
import { bib, getOrCreateId, lexical } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the "قف للمعلم! أو لا؟" workshop (The Value of Work), Fall 2026.
 * Idempotent: the person, cycle, media and course are matched by natural keys
 * and only created when missing. Source: the workshop's Google Doc and the
 * CILAS announcement (docx on the organiser's Desktop).
 *
 *   npx tsx seed/workshop-value-of-work.ts
 */

const TITLE_EN = 'The Value of Work: Professions, Labour, and Social Recognition'
const TITLE_AR = 'قف للمعلم! أو لا؟'
const SLUG = slugify(TITLE_EN)
const FORM_URL = 'https://forms.gle/qaRtcGQL8CC9A6u39'
const APPLICATION_DEADLINE = '2026-09-15'
const COVER_FILE = '/Users/salah/Desktop/قف للمعلم! أو لا؟.docx'

/* ==================================================================== people */

// Ghosoun Ismail already holds a profile with EN and AR bios; only create her
// when she is missing, and never overwrite an existing profile.
const seedPerson = async (): Promise<number> => {
  const existing = await payload.find({
    collection: 'people',
    where: { name: { equals: 'Ghosoun Ismail' } },
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
    'Holds a Master’s degree from Teachers College, Columbia University, and a Master’s degree in Sociology and Anthropology from the American University in Cairo. She is a researcher and educator whose work focuses on education, social inequality, social policies and the relationship between schooling, class, identity, and belonging in Egypt. Her research and professional practice engage with questions of educational stratification and lived experience, and she has contributed to policy-oriented research, program development, and educational initiatives that connect academic inquiry with practice.'
  const bio_ar =
    'تحمل درجة ماجستير من كلية المعلمين بجامعة كولومبيا، وماجستير في علم الاجتماع والأنثروبولوجيا من الجامعة الأمريكية بالقاهرة. باحثة ومربية يتركّز عملها على التعليم وعدم المساواة الاجتماعية والسياسات الاجتماعية، وعلاقة التعليم بالطبقة والهوية والانتماء في مصر. تتناول أبحاثها وممارساتها المهنية أسئلة التميّز التعليمي (الترسيم) والتجربة المعيشة، وأسهمت في أبحاث موجّهة للسياسات وتطوير البرامج ومبادرات تعليمية تربط البحث الأكاديمي بالممارسة.'

  const doc = await payload.create({
    collection: 'people',
    data: {
      name: 'Ghosoun Ismail',
      visible: true,
      slug: slugify('Ghosoun Ismail'),
      bio: lexical(bio),
    },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'people',
    id: doc.id,
    data: { name: 'غصون إسماعيل', bio: lexical(bio_ar, 'rtl') },
    locale: 'ar',
    overrideAccess: true,
  })
  console.log('person created:', doc.id)
  return Number(doc.id)
}

/* ==================================================================== cycles */

const seedCycle = async (): Promise<number> =>
  getOrCreateId(
    payload,
    'cycles',
    { and: [{ season: { equals: 'fall' } }, { start_year: { equals: 2026 } }] },
    () =>
      payload.create({
        collection: 'cycles',
        // Title, slug and academic year are derived (ADR 0003).
        data: {
          season: 'fall',
          start_year: 2026,
          place: 1, // Darb el-Labbana
          start_date: '2026-10-01',
        },
        overrideAccess: true,
      }),
  ).then((id) => {
    console.log('cycle:', id, 'fall-2026')
    return id
  })

/* ===================================================================== media */

const seedCover = async (): Promise<number | null> => {
  const alt = 'Film still of an Egyptian teacher pointing at a blackboard that reads «لغة عربية»'
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = existing.docs[0]
  if (found) {
    console.log('media exists:', found.id)
    return Number(found.id)
  }

  // Cover art shipped inside the workshop docx.
  const fs = await import('fs')
  if (!fs.existsSync(COVER_FILE)) {
    console.log('media: cover file missing, skipping')
    return null
  }
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    filePath: '/tmp/wsx/word/media/image1.jpg',
    overrideAccess: true,
  })
  console.log('media created:', doc.id)
  return Number(doc.id)
}

/* ==================================================================== course */

const day = (order: number, title: string, description: string, readings: MaterialSeed[]) => ({
  order,
  session_title: title,
  meetings: 1,
  description: lexical(description),
  bibliography: readings.map(bib),
})

const sessions = [
  day(
    1,
    'What Is Work Worth?',
    'Central question: How do we decide the value of work? The day moves from labour to value: opening and positionality (who are we and what kinds of work have shaped our lives?); the Value Ranking exercise, where participants rank occupations by social importance, economic reward, skill, status and responsibility; small groups compare rankings and ask what made one occupation “more valuable”; a reading intervention on labour and value; groups identify the dimensions of value — economic, social, symbolic, political; the Value of a Job exercise maps what a worker in one occupation actually produces, economically, socially, culturally and emotionally. Output: the Value Map — a collectively developed working definition of the value of work.',
    [
      { type: 'reading', title: 'Capital, Vol. I', note: 'Karl Marx' },
      { type: 'reading', title: 'The Invisible Heart', note: 'Nancy Folbre' },
      { type: 'reading', title: 'The Managed Heart', note: 'Arlie Hochschild' },
      { type: 'reading', title: 'Bullshit Jobs', note: 'David Graeber' },
      { type: 'reading', title: '«القيمة الاجتماعية للعمل»', note: 'مسعودة حمايدي وسميرة خيذر' },
      { type: 'reading', title: '«قيم العمل من منظور اجتماعي»', note: 'نصيرة طاهيري' },
      {
        type: 'reading',
        title: '«قيم العمل بين الخطاب الأخلاقي والممارسات الاجتماعية»',
        note: 'حسام الدين فياض',
      },
    ],
  ),
  day(
    2,
    'Who Gets to Be a Professional?',
    'Central question: What makes an occupation a profession — and who gets to decide? The day moves from value to professionalism: revisiting the Value Map; the Professionalization Test, where groups receive different occupations and decide whether each is a profession; groups develop their own criteria — expertise, credentials, autonomy, status, income, regulation, ethics; a short reading intervention on professionalization, professional closure, credentials, expertise and status; groups examine teaching against the criteria they developed; the contradictions of the profession — low pay, limited autonomy, precarious contracts, fragmented training, recruitment practices. Output: the Professionalism Framework — a collectively developed answer to what makes an occupation a profession and what conditions strengthen or weaken professional status.',
    [
      { type: 'reading', title: '“The Forms of Capital”', note: 'Pierre Bourdieu' },
      { type: 'reading', title: 'The System of Professions', note: 'Andrew Abbott' },
      {
        type: 'reading',
        title: '“The Rise of Professions and Professional Organizations in Modern Egypt”',
        note: 'Donald Reid',
      },
      {
        type: 'reading',
        title: '«تقدير كل من المكانة الاجتماعية والاقتصادية للمهن لدى عينة من أفراد المجتمع المصري»',
        note: 'عبد اللطيف محمد خليفة',
      },
    ],
  ),
  day(
    3,
    'When Value and Reward Diverge',
    'Central question: What happens when socially valued work is economically undervalued? The day moves from professionalism to inequality, from the symbolic and social value of work to the material distribution of rewards: groups map what counts as reward — income, status, security, autonomy, recognition, career progression, training, working conditions; occupations and cases are compared by social value versus material reward; a reading intervention on labour inequality, social reproduction and occupational stratification; evidence-based group analysis of teaching in Egypt — salaries, recruitment, employment security, training, public and private education, TVET, Al-Azhar, gender and spatial inequalities; the Value–Reward Matrix asks why the low-reward, high-social-value quadrant exists. Output: the Value–Reward–Inequality Map.',
    [
      { type: 'reading', title: '“The Forms of Capital”', note: 'Pierre Bourdieu' },
      { type: 'reading', title: '“Contradictions of Capital and Care”', note: 'Nancy Fraser' },
      { type: 'reading', title: '«إعادة الإنتاج الاجتماعي»', note: 'فيروز يوسفي' },
      { type: 'reading', title: '«فجوة الأجور بين الجنسين في مصر»' },
    ],
  ),
  day(
    4,
    'Who Gets to Define the Value of Work?',
    'Central question: How do workers respond when their labour is undervalued? The day moves from inequality to contestation: mapping possible individual responses — leaving, second jobs, private work, retraining, migration, reducing effort; mapping collective possibilities — professional associations, unions, petitions, strikes, protests, campaigns, informal networks; a short intervention on collective action, political opportunity, professional organization and power; participants examine moments of teacher organization and mobilization in Egypt (pre-2011, post-2011, post-2014) and ask why the forms and spaces of collective action changed. Output: the Contestation Map — and, entirely voluntarily, participants may continue developing the four outputs into a co-authored paper or article for potential publication.',
    [
      { type: 'reading', title: 'Power in Movement', note: 'Sidney Tarrow' },
      { type: 'reading', title: 'Social Movements, 1768–2004', note: 'Charles Tilly' },
      {
        type: 'reading',
        title: 'The Struggle for Worker Rights in Egypt',
        note: 'Joel Beinin (Arabic edition)',
      },
      {
        type: 'reading',
        title: 'Workers on the Nile',
        note: 'Joel Beinin & Zachary Lockman (Arabic edition)',
      },
      {
        type: 'reading',
        title: 'Work on Egyptian social movements and protest',
        note: 'Maha Abdelrahman',
      },
    ],
  ),
]

const DESCRIPTION_EN = [
  'What makes some forms of work more valued than others? How do societies determine the social and economic value of labour, and what happens when social recognition does not translate into material reward?',
  'This four-day workshop explores the relationship between labour, professional status, social value, and material conditions through a critical sociological lens. We will examine how professions are constructed, valued, regulated, and stratified, and how education, class, gender, institutions, and labour markets shape who is recognized as a professional and what their work is considered worth.',
  'Teaching provides a central case through which to explore these questions. Teaching is widely understood as socially essential work, requiring specialized knowledge, qualifications, professional responsibility, and significant emotional and intellectual labour. Yet in many contexts, teachers experience low wages, precarious employment, limited institutional investment, and fragmented opportunities for professional development. This creates a tension between the social value attached to teaching and the material conditions under which teaching labour is performed. The workshop also asks how those who occupy the profession respond to this tension: how do they adapt, negotiate, reproduce, or challenge the conditions of their work and the value assigned to it?',
  'Using teaching as a window rather than the sole subject of study, we will explore questions of professionalism, labour markets, recruitment, professional training, class, gender, inequality, and collective action, while examining how workers experience and respond to the conditions of their work.',
  'The workshop follows a Critical Participatory Research (CPR) approach, treating participants not simply as learners or recipients of established knowledge, but as co-producers of knowledge. Across the four days, we will combine short academic readings with discussion, collaborative activities, participants’ own experiences and observations, and collective analysis. Each day will produce a shared conceptual or analytical output that builds toward the next question.',
  'The aim is therefore not to arrive with a fixed answer, but to question, examine, and build our understanding together: What is work worth? What makes work a profession? What happens when value and reward diverge? And how do workers respond?',
  'The workshop draws primarily on the Egyptian context, while connecting these questions to broader debates about professions, work, inequality, and the political economy of labour.',
  'Across the four days: (1) What Is Work Worth? — from labour to value; (2) When Does Work Become a Profession? — from value to professionalism; (3) When Value and Reward Diverge — from professionalism to inequality; (4) Who Gets to Define the Value of Work? — from inequality to contestation. Throughout, teaching is a recurring case, not the subject of every session.',
  'At the end of the workshop, participants will have the opportunity—entirely voluntarily—to continue working collectively on the ideas and materials developed during the four days and develop them into a co-authored paper or article for potential publication.',
  'No prior specialization in education or teaching is required. The workshop is intended for anyone interested in questions of work, professions, inequality, social value, and labour from a social science and liberal arts perspective.',
]

const DESCRIPTION_AR = [
  'ما هو العمل؟ ومتى يصبح العمل مهنة؟ وما الذي يجعل للعمل قيمة؟ وكيف تتشكّل هذه القيمة اجتماعيًا؟ أسئلة قد تبدو بديهية، لكن ماذا يحدث عندما نبدأ في تفكيكها؟',
  'من أين تأتي قيمة العمل؟ هل من الأجر، أم من المكانة الاجتماعية، أم من المنفعة التي يقدمها للمجتمع؟ وهل ما نعتبره ذا قيمة اجتماعيًا يترجم بالضرورة إلى قيمة اقتصادية أو مادية؟ وماذا عن المعايير التي تجعل مهنة ما أكثر مكانة أو تقديرًا من غيرها؟ من يضع هذه المعايير؟ وكيف تظهر في الواقع؟ وكيف تنعكس هذه المعايير على الممارسة اليومية للعاملين، وكيف يتعاملون معها ويعيدون التفاوض حولها؟',
  'تنطلق الورشة من التدريس كحالة؛ فمهنة التعليم، والمعلم بشكل خاص، من المهن التي تكشف بوضوح التوتر بين القيمة الاجتماعية للعمل وبين شروط ممارسته، خاصة مع التحولات الاقتصادية والاجتماعية التي أعادت تشكيل معنى المهنة ومكانتها وشروطها. لكن السؤال هنا ليس عن المعلمين وحدهم، بل عن العمل والمهن وقيمتها وكيف تتشكل وتتغير.',
  'ولهذا لن نقدم تعريفات جاهزة لهذه المفاهيم. تعتمد الورشة على Critical Participatory Research / Inquiry، حيث تصبح تجارب المشاركين وملاحظاتهم ومفاهيمهم نقطة انطلاق لإنتاج المعرفة وتحليلها معًا. سنقرأ، ونسأل، ونختلف، ونختبر أفكارنا، ونحاول أن نبني معًا فهمًا لما يعنيه العمل، وما الذي يجعل مهنة ما ذات قيمة، وكيف يتعامل العاملون معها عندما تتغير قيمتها أو شروطها.',
  'أربعة أيام نحاول فيها أن نستمع، ونسأل، ونقرأ، ونتناقش، ونعيد تخيّل هذه المفاهيم معًا.',
]

const seedCourse = async (cycleId: number, personId: number, coverId: number | null) => {
  const existing = await payload.find({
    collection: 'courses',
    where: { slug: { equals: SLUG } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    console.log('course exists:', existing.docs[0].id, TITLE_EN)
    return Number(existing.docs[0].id)
  }

  // Schedule: Thursday and Saturday, 5–9 pm, over two weeks — 1, 3, 8 and 10
  // October 2026 in Cairo. Four sessions of one meeting each.
  const doc = await payload.create({
    collection: 'courses',
    data: {
      tier: 'public',
      course_type: 'WORKSHOP',
      cycle: cycleId,
      ...(coverId ? { cover_image: coverId } : {}),
      title: TITLE_EN,
      slug: SLUG,
      subtitle: 'Teaching as a Case',
      description: lexical(DESCRIPTION_EN),
      schedule: {
        start_date: '2026-10-01',
        start_precision: 'day',
        weeks: 2,
        slots: [
          { weekday: 'thu', start_time: '17:00', end_time: '21:00' },
          { weekday: 'sat', start_time: '17:00', end_time: '21:00' },
        ],
      },
      sessions,
      session_unit: 'session',
      registration: {
        method: 'external',
        url: FORM_URL,
        deadline: APPLICATION_DEADLINE,
      },
      location: ['OFFLINE'],
      teaching_languages: ['ar', 'en'],
      fellows: [personId],
      syllabus_tentative: true,
      _status: 'published',
    },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'courses',
    id: doc.id,
    data: {
      title: TITLE_AR,
      subtitle: 'التدريس كحالة',
      description: lexical(DESCRIPTION_AR, 'rtl'),
    },
    locale: 'ar',
    overrideAccess: true,
  })

  console.log('course created:', doc.id, TITLE_EN)
  return Number(doc.id)
}

/* =====================================================================  main */

const personId = await seedPerson()
const cycleId = await seedCycle()
const coverId = await seedCover()
const courseId = await seedCourse(cycleId, personId, coverId)

// Sanity: expanded meetings must be the four announced days.
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
