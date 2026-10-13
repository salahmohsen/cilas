import type { Payload } from 'payload'

/** The home page's questions, from Site settings, in the page's language. */
export const getHomeFaq = async (payload: Payload, locale: 'en' | 'ar') => {
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, locale, fallbackLocale: 'en' })
  return (settings.faq ?? [])
    .filter((f) => f.question && f.answer)
    .map((f, i) => ({ id: f.id ?? `faq-${i}`, question: f.question, answer: f.answer }))
}
