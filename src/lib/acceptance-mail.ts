/**
 * The email an accepted applicant gets, in both of the site's languages: the
 * submission does not record which one they applied in.
 */

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type AcceptanceMail = {
  name: string
  email: string
  /** What they were accepted to, in English and Arabic. */
  title: { en: string; ar: string }
  /** A new account was made for them; an existing one signs in as before. */
  newAccount: boolean
  /** The site's origin, e.g. https://ci-las.org. */
  site: string
}

export const acceptanceEmail = ({ name, email, title, newAccount, site }: AcceptanceMail) => {
  const origin = site.replace(/\/+$/, '')
  const en = { login: `${origin}/en/login`, name: escape(name), title: escape(title.en) }
  const ar = { login: `${origin}/ar/login`, name: escape(name), title: escape(title.ar || title.en) }
  const address = escape(email)

  const english = newAccount
    ? `<p>We made a CILAS account for ${address}. To sign in, go to <a href="${en.login}">${en.login}</a>. If this is a Google address, use “Continue with Google”. If not, choose “Forgot password?” to set a password.</p>`
    : `<p>Sign in with your CILAS account as usual at <a href="${en.login}">${en.login}</a>.</p>`
  const arabic = newAccount
    ? `<p>أنشأنا حسابًا في سيلاس للعنوان ${address}. لتسجيل الدخول، اذهب إلى <a href="${ar.login}">${ar.login}</a>. إذا كان هذا عنوان Google، فاستخدم «المتابعة باستخدام Google». وإلا فاختر «نسيت كلمة المرور؟» لتعيين كلمة مرور.</p>`
    : `<p>سجّل الدخول بحسابك في سيلاس كالمعتاد من <a href="${ar.login}">${ar.login}</a>.</p>`

  return {
    to: email,
    subject: `You are accepted to ${title.en} · تم قبولك في ${title.ar || title.en}`,
    html: `<div lang="en" dir="ltr"><p>Dear ${en.name},</p><p>You are accepted to ${en.title}.</p>${english}</div>
<hr>
<div lang="ar" dir="rtl"><p>عزيزي/عزيزتي ${ar.name}،</p><p>تم قبولك في ${ar.title}.</p>${arabic}</div>`,
  }
}
