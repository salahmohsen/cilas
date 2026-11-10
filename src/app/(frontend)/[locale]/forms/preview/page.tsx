import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { RenderedForm } from '@/components/forms/rendered-form'
import { localeOf } from '@/i18n/routing'
import { previewWhere } from '@/lib/preview-access'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function FormPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ form?: string }>
}) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const canUpdate = await previewWhere(payload, 'forms', user)
  if (!canUpdate) notFound()

  const { form: id } = await searchParams
  if (!id) notFound()
  const { locale } = await params
  const { docs } = await payload.find({
    collection: 'forms',
    where: { and: [{ id: { equals: id } }, canUpdate] },
    locale: localeOf(locale),
    fallbackLocale: 'en',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    user,
  })
  const form = docs[0]
  if (!form) notFound()

  return (
    <div className="apply-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="course-title mb-8">{form.title}</h1>
      <RenderedForm form={form} lang={localeOf(locale)} preview />
    </div>
  )
}
