import { getPayload } from 'payload'
import type { Payload } from 'payload'

import type { Programme } from '../src/payload-types'
import { FORM_TITLE } from './bridge-application-form.meta'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the Bridge Programme 2025–2026, in CILAS's own words for that year.
 * The Arabic is the programme's announcement posts (December 2025 – July 2026)
 * as written, with the attendance and "A Day at CILAS" paragraphs from the
 * application form's Arabic. The English is the application form's English
 * introduction as written, arranged under the posts' four headings (those
 * headings, the core courses' list and the line on who may join them are
 * translated from the posts). Facts follow the posts: 30,000 EGP in three
 * payments, classes on Saturday, Tuesday and Thursday, applications through
 * the form until 29 November. Run seed/bridge-application-form.ts first.
 * Idempotent.
 *
 *   npx tsx seed/bridge-programme.ts
 */

const SLUG = 'bridge-programme-2025-2026'
const SEASON_AR = { fall: 'الخريف', winter: 'الشتاء', spring: 'الربيع', summer: 'الصيف' } as const

type Dir = 'ltr' | 'rtl'
const text = (t: string) => ({
  type: 'text',
  text: t,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const paragraph = (t: string, direction: Dir) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction,
  textFormat: 0,
  textStyle: '',
  children: [text(t)],
})
const heading = (t: string, direction: Dir) => ({
  type: 'heading',
  tag: 'h3',
  format: '',
  indent: 0,
  version: 1,
  direction,
  children: [text(t)],
})
const list = (items: string[], direction: Dir) => ({
  type: 'list',
  listType: 'bullet',
  tag: 'ul',
  start: 1,
  format: '',
  indent: 0,
  version: 1,
  direction,
  children: items.map((t, i) => ({
    type: 'listitem',
    value: i + 1,
    format: '',
    indent: 0,
    version: 1,
    direction,
    children: [text(t)],
  })),
})
type Block = ['p' | 'h', string] | ['ul', string[]]
type RichText = NonNullable<Programme['overview']>
const rich = (blocks: Block[], direction: Dir): RichText =>
  ({
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction,
      children: blocks.map((b) =>
        b[0] === 'ul'
          ? list(b[1], direction)
          : (b[0] === 'h' ? heading : paragraph)(b[1], direction),
      ),
    },
  }) as unknown as RichText

