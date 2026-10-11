'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'

import { ThemeSwitch } from '@/components/arc/theme-switch/theme-switch'
import { Link, usePathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

/**
 * Switches the site language, staying on the same page (ADR 0006). The
 * choice is remembered by next-intl's locale cookie.
 */
export function LanguageSwitch() {
  const t = useTranslations('Language')
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale

  return (
    <Link
      aria-label={t('switchToLabel')}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
      href={search ? `${pathname}?${search}` : pathname}
      hrefLang={other}
      lang={other}
      locale={other}
    >
      {t('switchTo')}
    </Link>
  )
}

/**
 * One icon that morphs between sun and moon. Until the visitor picks, the
 * theme follows the system (next-themes' `system`); a click stores the
 * opposite of what is showing.
 */
export function ThemeToggle() {
  const t = useTranslations('Theme')
  const { resolvedTheme, setTheme } = useTheme()
  // The resolved theme exists only in the browser; keep the slot until hydrated.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  if (!mounted || !resolvedTheme) return <span aria-hidden className="inline-block size-8" />
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  return (
    <ThemeSwitch
      iconOnly
      label={theme === 'dark' ? t('toLight') : t('toDark')}
      onThemeChange={(next) => setTheme(next)}
      theme={theme}
    />
  )
}
