import path from 'path'
import { questionDescription } from '../src/migrations/lib/question-description'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import type { Form } from '../src/payload-types'
import { FORM_TITLE } from './bridge-application-form.meta'
import { getOrCreateId } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the Bridge Programme application form, rebuilt from the Google
 * Form "CILAS Application Form 2025-2026" with its questions, help texts,
 * choices and required marks as written. The questions stay in English in
 * both languages, as the form asks applicants to answer in English. The two
 * essay images are the ones the form showed. Idempotent: the form is found by
 * title and its fields rewritten.
 *
 *   npx tsx seed/bridge-application-form.ts
 */

const ASSETS = path.resolve(import.meta.dirname, 'assets/bridge-application')

const image = (file: string, alt: string) =>
  getOrCreateId(payload, 'media', { alt: { equals: alt } }, () =>
    payload.create({
      collection: 'media',
      data: { alt },
      filePath: `${ASSETS}/${file}`,
      overrideAccess: true,
    }),
  )

const cartoon = await image(
  'cartoon-home-happy.jpg',
  'Cartoon: a woman arrives late to an office meeting and says, “Sorry I’m late. I got caught up at home being happy.”',
)
const reflection = await image(
  'reflection-eyeofnorus.jpg',
  'Illustration by @eyeofnorus: a pink bird with a long tongue reaches into a beehive hanging from a blue tree, a sword on the grass below.',
)

type Fields = NonNullable<Form['fields']>
const lexical = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((t) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      textFormat: 0,
      children: [
        { type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
      ],
    })),
  },
})

const text = (name: string, label: string, description?: string, required = true) =>
  ({
    blockType: 'text',
    name,
    label,
    description: description ? questionDescription(description) : undefined,
    required,
    width: 100,
  }) as Fields[number]
const long = (
  name: string,
  label: string,
  description?: string,
  extra: { image?: number; minWords?: number } = {},
) =>
  ({
    blockType: 'textarea',
    name,
    label,
    description: description ? questionDescription(description) : undefined,
    required: true,
    width: 100,
    ...extra,
  }) as Fields[number]
const options = (values: string[]) =>
  values.map((label) => ({
    label,
    value: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  }))

