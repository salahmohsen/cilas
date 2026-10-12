import { getPayload } from 'payload'
import type { Payload } from 'payload'

import { CONTACT_FORM_TITLE } from '../src/lib/contact'
import type { Form } from '../src/payload-types'
import { getOrCreateId } from './seed.utils'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })

/**
 * One-off: the contact form behind /contact. Four fields (name, email, a
 * topic, the message); messages arrive in Form Submissions, and each is
 * emailed to the site's info address with the sender as reply-to. Admins
 * edit the topics, the confirmation and the email in Forms. Idempotent: the
 * form is found by title and rewritten.
 *
 *   npx tsx seed/contact-form.ts
 */

type Fields = NonNullable<Form['fields']>

const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
const inbox = settings.contact_emails?.info ?? 'info@ci-las.org'

const lexical = (paragraphs: string[], direction: 'ltr' | 'rtl' = 'ltr') => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction,
    children: paragraphs.map((t) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction,
      textFormat: 0,
      children: [
        { type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
      ],
    })),
  },
})

const TOPICS = [
  { value: 'general', en: 'A question', ar: 'سؤال' },
  { value: 'admissions', en: 'Applying', ar: 'التقديم' },
  { value: 'teaching', en: 'Teaching at CILAS', ar: 'التدريس في سيلاس' },
  { value: 'press', en: 'Press', ar: 'الصحافة' },
  { value: 'support', en: 'Supporting CILAS', ar: 'دعم سيلاس' },
]

const fieldsIn = (locale: 'en' | 'ar'): Fields =>
  [
    {
      blockType: 'text',
      name: 'name',
      label: locale === 'en' ? 'Name' : 'الاسم',
      required: true,
      width: 50,
    },
    {
      blockType: 'email',
      name: 'email',
      label: locale === 'en' ? 'Email' : 'البريد الإلكتروني',
      required: true,
      width: 50,
    },
    {
      blockType: 'select',
      name: 'topic',
      label: locale === 'en' ? 'Topic' : 'الموضوع',
      required: true,
      width: 100,
      defaultValue: 'general',
      options: TOPICS.map((t) => ({ value: t.value, label: t[locale] })),
    },
    {
      blockType: 'textarea',
      name: 'message',
      label: locale === 'en' ? 'Message' : 'الرسالة',
      required: true,
      width: 100,
    },
  ] as Fields

const confirmation = {
  en: lexical(['Thank you. Your message has reached CILAS; we will reply by email.']),
  ar: lexical(['شكرًا لك. وصلت رسالتك إلى سيلاس، وسنرد عليك بالبريد الإلكتروني.'], 'rtl'),
}

// The message as the form received it: every field, in a table.
const emails = (locale: 'en' | 'ar') => [
  {
    emailTo: inbox,
    replyTo: '{{email}}',
    subject:
      locale === 'en'
        ? 'Website message from {{name}}: {{topic}}'
        : 'رسالة من الموقع من {{name}}: {{topic}}',
    message: lexical(['{{*:table}}'], locale === 'en' ? 'ltr' : 'rtl') as never,
  },
]

const formId = await getOrCreateId(
  payload,
  'forms',
  { title: { equals: CONTACT_FORM_TITLE } },
  () =>
    payload.create({
      collection: 'forms',
      locale: 'en',
      overrideAccess: true,
      data: {
        title: CONTACT_FORM_TITLE,
        fields: fieldsIn('en'),
        confirmationType: 'message',
        confirmationMessage: confirmation.en as never,
      },
    }),
)

// English first; the Arabic keeps the same rows (by id) and changes only their words.
const en = await payload.update({
  collection: 'forms',
  id: formId,
  locale: 'en',
  overrideAccess: true,
  data: {
    fields: fieldsIn('en'),
    submitButtonLabel: 'Send message',
    confirmationType: 'message',
    confirmationMessage: confirmation.en as never,
    emails: emails('en'),
  },
})
const ar = fieldsIn('ar')
await payload.update({
  collection: 'forms',
  id: formId,
  locale: 'ar',
  overrideAccess: true,
  data: {
    fields: (en.fields ?? []).map((f, i) => {
      const words = ar[i] as Record<string, unknown>
      const options =
        'options' in f && f.options
          ? f.options.map((o, j) => ({
              ...o,
              label: (words.options as { label: string }[])[j]!.label,
            }))
          : undefined
      return { ...f, label: words.label, ...(options ? { options } : {}) } as Fields[number]
    }),
    submitButtonLabel: 'أرسل الرسالة',
    confirmationMessage: confirmation.ar as never,
    emails: (en.emails ?? []).map((e, i) => ({ ...e, ...emails('ar')[i] })),
  },
})

console.log(`form: ${CONTACT_FORM_TITLE} (${formId}), emailing ${inbox}`)
process.exit(0)
