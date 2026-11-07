import { relId } from '@/lib/relation'
import type { BeforeEmail } from '@payloadcms/plugin-form-builder/types'
import { resolveRichTextReferences } from '@/api/rich-text-references.api'
import { emailRichTextHTML } from '@/emails/rich-text'
import { env } from '@/env'

export const formEmailRichText: BeforeEmail = async (emails, params) => {
  const { data, req } = params
  const formId = relId(data?.form)
  if (!formId) return emails
  const form = await req.payload.findByID({
    collection: 'forms',
    id: formId,
    req,
    overrideAccess: false,
    depth: 1,
  })
  const locale = req.locale === 'ar' ? 'ar' : 'en'
  const references = await resolveRichTextReferences(req.payload, form.emails, {
    locale,
    user: null,
  })
  const values = new Map<string, string>(
    (data?.submissionData ?? []).map((row: { field: string; value: unknown }) => [
      row.field,
      String(row.value ?? ''),
    ]),
  )
  const doc = 'doc' in params ? (params.doc as { id?: unknown } | undefined) : undefined
  values.set('formSubmissionID', String(doc?.id ?? data?.id ?? ''))
  const substitute = (value: unknown): unknown => {
    if (typeof value === 'string')
      return value.replace(
        /\{\{\s*([^{}]+?)\s*\}\}/g,
        (match, field: string) => values.get(field) ?? match,
      )
    if (Array.isArray(value)) return value.map(substitute)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, substitute(child)]),
      )
    return value
  }
  return emails.map((email, index) => {
    const message = form.emails?.[index]?.message
    if (!message || typeof message !== 'object' || !('root' in message)) return email
    const html = emailRichTextHTML(
      substitute(message),
      references,
      env.NEXT_PUBLIC_SERVER_URL,
      locale,
    )
    return { ...email, html }
  })
}