const fields: Fields = [
  text(
    'song',
    'A song',
    'Please introduce yourself through a song. Copy and paste a link into the box below. Note that we will compile these songs into a playlist and share it with all accepted students before the beginning of the program.',
  ),
  text(
    'name',
    'Your name',
    'Please state your full name and, should you have one, a name you prefer to be called by.',
  ),
  long(
    'two_truths',
    'Two truths and a lie',
    "Tell us two truths and one lie about yourself. Don't indicate which is which.",
  ),
  text(
    'phone',
    'Phone number',
    'Please indicate also if this is the same number you use on WhatsApp. If not, would you mind sharing your WhatsApp number?',
  ),
  text(
    'address',
    'Home Address (from your ID)',
    'This will help us assess your primary place of residence which we can take into account to assess your financial need/ability.',
  ),
  text(
    'email',
    'Email',
    'How often do you usually check your e-mail? Would you prefer to be notified about a potential interview via WhatsApp or phone?',
  ),
  {
    blockType: 'checkboxGroup',
    name: 'heard_from',
    label: 'How did you know about CILAS?',
    required: true,
    width: 100,
    options: options(['Facebook', 'Instagram', 'Website', 'A friend', 'Other']),
  } as Fields[number],
  {
    blockType: 'radio',
    name: 'high_school',
    label: 'High school attendance',
    required: true,
    width: 100,
    options: options([
      'International school in Egypt or abroad',
      'Private school in Egypt or abroad',
      'Experimental school in Egypt',
      'Public (government) school in Egypt or abroad',
    ]),
  } as Fields[number],
  text('high_school_name', 'Name of your high school'),
  long(
    'english',
    'English comfort level',
    "How comfortable do you feel reading, listening to and communicating in English? This will help us assign additional resources to supporting you with reading and writing assignments. Please feel free to elaborate. You can share if you feel more comfortable reading and writing over listening and speaking, or the other way around. You can mention if and what you have written in English, e.g. letters, essays, comments on social media, or whether you're used to watching English-language movies with subtitles, etc.",
  ),
  long(
    'arabic',
    'Arabic comfort level',
    "How comfortable do you feel reading, listening to and communicating in Arabic? Sometimes class discussions mix English and Egyptian Arabic. Rest assured, however, that everything gets translated in the end. Also let us know if you're learning or are interested in learning Arabic, or if you have any experience writing fiction, journalism or poetry in Arabic, and have experience translating from English to Arabic or from Arabic to English.",
  ),
  long('work', 'If you work, what is the field of your work?'),
  long(
    'education',
    'Educational level',
    'Have you obtained any post-secondary (after high school) degrees or certificates? Please mention in what field and what degree, in which year and from which institution.',
  ),
  long(
    'interest',
    'How would you describe your interest in CILAS?',
    'What have you heard about CILAS? How do you understand the liberal arts? Why are you applying for a programme in the liberal arts at this point of your life? Please address these questions in at least two paragraphs.',
  ),
  long('books', 'Name three books (fiction and non-fiction) you read, and you related to?'),
  {
    blockType: 'message',
    message: lexical([
      'Breather',
      "The next section will ask you to write short essays. We recommend that you write it in a Word document and copy it over when you're done. Enjoy!",
    ]),
  } as Fields[number],
  long(
    'cartoon_essay',
    'A cartoon-based essay',
    "Write a short essay of 250 words based on the cartoon below. There is no boxes to tick, no right interpretation to offer, no particular answer to give. Rather you're invited to share your thoughts on and how you related or did not relate to this image, the/your notion of home, and happiness, jobs and work. For instance, home could refer to your living space, your personal space, your home country. Be creative!",
    { image: cartoon, minWords: 250 },
  ),
  long(
    'reflection',
    'A reflection piece',
    'When you look and ponder at this image what ideas, thoughts, feelings, reflections, and stories come up for you? Express that in a way you like; write about it in a paragraph, a story, a poem or draw something in response. Let your mind wander!\n\nIllustration credits: @eyeofnorus on instagram',
    { image: reflection },
  ),
  long(
    'jahin',
    'Below is a link for a part of (رباعيات صلاح جاهين). Enjoy listening, choose one, and let us know about your thoughts and feelings regarding it through writing.',
    'https://on.soundcloud.com/xzdsM',
  ),
  long(
    'review_essay',
    'A review-based essay',
    'Write a short, analytical essay of 250 words based on an article in English or Arabic of your interest. This could also be a book chapter and should be no less than a 1000 words long. You might find an interesting article on the following websites: https://aeon.co/; https://www.jadaliyya.com/; https://www.newyorker.com/; https://www.vice.com/ar; https://madamasr.com/en; https://thepointmag.com/; https://jacobinmag.com/, or on any website, outlet or publication of your choice. In this essay share with us how this article is of interest to you, how you relate to it and what you learned from it. Please share with us the source, author and title of the article or book chapter you chose.',
    { minWords: 250 },
  ),
  {
    blockType: 'checkboxGroup',
    name: 'schedule',
    label: 'Last but not least',
    required: true,
    width: 100,
    description: questionDescription(
      'Tell us about your schedule preference and confirm your commitment to attending 80% of classes ready and keen to share your ideas and questions as well as to take turns at framing and moderating discussions.',
    ),
    options: [
      {
        label:
          "I am a 'morning bird' that is willing to commit to the morning track from 10:30am to 1:30pm. on Saturday, Tuesdays, and Thursday.",
        value: 'morning',
      },
      {
        label:
          "I am a 'night owl' that is willing to commit to the evening track from 5:30pm to 8:30pm. on Saturday, Tuesdays, and Thursday.",
        value: 'evening',
      },
    ],
  } as Fields[number],
  text('remarks', 'Questions, Doubts or Remarks', undefined, false),
]

const confirmation = {
  en: lexical([
    'Thank you for applying to the Bridge Programme. We review applications carefully and on a rolling basis, and will be in touch about an interview.',
    'To apply for a partial scholarship, write to admissions@ci-las.org.',
  ]),
  ar: {
    ...lexical([
      'شكرًا لتقديمك إلى برنامج الجسر. نراجع الاستمارات بعناية وأولًا بأول، وسنتواصل معك بشأن المقابلة.',
      'للتقديم على منحة جزئية، راسلنا على admissions@ci-las.org.',
    ]),
  },
}
confirmation.ar.root.direction = 'rtl' as never

const formId = await getOrCreateId(payload, 'forms', { title: { equals: FORM_TITLE } }, () =>
  payload.create({
    collection: 'forms',
    locale: 'en',
    overrideAccess: true,
    data: {
      title: FORM_TITLE,
      fields,
      submitButtonLabel: 'Send my application',
      confirmationType: 'message',
      confirmationMessage: confirmation.en as never,
    },
  }),
)

// Fields first in English; the Arabic keeps the same rows (by id) and only
// changes the words around them.
const en = await payload.update({
  collection: 'forms',
  id: formId,
  locale: 'en',
  overrideAccess: true,
  data: {
    fields,
    submitButtonLabel: 'Send my application',
    confirmationType: 'message',
    confirmationMessage: confirmation.en as never,
  },
})
await payload.update({
  collection: 'forms',
  id: formId,
  locale: 'ar',
  overrideAccess: true,
  data: {
    fields: en.fields,
    submitButtonLabel: 'أرسل طلبي',
    confirmationMessage: confirmation.ar as never,
  },
})

console.log(`form: ${FORM_TITLE} (${formId}) with ${fields.length} fields`)
process.exit(0)
