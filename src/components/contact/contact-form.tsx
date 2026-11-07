'use client'

import { useTranslations } from 'next-intl'

import { ContactSection } from '@/components/arc/blocks/contact-section/contact-section'
import { useSpamCheck } from '@/components/forms/spam-check'
import { track } from '@/lib/analytics/track'

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
        const res = await spam.submit({
          form: formId,
          submissionData: (['name', 'email', 'topic', 'message'] as const).map((field) => ({
            field,
            value: message[field],
          })),
        })
        if (!res) return
        if (!res.ok) throw new Error(`Contact form: ${res.status}`)
        // The topic is one of the form's own labels; the message and the sender are not sent.
        track('contact_submitted', topics.includes(message.topic) ? { topic: message.topic } : {})
      }}
      title={t('title')}
      topics={topics}
      variant="form"
    />
  )
}
