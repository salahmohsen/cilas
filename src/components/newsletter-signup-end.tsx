import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getNewsletterStack } from '@/api/newsletter-stack.api'
import { NewsletterSignupSection } from '@/components/newsletter-signup-section'

export async function NewsletterSignupEnd({ locale }: { locale: Locale }) {
  const [payload, t] = await Promise.all([
    getPayload({ config }),
    getTranslations({ locale, namespace: 'NewsletterSignup' }),
  ])
  const stack = await getNewsletterStack(payload, locale, {
    name: t('name'),
    next: t('next'),
    nextSubject: t('nextSubject'),
  })
  return stack ? <NewsletterSignupSection publication={stack.publication} /> : null
}
