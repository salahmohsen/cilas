'use client'

import { useLocale, useTranslations } from 'next-intl'

import {
  NewsletterSignup,
  type NewsletterPublication,
} from '@/components/arc/blocks/newsletter-signup/newsletter-signup'
import { localDigits } from '@/lib/digits'
import { subscribeToNewsletter } from '@/lib/newsletter-subscribe'

/**
 * The newsletter signup at the end of an article or a course: a panel as wide
 * as the text, the form beside the last issues (src/api/newsletter-stack.api.ts);
 * where the column is narrow, the form alone.
 */
export function NewsletterSignupSection({
  publication,
}: {
  publication: NewsletterPublication | null
}) {
  const t = useTranslations('NewsletterSignup')
  const f = useTranslations('Footer.newsletter')
  const locale = useLocale()
  // The site writes numbers in the page's own digits.
  const digits = (n: number) => localDigits(n, locale)
  return (
    <NewsletterSignup
      buttonLabel={f('subscribe')}
      className="not-prose mt-16"
      description={t('description')}
      onSubscribe={subscribeToNewsletter}
      placeholder={f('placeholder')}
      privacyLink={null}
      privacyNote={t('privacy')}
      publication={publication}
      readers={null}
      text={{
        empty: f('empty'),
        format: f('invalid'),
        failed: f('failed'),
        done: f('done'),
        subscribed: f('subscribed'),
        emailLabel: t('emailLabel'),
        retry: t('retry'),
        sending: t('sending'),
        again: t('again'),
        sentTo: (email) => t('sentTo', { email }),
        issue: (number) => t('issue', { number: digits(number) }),
        issueLabel: (name, number) => t('issueLabel', { name, number: digits(number) }),
        to: t('to'),
        minutes: (minutes) => t('minutes', { minutes: digits(minutes) }),
      }}
      title={t('title')}
      variant="panel"
    />
  )
}
