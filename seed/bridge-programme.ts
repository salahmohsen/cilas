import { getPayload } from 'payload'
import type { Payload } from 'payload'

import type { Programme } from '../src/payload-types'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the Bridge Programme 2025–2026 page's words, in English and Arabic.
 * The English comes from the old site's "bridge programme" and "programme"
 * pages (the Weebly archive, 2025-04-23); the Arabic is a translation of it
 * awaiting review. Idempotent: it rewrites the same fields each run.
 *
 *   npx tsx seed/bridge-programme.ts
 */

const SLUG = 'bridge-programme-2025-2026'

type Dir = 'ltr' | 'rtl'
const text = (t: string) => ({ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
const paragraph = (t: string, direction: Dir) => ({
  type: 'paragraph', format: '', indent: 0, version: 1, direction, textFormat: 0, textStyle: '', children: [text(t)],
})
const heading = (t: string, direction: Dir) => ({
  type: 'heading', tag: 'h3', format: '', indent: 0, version: 1, direction, children: [text(t)],
})
const quote = (t: string, direction: Dir) => ({
  type: 'quote', format: '', indent: 0, version: 1, direction, children: [text(t)],
})
type Block = ['p' | 'h' | 'q', string]
type RichText = NonNullable<Programme['overview']>
const rich = (blocks: Block[], direction: Dir): RichText => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction,
    children: blocks.map(([kind, t]) => (kind === 'h' ? heading : kind === 'q' ? quote : paragraph)(t, direction)),
  },
}) as unknown as RichText