const content = {
  en: {
    title: 'Bridge Programme 2025–2026',
    overview: rich(
      [
        ['h', 'About CILAS and the bridge programme'],
        [
          'p',
          'Conceived in 2013 as an alternative offering in higher education, CILAS welcomes high school graduates as well as university walkouts, students and graduates; wisdom seekers and portfolio crafters; trained engineers, economists and doctors; activists, artists and organisers; Egyptians from different provinces, new and old arrivals; or other than all of that, to name but a few of the walks of life that have come to CILAS to engage the complexity of the world we live in.',
        ],
        [
          'p',
          'Think of CILAS as an autonomous scholarly collective rather than a corporate academic institution or a modern/colonial university. It does not issue credit points or an accredited degree. As a member of the learning community you will be supported and challenged in your inquiries. The ‘bridge’ program encourages the collaborative crafting of an intellectual, corporeal, and aesthetic portfolio. You will receive and offer guidance from and to the community as you cross the ‘bridge’ with all its discomforts, moments of joy and frustration, its paradoxes and invitations to reflect, share and grow. Alongside you will also be accompanied and mentored by a residential fellow on your learning journey.',
        ],
        [
          'p',
          'Please don’t feel discouraged to apply if your English is not ‘proficient’. We welcome all ‘English-es’ and embrace bi-linguality in our discussions. However, we ask you to fill in the form in English as many of the assigned readings at CILAS are in English.',
        ],
        ['h', 'The programme and its courses'],
        [
          'p',
          'The one-year ‘bridge’ program is divided into two semesters - a winter semester and a spring semester that are each divided into two terms. The first semester engages in intellectual and experiential inquiry whereas in the second semester seeks to apply the learning and is oriented towards production, i.e. the crafting of a portfolio through the labs in addition to the thematic courses.',
        ],
        [
          'p',
          'During the Winter semester all students complete a trans-disciplinary core curriculum consisting of three complementary core courses. The core curriculum introduces students to key concepts, ongoing debates and modes of inquiry in the Humanities and Social Sciences. The core courses focus on developing Historical Consciousness drawing on global, environmental and art histories. In the second core course students practice Philosophical Inquiry. They learn to appreciate arguments, paradoxes and deep reflection. The third course teaches Ethnographic Study with an emphasis on a critical understanding of knowledge production, self-reflexivity, positionality and orality.',
        ],
        [
          'ul',
          [
            'Historical Consciousness, facilitated by Yamen Nouh',
            'Ethnographic Study, facilitated by Bahi Ashraf',
            'Philosophical Inquiry, facilitated by Hisham Fahmy',
          ],
        ],
        ['p', 'These three core courses are open to programme students only.'],
        [
          'p',
          'In the spring semester students join a lab and two thematic courses that are on offer. Thematic courses respond to students’ concerns and interests. Thematic courses build on the core curriculum in that they contextualise and probe issues that emerged from the core curriculum. In parallel to thematic coursework students join a ‘lab’ to experiment with tactics and strategies of research writing; the translation of texts; the creation of spaces and audio-visual content; and the engagement with different modes of learning.',
        ],
        [
          'p',
          'Opposed to a pedagogy of consumption, CILAS operates under a pedagogy of attunement and respectful discovery. This is to say that what we cover at CILAS matters less than what we discover together. Discussion Based Learning is the main teaching/learning methodology at CILAS and relies heavily on the participation and solidarity of everyone. Students are expected to attend at least 80% of classes (nine out of twelve classes per semester).',
        ],
        [
          'p',
          'At the end of the spring semester students present their findings and insights to the public on A Day at CILAS.',
        ],
        ['h', 'Dates and schedule'],
        [
          'p',
          'The year starts with a pre-orientation/mezzat of readings, recordings and viewings followed by a ‘three-day orientation’ in the beginning of the third week of December and ends on 3rd of April. The rest of April is dedicated to self-directed study in conversation with the residential fellow.',
        ],
        [
          'p',
          'The classes schedule is three set days per week (Saturday, Tuesday, and Thursday; from 10:30 am for three hours in the morning period or from 5:30 pm for three hours in the evening period), in the winter (first) semester for all students based on their chosen period. And in the spring (second) semester it changes according to each student’s chosen courses and labs. To warm up for the second semester, a retreat is organized for students and teaching fellows outside of Cairo for 2-3 days.',
        ],
        ['h', 'Fees and partial scholarships'],
        [
          'p',
          'We are keen on offering a financially independent liberal arts program. To effectively give voice to members of the community, we aim to grow as self-sufficient as possible. Localising our sources of income has made it possible for us to continue autonomously, and it is only reliant on the contributions of the students. We uphold self-reliance to sustain our programs therefore we expect students to respect their financial commitment and fulfill their due payments in time knowing that this has critical effects on how CILAS operates. The full year tuition is 30,000 EGP with an option to be paid in three installments in the third week of December, the first week of February, and the third week of April. CILAS recognizes the importance of a sliding scale that is sensitive to people’s financial needs and abilities so there is a possibility of offering partial scholarships for a limited number of students, you can apply by sending an email admissions@ci-las.org after filling the application form.',
        ],
      ],
      'ltr',
    ),
    schedule_note:
      'Saturday, Tuesday and Thursday, from 10:30 am or from 5:30 pm, for three hours (winter semester).',
    paymentPlan: 'Three installments',
    paymentNote:
      'In the third week of December, the first week of February and the third week of April.',
  },
  ar: {
    title: 'برنامج الجسر ٢٠٢٥–٢٠٢٦',
    overview: rich(
      [
        ['h', 'عن سيلاس وبرنامج الجسر'],
        [
          'p',
          'معهد القاهرة للعلوم والآداب الحرة، واختصاره سيلاس، أنشئ في عام ٢٠١٣ كاختيار بديل للتعليم العالي. ترحب سيلاس بخريجي الثانوية كما ترحب بالمنسحبين من الجامعات والطلاب فيها والخريجين، الساعين للحكمة أو اكتساب الخبرة، المهندسين والاقتصاديين والأطباء والفنانين والمنظمين، أو غير ذلك كله، المصريين من مختلف المحافظات والوافدين الجدد والقدامى، كل من سبق، على سبيل المثال لا الحصر، هم ممن أتوا لسيلاس من مختلف دروب الحياة للاشتباك مع تعقيدات العالم الذي نحيا فيه.',
        ],
        [
          'p',
          'برنامج الجسر هو تجربة تعلم ممتدة لفترة عام دراسي كامل في مقر سيلاس (offline) وقائمة على أسلوب التعلم بالمناقشة (Discussion-based learning) في مجالات العلوم الاجتماعية والإنسانيات بتشابكاتها مع المواضيع المختلفة. ويتم تنظيم أنشطة متنوعة على مدار العام بعضها متاح للجميع وبعضها مخصص لطلاب برنامج الجسر فقط.',
        ],
        [
          'p',
          'ينضم الطلاب إلى سيلاس من خلفيات مختلفة، وعادةً ما يمرون برحلة تعليمية مكثفة يتفاعلون فيها مع مجموعة متنوعة من المدارس الفكرية. يقبل البرنامج من قد يكون لديهم خبرة سابقة في العلوم الاجتماعية والإنسانية كما يرحب بمن يود استكشافها للمرة الأولى.',
        ],
        [
          'p',
          'يقدم الميسرون التوجيه والملاحظات والإرشاد خلال تلك الرحلة لمساعدة الطلاب في احتواء اهتماماتهم وشكوكهم واستفساراتهم وكذلك إعدادهم لمساعيهم المستقبلية خارج نطاق سيلاس.',
        ],
        [
          'p',
          'ورجاء لا تشعروا بالإحباط والخوف من التقديم إذا كانت انجليزيتكم ليست طلقة، نحن نرحب بالجميع وبكل مستوياتهم في اللغة، كما أننا نتبنى ثنائية اللغة في المناقشات، ولكن مع ذلك نود لو تملئوا استمارة التقديم بالإنجليزية حيث أن معظم القراءات في سيلاس تكون باللغة الإنجليزية.',
        ],
        ['h', 'عن البرنامج والمساقات'],
        ['p', 'ينقسم برنامج السنة الدراسية الكاملة لفصلين:'],
        [
          'p',
          'تتفاعل مساقات الفصل الأول مع التساؤلات الفكرية والتجريبية في العلوم الاجتماعية والإنسانيات من خلال الثلاث مساقات الأساسية',
        ],
        [
          'ul',
          [
            'الوعي التاريخي: ييسره يامن نوح',
            'الدراسات الإثنوغرافية: ييسره باهي أشرف',
            'التساؤلات الفلسفية: ييسره هشام فهمي',
          ],
        ],
        ['p', 'وهذه المساقات الثلاث متاحة فقط لطلاب البرنامج'],
        [
          'p',
          'في الفصل الثاني نسعى لتطبيق التعلم ليس فقط من خلال التعرض لمساقات عن مواضيع نوعية/تيمية متخصصة تتفرع من مجالات الفصل الأول الثلاث ولكن أيضاً عبر التركيز على الإنتاج من خلال معامل ومختبرات سيلاس ولكل شخص حرية اختيار مساقين ومختبر حسب رغبتهم من المساقات المتاحة خلال الفصل الثاني وفقاً لاهتماماتهم. يُعلَن عن المساقات المتاحة بعد انتهاء الفصل الأول وكذلك يُفتَح باب التسجيل والحضور للطلاب الزائرين من خارج البرنامج.',
        ],
        [
          'p',
          'بخلاف التعلم الاستهلاكي، يعمل سيلاس في إطار التعلم بالانسجام والاكتشاف، فيمكنك القول بأن ما نتعلمه في سيلاس لا يهم بقدر ما نكتشفه معًا، التعلم عن طريق المناقشة هو الطريقة الرئيسية للتدريس والتعلم في سيلاس التي تعتمد بشدة على مشاركة الجميع وتضامنهم، نتوقع من الطلاب الحضور بنسبة ٨٠ بالمئة على الأقل من الجلسات.',
        ],
        [
          'p',
          'في نهاية الفصل الربيعي يقدم الطلاب رؤاهم والنتائج خلال معرض مفتوح للجمهور في (يوم في سيلاس).',
        ],
        ['h', 'التواريخ والمواعيد'],
        ['p', 'يبدأ الفصل الدراسي الأول في الأسبوع الثالث من شهر ديسمبر وينتهي في بداية إبريل.'],
        [
          'p',
          'للاستعداد للفصل الدراسي الثاني، يتم تنظيم مخيم للطلاب وزملاء التدريس خارج القاهرة لمدة يومين أو ثلاثة أيام.',
        ],
        ['p', 'يبدأ الفصل الدراسي الثاني في النصف الثاني من شهر إبريل.'],
        [
          'p',
          'جدول الحصص هو ثلاثة أيام محددة في الأسبوع: السبت والثلاثاء والخميس، من الساعة ١٠:٣٠ صباحاً ولمدة ثلاث ساعات في الفترة الصباحية أو من الساعة ٥:٣٠ مساءً ولمدة ثلاث ساعات للفترة المسائية وذلك في الفصل الدراسي الشتوي (الأول) لجميع الطلاب بناء على الفترة التي يختارونها.',
        ],
        [
          'p',
          'في الفصل الدراسي الثاني تتغير المواعيد وفقًا للمساقات والمختبرات التي يختارها كل طالب.',
        ],
        ['h', 'الرسوم والمنح الجزئية'],
        [
          'p',
          'تبلغ الرسوم الدراسية للعام بأكمله ٣٠ ألف جنيه مصري مع إمكانية دفعها على ثلاث دفعات: في الأسبوع الثالث من ديسمبر والأسبوع الأول من فبراير والأسبوع الثالث من إبريل.',
        ],
        [
          'p',
          'تعرف سيلاس أهمية وجود مقياس متدرج لرسوم تعليمها يراعي احتياجات الناس وقدراتهم. لذا هناك إمكانية تقديم منح جزئية لعدد محدود من الطلاب، يمكنك التقديم لها عن طريق إرسال بريد إلكتروني على admissions@ci-las.org بعد الانتهاء من تقديم استمارة التقديم للبرنامج.',
        ],
      ],
      'rtl',
    ),
    schedule_note:
      'السبت والثلاثاء والخميس، من ١٠:٣٠ صباحًا أو من ٥:٣٠ مساءً، لمدة ثلاث ساعات (الفصل الشتوي).',
    paymentPlan: 'ثلاث دفعات',
    paymentNote: 'في الأسبوع الثالث من ديسمبر والأسبوع الأول من فبراير والأسبوع الثالث من إبريل.',
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

const { docs: forms } = await payload.find({
  collection: 'forms',
  where: { title: { equals: FORM_TITLE } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const form = forms[0]
if (!form) throw new Error('bridge: run seed/bridge-application-form.ts first')

const en = content.en
const afterEn = await payload.update({
  collection: 'programmes',
  id: programme.id,
  locale: 'en',
  overrideAccess: true,
  depth: 0,
  data: {
    title: en.title,
    tagline: null,
    overview: en.overview,
    highlights: [],
    schedule_note: en.schedule_note,
    testimonials: [],
    registration: {
      ...programme.registration,
      method: 'form',
      form: form.id,
      url: null,
      deadline: '2025-11-29',
    },
    pricing: {
      ...programme.pricing,
      options: [{ amount: 30000, default: true }],
      need_based_deductions: true,
      note: en.paymentNote,
      payment_plans: [
        {
          label: en.paymentPlan,
          installments: [{ amount: 10000 }, { amount: 10000 }, { amount: 10000 }],
        },
      ],
    },
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
    tagline: null,
    overview: ar.overview,
    schedule_note: ar.schedule_note,
    // Components come from the archive import with English labels only; the
    // label is required in every locale, so the Arabic one is written here.
    components: await Promise.all(
      (afterEn.components ?? []).map(async (c) => {
        const id = typeof c.cycle === 'object' && c.cycle ? c.cycle.id : c.cycle
        const cycle = await payload.findByID({
          collection: 'cycles',
          id,
          depth: 0,
          overrideAccess: true,
        })
        const season = SEASON_AR[cycle.season as keyof typeof SEASON_AR]
        const year = String(cycle.start_year).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
        const kind = c.course_types?.includes('CORE')
          ? 'المقررات الأساسية'
          : 'المقررات الموضوعية والمعامل'
        return { ...c, label: `${kind}، ${season} ${year}` }
      }),
    ),
    // The plan's label and the note are per language; the amounts are shared.
    pricing: {
      ...afterEn.pricing,
      note: ar.paymentNote,
      payment_plans: (afterEn.pricing?.payment_plans ?? []).map((plan) => ({
        ...plan,
        label: ar.paymentPlan,
      })),
    },
  },
})

console.log(`bridge: ${SLUG} written in en and ar, applying through form ${form.id}`)
process.exit(0)
