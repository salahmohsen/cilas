import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { ContactForm } from '@/components/contact/contact-form'
import { CONTACT_FORM_TITLE } from '@/lib/contact'

export const revalidate = 3600

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Contact')
  return { title: t('metaTitle'), description: t('text') }
}

/** Write to CILAS: the Contact form in Payload, shown with Arc's contact section. */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })
  const [{ docs }, settings] = await Promise.all([
    payload.find({
      collection: 'forms',
      where: { title: { equals: CONTACT_FORM_TITLE } },
      limit: 1,
      depth: 0,
      locale: locale as 'en' | 'ar',
      fallbackLocale: 'en',
    }),
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
  ])
  const form = docs[0]
  if (!form) notFound()
  const topicField = form.fields?.find((f) => f.blockType === 'select' && f.name === 'topic')
  const topics =
    topicField && 'options' in topicField ? (topicField.options ?? []).map((o) => o.label) : []

  return (
    <div className="contact-page">
      <ContactForm email={settings.contact_emails?.info ?? null} formId={form.id} topics={topics} />
    </div>
  )
}