const content = {
  en: {
    title: 'Bridge Programme 2025–2026',
    tagline: 'A year in the liberal arts, from September to June, for anyone who has finished high school.',
    overview: rich(
      [
        ['q', 'If I were asked to name the most needed of all reforms in the spirit of education I should say: cease conceiving of education as mere preparation for later life, and make of it the full meaning of the present life. — John Dewey'],
        ['p', 'The Bridge is a one-year programme in the liberal arts. CILAS invites students from all walks of life who have completed high school to engage with the liberal arts in an effort to develop a wise appreciation of the complexity of the world. In today’s world one needs to be able to interpret changing global conditions, mobilise resources effectively and guide teams of diverse people; students are challenged and supported to cultivate these skills.'],
        ['h', 'Coursework and labs'],
        ['p', 'The academic year begins in September and ends in early June. It is divided into two semesters bridged by a self-directed study period. Coursework is trans-disciplinary and discussion-based. A core curriculum provides an intellectual and socio-emotional foundation for community-building: all students complete core courses in Historical Consciousness, Philosophical and Poetic Inquiry, and Ethnographic Study. In the spring semester, students choose two thematic courses and join one of CILAS’s labs.'],
        ['h', 'Schedule and fellows'],
        ['p', 'Study at CILAS is intellectually demanding and asks for at least fifteen hours a week. Classes are scheduled flexibly: early birds can attend in the morning and night owls in the evening. Teachers at CILAS are called fellows. They coordinate, co-create and host courses, lectures, workshops, film screenings and field trips. Fellows have completed graduate studies, are experienced educators and are attuned to context.'],
        ['h', 'Attendance and method'],
        ['p', 'Students come to class ready and keen to present their reflections and inquiries. CILAS works by a pedagogy of discovery and attunement, not of consumption: what we cover matters less than what a student discovers. Discussion-based learning is the main method of instruction and relies on the participation of students. The difference between a fellow and a student is that the fellow knows how to be a student: not the one who knows the answers, but the one who knows how to find out.'],
        ['h', 'Assessment'],
        ['p', 'CILAS assesses students, fellows and the institute dialogically. Narratives in lieu of grades give students personal guidance; their work is carefully read and appreciated, and room for improvement is discussed together. CILAS looks at a student’s ability to de-construct and re-construct phenomena, categories and theories; to communicate across disciplines in writing and speech; to raise critical and creative questions; to cultivate curiosity; and to pursue their own interests along their path.'],
      ],
      'ltr',
    ),
    highlights: [
      'Two semesters, bridged by a period of self-directed study',
      'Core courses in Historical Consciousness, Philosophical and Poetic Inquiry, and Ethnographic Study',
      'Two thematic courses and a lab in the spring',
      'Written narratives instead of grades',
    ],
    schedule_note: 'Morning classes (10:00–12:30) or evening classes (17:30–20:00).',
    requirements: rich([['p', 'High school completed. A Bachelor’s degree is recommended but not required.']], 'ltr'),
    components: [
      'Core courses, fall semester',
      'Thematic courses and labs, fall semester',
      'Core courses, spring semester',
      'Thematic courses and labs, spring semester',
    ],
    testimonial: {
      quote: 'In incorporating intellectual, experiential and applied learning, CILAS creates and integrates knowledge beyond the confines of traditional academic disciplines.',
      attribution: 'Karim-Yassin Goessinger, Programme Director',
    },
  },
  ar: {
    title: 'برنامج الجسر ٢٠٢٥–٢٠٢٦',
    tagline: 'عام في الآداب والعلوم الحرة، من سبتمبر إلى يونيو، لكل من أتمّ المرحلة الثانوية.',
    overview: rich(
      [
        ['q', 'لو سُئلت عن أشدّ الإصلاحات حاجةً في روح التعليم لقلت: كفّوا عن تصوّر التعليم مجرّد إعداد لحياة لاحقة، واجعلوه المعنى الكامل للحياة الحاضرة. — جون ديوي'],
        ['p', 'الجسر برنامج مدته عام في الآداب والعلوم الحرة. تدعو سيلاس طلابًا من مختلف مناحي الحياة ممن أتمّوا المرحلة الثانوية إلى الانخراط في الآداب والعلوم الحرة سعيًا إلى تقدير حكيم لتعقيد العالم. يحتاج المرء اليوم إلى أن يفهم الظروف العالمية المتغيرة، وأن يحسن توظيف الموارد، وأن يقود فرقًا من أناس مختلفين؛ ويجد الطلاب في البرنامج تحديًا ودعمًا لتنمية هذه القدرات.'],
        ['h', 'المقررات والمختبرات'],
        ['p', 'يبدأ العام الدراسي في سبتمبر وينتهي في أوائل يونيو، وينقسم إلى فصلين يصل بينهما وقت للدراسة الذاتية. الدراسة عابرة للتخصصات وقائمة على النقاش. ويوفّر منهج أساسي أرضية فكرية ووجدانية لبناء الجماعة: يدرس جميع الطلاب المقررات الأساسية في الوعي التاريخي، والتساؤل الفلسفي والشعري، والدراسة الإثنوغرافية. وفي فصل الربيع يختار الطلاب مقررين موضوعيين وينضمون إلى أحد مختبرات سيلاس.'],
        ['h', 'المواعيد وزملاء التدريس'],
        ['p', 'الدراسة في سيلاس متطلّبة فكريًا، وتحتاج إلى خمس عشرة ساعة أسبوعيًا على الأقل. المواعيد مرنة: يمكن لمحبي الصباح الحضور صباحًا، ولمحبي السهر الحضور مساءً. يُسمّى المعلّمون في سيلاس زملاء التدريس؛ ينسّقون المقررات والمحاضرات والورش وعروض الأفلام والرحلات الميدانية ويشاركون في صنعها واستضافتها. وهم حاصلون على دراسات عليا، ولهم خبرة في التعليم، ومنتبهون إلى السياق.'],
        ['h', 'الحضور والمنهج'],
        ['p', 'يأتي الطلاب إلى الصف مستعدّين ومتحمّسين لعرض تأملاتهم وأسئلتهم. تعمل سيلاس وفق بيداغوجيا الاكتشاف والتناغم لا الاستهلاك: ما نغطّيه أقل أهمية مما يكتشفه الطالب. التعلّم القائم على النقاش هو طريقة التدريس الأساسية، ويعتمد على مشاركة الطلاب. والفرق بين زميل التدريس والطالب أن الزميل يعرف كيف يكون طالبًا: ليس من يعرف الإجابات، بل من يعرف كيف يبحث عنها.'],
        ['h', 'التقييم'],
        ['p', 'تقيّم سيلاس طلابها وزملاءها ونفسها بالحوار. وبدلًا من الدرجات، تمنح الطلاب تقييمات مكتوبة سردية توجّه كلًّا منهم؛ يُقرأ عملهم بعناية ويُقدَّر، ويُناقَش ما يمكن تحسينه معًا. وتنظر سيلاس في قدرة الطالب على تفكيك الظواهر والمفاهيم والنظريات وإعادة بنائها، وعلى التواصل عبر التخصصات كتابةً وحديثًا، وعلى طرح أسئلة نقدية ومبدعة، وتنمية الفضول، ومتابعة اهتماماته في طريقه.'],
      ],
      'rtl',
    ),
    highlights: [
      'فصلان دراسيان يصل بينهما وقت للدراسة الذاتية',
      'مقررات أساسية في الوعي التاريخي، والتساؤل الفلسفي والشعري، والدراسة الإثنوغرافية',
      'مقرران موضوعيان ومختبر في فصل الربيع',
      'تقييمات مكتوبة بدلًا من الدرجات',
    ],
    paymentPlan: 'ثلاثة أقساط',
    schedule_note: 'صفوف صباحية (١٠:٠٠–١٢:٣٠) أو مسائية (١٧:٣٠–٢٠:٠٠).',
    requirements: rich([['p', 'إتمام المرحلة الثانوية. يُستحسن الحصول على درجة البكالوريوس لكنها ليست شرطًا.']], 'rtl'),
    components: [
      'المقررات الأساسية، فصل الخريف',
      'المقررات الموضوعية والمختبرات، فصل الخريف',
      'المقررات الأساسية، فصل الربيع',
      'المقررات الموضوعية والمختبرات، فصل الربيع',
    ],
    testimonial: {
      quote: 'بالجمع بين التعلّم الفكري والتجريبي والتطبيقي، تنتج سيلاس معرفة وتربط بينها خارج حدود التخصصات الأكاديمية التقليدية.',
      attribution: 'كريم ياسين جوسينجر، مدير البرنامج',
    },
  },
}

