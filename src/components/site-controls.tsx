'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'

import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
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

/** Light, dark or the system's setting; the icon shows what is in effect. */
export function ThemeMenu() {
  const t = useTranslations('Theme')
  const { theme, resolvedTheme, setTheme } = useTheme()
  // The stored choice exists only in the browser; render a stable icon until hydrated.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const icon = !mounted ? (
    <Monitor aria-hidden size={16} />
  ) : theme === 'system' ? (
    <Monitor aria-hidden size={16} />
  ) : resolvedTheme === 'dark' ? (
    <Moon aria-hidden size={16} />
  ) : (
    <Sun aria-hidden size={16} />
  )
  const current = mounted && theme ? t(theme as 'light' | 'dark' | 'system') : t('system')

  return (
    <DropdownMenu
      icon={icon}
      items={[
        { label: t('light'), icon: <Sun aria-hidden size={16} />, onSelect: () => setTheme('light') },
        { label: t('dark'), icon: <Moon aria-hidden size={16} />, onSelect: () => setTheme('dark') },
        { label: t('system'), icon: <Monitor aria-hidden size={16} />, onSelect: () => setTheme('system') },
      ]}
      label={current}
    />
  )
}
