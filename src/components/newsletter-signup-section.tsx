'use client'

import { useTranslations } from 'next-intl'

import {
  NewsletterSignup,
  type NewsletterPublication,
} from '@/components/arc/blocks/newsletter-signup/newsletter-signup'
import { subscribeToNewsletter } from '@/lib/newsletter-subscribe'

/**
 * The newsletter signup at the end of an article or a course: the card, with
 * the last issues stacked above the form (src/api/newsletter-stack.api.ts).
 */
export function NewsletterSignupSection({
  publication,
}: {
  publication: NewsletterPublication | null
}) {
  const t = useTranslations('NewsletterSignup')
  const f = useTranslations('Footer.newsletter')
  return (
    <NewsletterSignup
      buttonLabel={f('subscribe')}
      className="not-prose mt-12"
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
        issue: (number) => t('issue', { number }),
        issueLabel: (name, number) => t('issueLabel', { name, number }),
        to: t('to'),
        minutes: (minutes) => t('minutes', { minutes }),
      }}
      title={t('title')}
      variant="card"
    />
  )
}