const { docs } = await payload.find({
  collection: 'programmes',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
  locale: 'en',
})
const programme = docs[0]
if (!programme) throw new Error(`bridge: no programme ${SLUG}`)

// English first: it creates the array rows the Arabic then fills by id.
const en = content.en
const afterEn = await payload.update({
  collection: 'programmes',
  id: programme.id,
  locale: 'en',
  overrideAccess: true,
  depth: 0,
  data: {
    title: en.title,
    tagline: en.tagline,
    overview: en.overview,
    highlights: en.highlights.map((t) => ({ text: t })),
    schedule_note: en.schedule_note,
    requirements: en.requirements,
    components: (programme.components ?? []).map((c, i) => ({ ...c, label: en.components[i] ?? c.label })),
    testimonials: [{ quote: en.testimonial.quote, attribution: en.testimonial.attribution }],
  },
})

const ar = content.ar
await payload.update({
  collection: 'programmes',
  id: programme.id,
  locale: 'ar',
  overrideAccess: true,
  depth: 0,
  data: {
    title: ar.title,
    tagline: ar.tagline,
    overview: ar.overview,
    highlights: (afterEn.highlights ?? []).map((row, i) => ({ id: row.id, text: ar.highlights[i] ?? row.text })),
    schedule_note: ar.schedule_note,
    requirements: ar.requirements,
    components: (afterEn.components ?? []).map((c, i) => ({ ...c, label: ar.components[i] ?? c.label })),
    testimonials: (afterEn.testimonials ?? []).map((row) => ({ ...row, quote: ar.testimonial.quote, attribution: ar.testimonial.attribution })),
    // The payment plan's label is per language and required; the rest of the price is shared.
    ...(afterEn.pricing
      ? {
          pricing: {
            ...afterEn.pricing,
            payment_plans: (afterEn.pricing.payment_plans ?? []).map((plan) => ({ ...plan, label: ar.paymentPlan })),
          },
        }
      : {}),
  },
})

console.log(`bridge: ${SLUG} written in en and ar`)
process.exit(0)
