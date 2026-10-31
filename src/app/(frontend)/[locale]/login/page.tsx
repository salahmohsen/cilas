import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { LoginForm, type LoginMessages } from '@/components/login/login-form'
import { env } from '@/env'
import { currentReader } from '@/lib/reader'
import { safeNext } from '@/lib/safe-next'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Login')
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * One login for the site and the admin panel: /admin/login is sent here
 * (src/proxy.ts). `next` is where to go after, e.g. an admin page or an article.
 */
export default async function LoginPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  // No `next` (the header's "Sign in"): My spaces, for every kind of account.
  const next = safeNext(query.next ?? `/${locale}/spaces`)
  if (await currentReader()) redirect(next)

  const t = await getTranslations('Login')
  const keys = [
    'title',
    'intro',
    'google',
    'or',
    'email',
    'password',
    'submit',
    'forgot',
    'wrong',
    'googleRefused',
    'failed',
    'showPassword',
    'hidePassword',
  ] as const
  const messages = Object.fromEntries(keys.map((k) => [k, t(k)])) as LoginMessages

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <LoginForm
        googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
        googleError={query.error === 'google'}
        messages={messages}
        next={next}
      />
    </div>
  )
}
