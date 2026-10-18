import config from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import { isAdminUser } from '@/access'
import { issueForEmail } from '@/emails/issue'
import { newsletterMail } from '@/emails/newsletter'
import { getEmailSettings } from '@/emails/settings'
import { acceptanceMail, resetMail, reviewMail } from '@/emails/transactional'
import { env } from '@/env'

const escapeAttr = (html: string) => html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/**
 * Admin-only email previews for the live-preview pane: a newsletter issue
 * (its latest draft) or every transactional email with sample data. The
 * script reloads the page when Payload saves, as RefreshRouteOnSave does.
 */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!isAdminUser(user)) return new Response('Admins only', { status: 403 })

  const url = new URL(request.url)
  const settings = await getEmailSettings(payload)
  const site = env.NEXT_PUBLIC_SERVER_URL
  let html: string

  if (url.searchParams.get('kind') === 'newsletter') {
    const id = Number(url.searchParams.get('id'))
    if (!url.searchParams.get('id') || !Number.isInteger(id)) {
      return new Response('Save the issue to see its preview.', { status: 404 })
    }
    const issue = await issueForEmail(payload, id)
    html = (await newsletterMail(issue, settings, { unsubscribe: '#unsubscribe' })).html
  } else {
    const sample = { name: 'Mona Adel', email: 'mona@example.com', site }
    const mails = await Promise.all([
      acceptanceMail(settings, { ...sample, title: 'The Bridge Programme 2026', newAccount: true }),
      reviewMail(settings, 'changes_requested', 'On translation', 'Please shorten the second part.'),
      resetMail(settings, { email: sample.email, token: 'sample-token', site }),
    ])
    html = `<!doctype html><html lang="en"><body style="margin:0;background:#f3f4f6">${mails
      .map(
        (m) =>
          `<h2 style="font:600 14px system-ui;margin:24px 16px 8px">${m.subject.replace(/</g, '&lt;')}</h2>` +
          `<iframe title="${escapeAttr(m.subject)}" style="width:100%;height:900px;border:0" srcdoc="${escapeAttr(m.html)}"></iframe>`,
      )
      .join('')}</body></html>`
  }

  const origin = JSON.stringify(site.replace(/\/+$/, ''))
  const reload = `<script>
    window.parent.postMessage({ type: 'payload-live-preview', ready: true }, ${origin});
    window.addEventListener('message', (e) => {
      if (e.origin === ${origin} && e.data && e.data.type === 'payload-document-event') location.reload();
    });
  </script>`
  const page = html.includes('</body>') ? html.replace('</body>', `${reload}</body>`) : html + reload
  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
