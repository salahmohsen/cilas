import config from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import { isAdminUser } from '@/access'
import { issueForEmail } from '@/emails/issue'
import { newsletterMail } from '@/emails/newsletter'
import { EMAILS, type EmailId, type VersionOf } from '@/emails/catalog'
import { sampleMail } from '@/emails/samples'
import { getEmailSettings, readEmailSettings, withDefaults } from '@/emails/settings'
import { env } from '@/env'

/**
 * Admin-only preview of a newsletter issue (its latest draft) for the
 * live-preview pane. The script reloads the page when Payload saves, as
 * RefreshRouteOnSave does. Email settings previews use POST, below.
 */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!isAdminUser(user)) return new Response('Admins only', { status: 403 })

  const url = new URL(request.url)
  const settings = await getEmailSettings(payload)
  const site = env.NEXT_PUBLIC_SERVER_URL
  let html: string
  // The visual editor's site SDK, for a newsletter only (scripts/visual-editor-sdk.mjs).
  let editor = ''

  if (url.searchParams.get('kind') === 'newsletter') {
    const id = Number(url.searchParams.get('id'))
    if (!url.searchParams.get('id') || !Number.isInteger(id)) {
      return new Response('Save the issue to see its preview.', { status: 404 })
    }
    const issue = await issueForEmail(payload, id)
    html = (await newsletterMail(issue, settings, { unsubscribe: '#unsubscribe', editId: id })).html
    editor = 'sdk'
  } else {
    return new Response('Unknown preview.', { status: 404 })
  }

  const origin = JSON.stringify(site.replace(/\/+$/, ''))
  const reload = `<script>
    window.parent.postMessage({ type: 'payload-live-preview', ready: true }, ${origin});
    window.addEventListener('message', (e) => {
      if (e.origin === ${origin} && e.data && e.data.type === 'payload-document-event') location.reload();
    });
  </script>`
  const sdk = editor
    ? `<script type="module">
    import { initVisualEditing } from '/assets/visual-editor/sdk.js';
    if (window.self !== window.top) initVisualEditing({ serverURL: ${origin}, draft: true });
  </script>`
    : ''
  const scripts = reload + sdk
  const page = html.includes('</body>')
    ? html.replace('</body>', `${scripts}</body>`)
    : html + scripts
  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

type PreviewRequest = {
  email: EmailId
  version: string
  locale: 'en' | 'ar'
  /** The email's texts as typed, saved or not. Empty: the default. */
  texts: Record<string, string | null>
  /** Send it to the signed-in admin instead of returning it. */
  send?: boolean
}

/**
 * One email of Email settings with sample data and the texts as typed, for
 * the preview beside its fields, or sent to the admin as a test.
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user || !isAdminUser(user)) return Response.json({ error: 'Admins only' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as PreviewRequest | null
  const entry = body && Object.hasOwn(EMAILS, body.email) ? EMAILS[body.email] : null
  if (!body || !entry || !Object.hasOwn(entry.versions, body.version))
    return Response.json({ error: 'Unknown email.' }, { status: 400 })
  const locale = entry.localized && body.locale === 'ar' ? 'ar' : 'en'

  const { stored, ...rest } = await readEmailSettings(payload, undefined, locale)
  const settings = withDefaults(
    { ...stored, texts: { ...stored.texts, [body.email]: body.texts ?? {} } },
    { site: env.NEXT_PUBLIC_SERVER_URL, ...rest },
  )
  const mail = await sampleMail(body.email, body.version as VersionOf<EmailId>, {
    payload,
    settings,
    locale,
  })
  if (!mail)
    return Response.json({ error: 'There is no newsletter issue to show yet.' }, { status: 404 })
  if (body.send) {
    await payload.sendEmail({
      to: user.email,
      subject: `[Test] ${mail.subject}`,
      html: mail.html,
      text: mail.text,
    })
    return Response.json({ sent: user.email })
  }
  return Response.json({ subject: mail.subject, html: mail.html })
}
