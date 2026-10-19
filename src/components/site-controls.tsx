'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

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
      className="site-control"
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
 * opposite of what is showing. The new theme spreads from the button in a
 * circle (Arc's reveal), unless the browser lacks view transitions or the
 * visitor asks for reduced motion.
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
  if (!mounted || !resolvedTheme) return <span aria-hidden className="inline-block size-9" />
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  return (
    <ThemeSwitch
      iconOnly
      label={theme === 'dark' ? t('toLight') : t('toDark')}
      onThemeChange={(next, _variant, trigger) => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (!document.startViewTransition || reduced) return setTheme(next)
        const { left, top, width, height } = trigger.getBoundingClientRect()
        const root = document.documentElement
        root.style.setProperty('--reveal-x', `${left + width / 2}px`)
        root.style.setProperty('--reveal-y', `${top + height / 2}px`)
        root.dataset.themeReveal = ''
        // next-themes writes the theme in an effect; flushSync runs it inside
        // the transition, so the new snapshot already has the new theme.
        document
          .startViewTransition(() => flushSync(() => setTheme(next)))
          .finished.finally(() => delete root.dataset.themeReveal)
      }}
      theme={theme}
    />
  )
}
