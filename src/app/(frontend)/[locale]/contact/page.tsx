import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getContactForm } from '@/api/contact.api'
import { ContactForm } from '@/components/contact/contact-form'

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
  const contact = await getContactForm(payload, locale as 'en' | 'ar')
  if (!contact) notFound()
  return (
    <div className="contact-page">
      <ContactForm {...contact} />
    </div>
  )
}
