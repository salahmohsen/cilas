import { getTranslations } from 'next-intl/server'

import { NotFoundEyes } from '@/components/not-found-eyes'
import { Link } from '@/i18n/navigation'

/** Every `notFound()` under a language, and every path nothing else claims. */
export default async function NotFound() {
  const t = await getTranslations('NotFound')
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <NotFoundEyes />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium text-balance text-[var(--foreground)]">{t('title')}</h1>
        <p className="text-pretty text-[var(--text-secondary)]">{t('text')}</p>
      </div>
      <Link
        href="/"
        className="font-medium text-[var(--foreground)] underline underline-offset-4 hover:text-[var(--text-secondary)]"
      >
        {t('home')}
      </Link>
    </div>
  )
}
