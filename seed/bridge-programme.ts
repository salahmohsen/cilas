import { getPayload } from 'payload'
import type { Payload } from 'payload'

import type { Programme } from '../src/payload-types'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the Bridge Programme 2025–2026 page's words, in English and Arabic.
 * The English is the old site's own, as written: its "bridge programme" and
 * "tuition" pages (the Weebly archive, 2025-04-23). Its FAQ
 * and Arabic pages describe the 2013–2017 programme and are left out. The
 * Arabic is a translation awaiting review. Idempotent: it rewrites the same
 * fields each run.
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
    // The old pages have no tagline or highlights; the page shows none.
    tagline: null,
    // bridge-programme.html, as written (one typo mended: "spoken form"), then
    // tuition.html's three sections.
    overview: rich(
      [
        ['h', 'Food for thought'],
        ['q', 'If I were asked to name the most needed of all reforms in the spirit of education I should say: cease conceiving of education as mere preparation for later life, and make of it the full meaning of the present life. And to add that only in this case does it become truly a preparation for later life is not the paradox it seems. An activity which does not have worth enough to be carried as for its own sake cannot be very effective as a preparation for something else (...). — John Dewey'],
        ['h', 'Overview'],
        ['p', 'In applying to CILAS, you seek admission to a (one-year) bridge programme in the liberal arts. CILAS invites students from all walks of life who have completed high school (a Bachelor’s degree is recommended but not required) to engage with the liberal arts in an effort to develop a wise appreciation of the complexity of the world. CILAS recognises that in today’s world, one needs to be able to interpret changing global conditions; mobilise resources effectively; and guide teams of diverse people. Students are challenged and supported to cultivate these skills.'],
        ['h', 'Coursework and labs'],
        ['p', 'The academic year at CILAS begins in September and ends in early June the following year. The year is divided into two semesters bridged by a self-directed study period. Coursework is trans-disciplinary and discussion-based. A core curriculum provides an intellectual and socio-emotional foundation for community-building. All students complete core courses in Historical Consciousness, Philosophical and Poetic Inquiry, and Ethnographic Study. In semester two in the spring, students choose two thematic courses and join one of CILAS’ labs.'],
        ['h', 'Schedule and fellows'],
        ['p', 'Study at CILAS is intellectually demanding and requires a commitment of at least fifteen weekly hours. CILAS schedules its classes flexibly. Early birds can attend class in the morning (10am to 12:30pm) and night owls may attend the evening slot (5:30pm to 8pm). Teachers at CILAS are called fellows. They coordinate, co-create, host courses, lectures, workshops, film screenings and field trips. Fellows have completed graduate studies, are experienced educators and are attuned to context.'],
        ['h', 'Attendance and methodology'],
        ['p', 'Students are asked to attend classes ready and keen to present their reflections and inquiries. CILAS operates under a pedagogy of discovery and attunement; not a pedagogy of consumption. This is to say that what we cover at CILAS matters less than what a student discovers. Discussion Based Learning is the main method of instruction at CILAS and relies heavily on the participation of students. The difference between a fellow and a student is that the fellow knows how to be a student; they are not the ones who know the answers but the ones who know how to find out.'],
        ['h', 'Assessment'],
        ['p', 'CILAS assesses the performance of students, fellows and the institute dialogically. Assessment in the form of narratives in lieu of grades provides students with personalised guidance. Students’ work is carefully assessed and appreciated. Room for improvement is discussed together. CILAS assesses students’ ability to de-construct and re-construct phenomena, categories and theories; their ability to communicate across disciplines in written and spoken form; their ability to raise critical and creative questions, cultivate curiosity, and pursue personal interests along their respective paths.'],
        ['h', 'Towards self sufficiency'],
        ['p', 'We are keen on offering a financially independent liberal arts programme. To effectively give voice to members of the community, we aim to grow as self-sufficiently as possible. Localising our sources of income has made it possible for us to continue to prepare food - for thought - autonomously. We uphold self-reliance to sustain our programmes.'],
        ['h', 'Operational costs'],
        ['p', 'CILAS’ expenditures amount to 750,000 L.E. per year. In order to make the ‘bridge’ programmes as accessible as possible to financially differently-abled applicants, tuition for the ‘bridge’ programmes amount to 18,000 L.E. per programme (two semesters), you can contribute it in three installments. It is our hope that need-based deductions would allow us to form a self-sufficient but also an inclusive and equitable scholarly collective.'],
        ['h', 'Need-based deductions'],
        ['p', 'We look at high-school attendance into four scales, university degrees held holders and place of residence to afforded need-based deductions on their tuition. An offer reflecting your financial need and ability to contribute will then be made during the interview. In solidarity, prospective students who are refugees in Egypt are exempted from tuition.'],
      ],
      'ltr',
    ),
    highlights: [] as string[],
    schedule_note: 'Morning (10am to 12:30pm) or evening (5:30pm to 8pm).',
    requirements: rich([['p', 'High school completed. A Bachelor’s degree is recommended but not required.']], 'ltr'),
    components: [
      'Core courses, fall semester',
      'Thematic courses and labs, fall semester',
      'Core courses, spring semester',
      'Thematic courses and labs, spring semester',
    ],
  },
  // A translation of the English above; the old site has no Arabic for it.
  ar: {
    title: 'برنامج الجسر ٢٠٢٥–٢٠٢٦',
    tagline: null,
    overview: rich(
      [
        ['h', 'غذاء للفكر'],
        ['q', 'لو سُئلت أن أسمّي أشدّ الإصلاحات حاجةً في روح التعليم لقلت: كفّوا عن تصوّر التعليم مجرّد إعداد لحياة لاحقة، واجعلوه المعنى الكامل للحياة الحاضرة. وأن نضيف أنه في هذه الحالة وحدها يصبح إعدادًا حقيقيًا للحياة اللاحقة ليس مفارقة كما يبدو. فالنشاط الذي لا يملك من القيمة ما يكفي لأن يُمارَس لذاته لا يمكن أن يكون إعدادًا فعّالًا لشيء آخر (...). — جون ديوي'],
        ['h', 'نظرة عامة'],
        ['p', 'حين تتقدّم إلى سيلاس فإنك تطلب الالتحاق ببرنامج جسر (مدته عام) في الآداب والعلوم الحرة. تدعو سيلاس طلابًا من مختلف مناحي الحياة ممن أتمّوا المرحلة الثانوية (يُستحسن الحصول على درجة البكالوريوس لكنها ليست شرطًا) إلى الانخراط في الآداب والعلوم الحرة سعيًا إلى تقدير حكيم لتعقيد العالم. تدرك سيلاس أن المرء في عالم اليوم يحتاج إلى أن يكون قادرًا على تفسير الظروف العالمية المتغيرة، وتوظيف الموارد بفعالية، وقيادة فرق من أناس مختلفين. ويجد الطلاب التحدي والدعم لتنمية هذه المهارات.'],
        ['h', 'المقررات والمختبرات'],
        ['p', 'يبدأ العام الدراسي في سيلاس في سبتمبر وينتهي في أوائل يونيو من العام التالي. وينقسم العام إلى فصلين دراسيين يصل بينهما وقت للدراسة الذاتية. الدراسة عابرة للتخصصات وقائمة على النقاش. ويوفّر منهج أساسي أرضية فكرية ووجدانية لبناء الجماعة. يُتمّ جميع الطلاب مقررات أساسية في الوعي التاريخي، والتساؤل الفلسفي والشعري، والدراسة الإثنوغرافية. وفي الفصل الثاني، في الربيع، يختار الطلاب مقررين موضوعيين وينضمون إلى أحد مختبرات سيلاس.'],
        ['h', 'المواعيد وزملاء التدريس'],
        ['p', 'الدراسة في سيلاس متطلّبة فكريًا وتحتاج إلى التزام لا يقل عن خمس عشرة ساعة أسبوعيًا. تضع سيلاس مواعيد صفوفها بمرونة: يمكن لمحبي الصباح حضور الصف صباحًا (من ١٠ إلى ١٢:٣٠ ظهرًا)، ولمحبي السهر حضور الموعد المسائي (من ٥:٣٠ إلى ٨ مساءً). يُسمّى المعلّمون في سيلاس زملاء التدريس. ينسّقون المقررات والمحاضرات والورش وعروض الأفلام والرحلات الميدانية ويشاركون في صنعها واستضافتها. وقد أتمّ زملاء التدريس دراسات عليا، ولهم خبرة في التعليم، ومنتبهون إلى السياق.'],
        ['h', 'الحضور والمنهج'],
        ['p', 'يُطلب من الطلاب حضور الصفوف مستعدّين ومتحمّسين لعرض تأملاتهم وتساؤلاتهم. تعمل سيلاس وفق بيداغوجيا الاكتشاف والتناغم، لا بيداغوجيا الاستهلاك. أي إن ما نغطّيه في سيلاس أقل أهمية مما يكتشفه الطالب. التعلّم القائم على النقاش هو طريقة التدريس الأساسية في سيلاس، ويعتمد اعتمادًا كبيرًا على مشاركة الطلاب. والفرق بين زميل التدريس والطالب أن الزميل يعرف كيف يكون طالبًا؛ ليس هو من يعرف الإجابات، بل من يعرف كيف يبحث عنها.'],
        ['h', 'التقييم'],
        ['p', 'تقيّم سيلاس أداء الطلاب وزملاء التدريس والمعهد نفسه بالحوار. ويمنح التقييم في صورة نصوص سردية بدلًا من الدرجات توجيهًا شخصيًا لكل طالب. يُقيَّم عمل الطلاب بعناية ويُقدَّر، ويُناقَش ما يمكن تحسينه معًا. وتقيّم سيلاس قدرة الطلاب على تفكيك الظواهر والمفاهيم والنظريات وإعادة بنائها، وقدرتهم على التواصل عبر التخصصات كتابةً وحديثًا، وقدرتهم على طرح أسئلة نقدية ومبدعة، وتنمية الفضول، ومتابعة اهتماماتهم الشخصية كلٌّ في طريقه.'],
        ['h', 'نحو الاكتفاء الذاتي'],
        ['p', 'نحرص على أن نقدّم برنامجًا في الآداب والعلوم الحرة مستقلًا ماليًا. ولكي نمنح أفراد الجماعة صوتًا فعليًا، نسعى إلى أن ننمو معتمدين على أنفسنا قدر الإمكان. وقد مكّننا توطين مصادر دخلنا من مواصلة إعداد الغذاء — غذاء الفكر — باستقلال. ونتمسّك بالاعتماد على الذات لنحافظ على برامجنا.'],
        ['h', 'التكاليف التشغيلية'],
        ['p', 'تبلغ نفقات سيلاس ٧٥٠٬٠٠٠ جنيه في العام. ولكي نجعل برامج «الجسر» متاحة قدر الإمكان للمتقدّمين من مختلف القدرات المالية، تبلغ رسوم برامج «الجسر» ١٨٬٠٠٠ جنيه للبرنامج (فصلان دراسيان)، يمكن دفعها على ثلاثة أقساط. ونأمل أن تتيح لنا التخفيضات بحسب الحاجة تكوين جماعة علمية مكتفية بذاتها، وشاملة ومنصفة في آن.'],
        ['h', 'التخفيضات بحسب الحاجة'],
        ['p', 'ننظر في نوع المدرسة الثانوية على أربع درجات، وفي الشهادات الجامعية الحاصل عليها المتقدّم، وفي مكان إقامته، لنحدّد التخفيضات التي يستحقها من الرسوم بحسب حاجته. ثم يُقدَّم خلال المقابلة عرض يعكس حاجتك المالية وقدرتك على المساهمة. وتضامنًا، يُعفى من الرسوم المتقدّمون من اللاجئين في مصر.'],
      ],
      'rtl',
    ),
    highlights: [] as string[],
    paymentPlan: 'ثلاثة أقساط',
    schedule_note: 'صباحًا (من ١٠ إلى ١٢:٣٠ ظهرًا) أو مساءً (من ٥:٣٠ إلى ٨ مساءً).',
    requirements: rich([['p', 'إتمام المرحلة الثانوية. يُستحسن الحصول على درجة البكالوريوس لكنها ليست شرطًا.']], 'rtl'),
    components: [
      'المقررات الأساسية، فصل الخريف',
      'المقررات الموضوعية والمختبرات، فصل الخريف',
      'المقررات الأساسية، فصل الربيع',
      'المقررات الموضوعية والمختبرات، فصل الربيع',
    ],
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
    // The director's words are on another page of the old site, not this one.
    testimonials: [],
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
