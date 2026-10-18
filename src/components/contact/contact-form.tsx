'use client'

import { useTranslations } from 'next-intl'

import { ContactSection } from '@/components/arc/blocks/contact-section/contact-section'
import { useSpamCheck } from '@/components/forms/spam-check'

/**
 * The contact page's form: Arc's contact section in the page's language,
 * sending to the Contact form in Payload. Its topics are the form's own,
 * so admins change them in Forms.
 */
export function ContactForm({
  formId,
  topics,
  email,
  flush = false,
}: {
  formId: number
  topics: string[]
  email: string | null
  /** In the page's gutter, as on the home page, rather than in its own width. */
  flush?: boolean
}) {
  const t = useTranslations('Contact')
  const spam = useSpamCheck()
  return (
    <ContactSection
      description={t('text')}
      email={email}
      flush={flush}
      labels={{
        form: t('title'),
        name: t('name'),
        namePlaceholder: t('namePlaceholder'),
        email: t('email'),
        emailPlaceholder: t('emailPlaceholder'),
        topic: t('topic'),
        message: t('message'),
        messagePlaceholder: t('messagePlaceholder'),
        charactersLeft: (count) => t('charactersLeft', { count }),
        fine: t('fine'),
        send: t('send'),
        failed: t('failed'),
        thanks: (name) => t('thanks', { name }),
        sentText: (topic, address) => t('sent', { topic, email: address }),
        another: t('another'),
        nameMissing: t('nameMissing'),
        emailMissing: t('emailMissing'),
        emailInvalid: t('emailInvalid'),
        messageMissing: t('messageMissing'),
        messageShort: t('messageShort'),
        replyFact: t('replyFact'),
        copyEmail: t('copyEmail'),
        copied: t('copied'),
      }}
      formExtra={spam.fields}
      onSubmit={async (message) => {
        if (spam.isBot()) return
        try {
          const res = await fetch('/api/form-submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await spam.headers()) },
            body: JSON.stringify({
              form: formId,
              submissionData: (['name', 'email', 'topic', 'message'] as const).map((field) => ({
                field,
                value: message[field],
              })),
            }),
          })
          // The section shows its failure note and keeps what was written.
          if (!res.ok) throw new Error(`Contact form: ${res.status}`)
        } finally {
          spam.reset()
        }
      }}
      title={t('title')}
      topics={topics}
      variant="form"
    />
  )
}
