import { LOGO, LOGO_VIEWBOX } from '@/components/home/home-scene-logo'

import { escapeHtml } from '@/lib/html-entities'

import type { Assistant } from './assistants'

const mark = `<svg aria-hidden="true" focusable="false" viewBox="${LOGO_VIEWBOX}" fill="currentColor" fill-rule="evenodd" width="28" height="48">${LOGO.map((shape) => `<path d="${shape.d}"/>`).join('')}</svg>`

/** The admin's neutral palette (src/app/(payload)/custom.css), light and dark. */
const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#09090b;--muted:#71717a;--line:#e4e4e7;--card:#fafafa;--primary:#18181b;--on-primary:#fafafa;--warn:#b45309}
@media (prefers-color-scheme:dark){:root{--bg:#09090b;--fg:#fafafa;--muted:#a1a1aa;--line:#27272a;--card:#18181b;--primary:#e4e4e7;--on-primary:#18181b;--warn:#fbbf24}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:34rem;margin:0 auto;padding:2.5rem 1rem 3rem}
.brand{display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem}
.brand span{font-size:1.1rem;font-weight:600;letter-spacing:.08em}
h1{font-size:1.4rem;line-height:1.3;margin:0 0 .5rem;font-weight:600}
p{margin:.5rem 0}
.muted{color:var(--muted);font-size:.9rem}
.box{border:1px solid var(--line);background:var(--card);border-radius:6px;padding:1rem 1.25rem;margin:1.25rem 0}
.box h2{font-size:1rem;margin:0 0 .5rem;font-weight:600}
.box ul{margin:0;padding-inline-start:1.25rem}
.box li{margin:.25rem 0}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
button,.btn{font:inherit;font-weight:600;min-height:2.75rem;padding:.55rem 1.4rem;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
button.allow{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
button:focus-visible,.btn:focus-visible,a:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
.warn{color:var(--warn)}
a{color:inherit}
`

const CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // 'no-referrer' would make the browser send `Origin: null` on the Allow
  // button, and Payload drops the session on a null origin.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': CSP,
}

const shell = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main><div class="brand">${mark}<span>CILAS</span></div>${body}</main></body></html>`

export const consentTitle = (assistant: Assistant) => `Let ${assistant.name} work on CILAS`

/** The plugin's own form: its hidden fields carry the one-use tokens. */
export const extractForm = (pluginHtml: string): string | null => {
  const match = /<form\b[^>]*>[\s\S]*?<\/form>/.exec(pluginHtml)
  const form = match?.[0]
  if (!form || !form.includes('name="csrf_token"') || !form.includes('value="approve"')) return null
  return form
    .replace(/>\s*Approve\s*</, '>Allow<')
    .replace(/>\s*Deny\s*</, '>Do not allow<')
    .replace(/class="btn btn-approve"/, 'class="allow"')
    .replace(/class="btn btn-deny"/, 'class="deny"')
}

export const renderConsentPage = ({
  assistant,
  email,
  pluginHtml,
  redirectHost,
}: {
  assistant: Assistant
  email: string
  pluginHtml: string
  redirectHost: string
}): Response => {
  const form = extractForm(pluginHtml)
  if (!form) {
    return renderRefusalPage({
      assistant,
      reason:
        'This page could not be shown. Nothing was shared. Try again, and tell a developer if it keeps happening.',
      status: 500,
    })
  }
  const body = `<h1>${escapeHtml(consentTitle(assistant))}?</h1>
<p>You are signed in as <strong>${escapeHtml(email)}</strong>. If you click Allow, ${escapeHtml(assistant.name)} can work on the CILAS website as you.</p>
<div class="box"><h2>${escapeHtml(assistant.name)} will be able to</h2><ul>
<li>look up courses, articles, forms and people (names and titles only, never emails or applications),</li>
<li>make a draft of a course or an article,</li>
<li>make a registration form and link it to a draft of a course.</li></ul></div>
<div class="box"><h2>It cannot</h2><ul>
<li>publish anything, delete anything, or change who can read a page,</li>
<li>see applications, emails or who enrolled.</li></ul>
<p class="muted">A person has to read each draft and publish it.</p></div>
${form}
<p class="muted">After you choose, you go back to ${escapeHtml(redirectHost)}. You can disconnect ${escapeHtml(assistant.name)} at any time: open Connected assistants in the CILAS admin and delete the row.</p>`
  return new Response(shell(consentTitle(assistant), body), { status: 200, headers })
}

export const renderRefusalPage = ({
  assistant,
  reason,
  status,
}: {
  assistant: Assistant
  reason: string
  status: number
}): Response => {
  const body = `<h1 class="warn">${escapeHtml(assistant.name)} cannot be connected</h1>
<p>${escapeHtml(reason)}</p>
<div class="actions"><a class="btn" href="/admin">Go to the CILAS admin</a></div>`
  return new Response(shell(`${assistant.name} cannot be connected`, body), { status, headers })
}
