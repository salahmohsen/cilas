import type { Payload } from 'payload'

import { CONTACT_FORM_TITLE } from '@/lib/contact'

/** The Contact form, its topics in the page's language, and the address shown beside it. */
export const getContactForm = async (payload: Payload, locale: 'en' | 'ar') => {
  const [{ docs }, settings] = await Promise.all([
    payload.find({
      collection: 'forms',
      where: { title: { equals: CONTACT_FORM_TITLE } },
      limit: 1,
      depth: 0,
      locale,
      fallbackLocale: 'en',
    }),
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
  ])
  const form = docs[0]
  if (!form) return null
  const topic = form.fields?.find((f) => f.blockType === 'select' && f.name === 'topic')
  return {
    formId: form.id,
    topics: topic && 'options' in topic ? (topic.options ?? []).map((o) => o.label) : [],
    email: settings.contact_emails?.info ?? null,
  }
}
