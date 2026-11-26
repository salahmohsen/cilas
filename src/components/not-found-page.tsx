import { getTranslations } from 'next-intl/server'

import button from '@/components/arc/button/button.module.css'
import { NotFoundEyes } from '@/components/not-found-eyes'
import { Link } from '@/i18n/navigation'

/** What every `notFound()` shows, under the public frame and under the portal's. */
export async function NotFoundPage() {
  const t = await getTranslations('NotFound')
  return (
    <div className="mx-auto flex min-h-centered-page max-w-xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <NotFoundEyes />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-medium text-balance text-foreground">{t('title')}</h1>
        <p className="text-pretty text-(--text-secondary)">{t('text')}</p>
      </div>
      {/* A link dressed as Arc's primary button: it navigates, so it stays an <a>. */}
      <Link href="/" className={`${button.button} ${button.primary} ${button.md} no-underline`}>
        {t('home')}
      </Link>
    </div>
  )
}
