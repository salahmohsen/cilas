import { getTranslations } from 'next-intl/server'

import { cardWords } from '@/lib/og-card'

/** The site's card: the name, shared by the default card and the home page's. */
export const siteCardTitle = async ({ locale }: { locale: string }) => {
  const t = await getTranslations({ locale, namespace: 'Meta' })
  return { title: t('siteName') }
}

export const siteCardWords = cardWords({
  en: { action: 'Visit' },
  ar: { action: 'زُر الموقع' },
})
