'use client'

import { Globe, Moon, Sun } from 'lucide-react'
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
export function LanguageSwitch({ full = false }: { full?: boolean }) {
  const t = useTranslations('Language')
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale

  return (
    <Link
      aria-label={t('switchToLabel')}
      className={full ? 'site-sheet-button' : 'site-control'}
      href={search ? `${pathname}?${search}` : pathname}
      hrefLang={other}
      lang={other}
      locale={other}
    >
      {/* In the menu sheet: the language's whole name, as it calls itself. */}
      {full ? (
        <>
          <Globe aria-hidden size={16} strokeWidth={1.75} />
          {t(other)}
        </>
      ) : (
        t('switchTo')
      )}
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
function useThemeChange() {
  const { resolvedTheme, setTheme } = useTheme()
  // The resolved theme exists only in the browser; keep the slot until hydrated.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const theme: 'light' | 'dark' | null =
    mounted && resolvedTheme ? (resolvedTheme === 'dark' ? 'dark' : 'light') : null
  const change = (next: 'light' | 'dark', trigger: HTMLElement) => {
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
  }
  return { theme, change }
}

export function ThemeToggle({ full = false }: { full?: boolean }) {
  const t = useTranslations('Theme')
  const { theme, change } = useThemeChange()
  if (!theme)
    return <span aria-hidden className={full ? 'site-sheet-button' : 'inline-block size-9'} />
  const next = theme === 'dark' ? 'light' : 'dark'
  // In the menu sheet: the mode it switches to, in words, with its icon.
  if (full) {
    const Icon = next === 'dark' ? Moon : Sun
    return (
      <button
        aria-pressed={theme === 'dark'}
        className="site-sheet-button"
        onClick={(e) => change(next, e.currentTarget)}
        type="button"
      >
        <Icon aria-hidden size={16} strokeWidth={1.75} />
        {next === 'dark' ? t('dark') : t('light')}
      </button>
    )
  }
  return (
    <ThemeSwitch
      iconOnly
      label={theme === 'dark' ? t('toLight') : t('toDark')}
      onThemeChange={(to, _variant, trigger) => change(to, trigger)}
      theme={theme}
    />
  )
}
