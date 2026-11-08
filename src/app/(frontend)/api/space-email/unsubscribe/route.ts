import config from '@payload-config'
import { getPayload } from 'payload'

import { env } from '@/env'
import { setSpaceEmail } from '@/lib/space-email-prefs'
import { verifyUnsubscribeToken } from '@/lib/space-email-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Lang = 'en' | 'ar'

const TEXT = {
  en: {
    confirmTitle: 'Stop all space email?',
    confirmBody:
      'You will get no digests and no announcement emails from any CILAS space. Notifications on the site stay as they are. You can turn email back on in your settings.',
    confirmButton: 'Stop all space email',
    doneTitle: 'Space email stopped',
    doneBody:
      'You will get no more email from CILAS spaces. To turn it back on, open Settings and choose Notifications.',
    badTitle: 'This link does not work',
    badBody:
      'Use the link in the latest space email, or change this in your settings under Notifications.',
    settings: 'Open settings',
  },
  ar: {
    confirmTitle: 'إيقاف كل بريد المساحات؟',
    confirmBody:
      'لن يصلك ملخص ولا بريد إعلانات من أي مساحة في سيلاس. تبقى الإشعارات في الموقع كما هي. يمكنك إعادة تشغيل البريد من إعداداتك.',
    confirmButton: 'أوقف كل بريد المساحات',
    doneTitle: 'توقف بريد المساحات',
    doneBody: 'لن يصلك بريد آخر من مساحات سيلاس. لإعادة تشغيله افتح الإعدادات واختر الإشعارات.',
    badTitle: 'هذا الرابط لا يعمل',
    badBody: 'استخدم الرابط في آخر بريد وصلك من المساحات، أو غيّر ذلك من إعداداتك في الإشعارات.',
    settings: 'افتح الإعدادات',
  },
} as const

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const page = (lang: Lang, state: 'confirm' | 'done' | 'bad', action: string, status = 200) => {
  const t = TEXT[lang]
  const title = t[`${state}Title` as const]
  const body = t[`${state}Body` as const]
  const settings = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/${lang}/settings#notifications`
  const control =
    state === 'confirm'
      ? `<form method="post" action="${escape(action)}"><button type="submit">${t.confirmButton}</button></form>`
      : `<a href="${escape(settings)}">${t.settings}</a>`
  const html = `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:Canvas;color:CanvasText}
main{max-width:28rem}
h1{font-size:1.5rem;margin:0 0 .75rem}
p{line-height:1.6;margin:0 0 1.5rem}
button,a{display:inline-block;font:inherit;padding:.75rem 1.25rem;border-radius:.5rem;border:1px solid CanvasText;background:CanvasText;color:Canvas;text-decoration:none;cursor:pointer}
</style>
</head>
<body><main><h1>${title}</h1><p>${body}</p>${control}</main></body>
</html>`
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    },
  })
}

const read = (request: Request) => {
  const url = new URL(request.url)
  const lang: Lang = url.searchParams.get('l') === 'ar' ? 'ar' : 'en'
  const token = url.searchParams.get('t')
  return {
    lang,
    token,
    account: verifyUnsubscribeToken(token),
    action: `${url.pathname}${url.search}`,
  }
}

/**
 * The link in every space email. A GET only shows a confirmation, because mail
 * scanners and previews follow links and must not stop anyone's email.
 */
export async function GET(request: Request) {
  const { lang, account, action } = read(request)
  return account === null ? page(lang, 'bad', action, 400) : page(lang, 'confirm', action)
}

/**
 * Stops all space email for the account the signed token names: the button on
 * the confirmation page, and the one-click POST that mail clients send for the
 * List-Unsubscribe-Post header (RFC 8058). No session is needed; the token is
 * the proof.
 */
export async function POST(request: Request) {
  const { lang, account, action } = read(request)
  if (account === null) return page(lang, 'bad', action, 400)
  try {
    await setSpaceEmail(await getPayload({ config }), account, { stopped: true })
  } catch {
    return page(lang, 'bad', action, 500)
  }
  return page(lang, 'done', action)
}
