import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
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

/** The institute's info address, from Site settings (Contact → info, admissions as a fallback). */
export const getContactEmail = async (): Promise<string | null> => {
  const payload = await getPayload({ config })
  // Every share bar reads this: a failed read leaves the mail unaddressed, not the page broken.
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  const emails = settings?.contact_emails
  return emails?.info ?? emails?.admissions ?? null
}
