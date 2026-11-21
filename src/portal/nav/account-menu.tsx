'use client'

import { Languages, UserRound } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

import { type ThemePreference, UserMenu } from '@/components/arc/user-menu/user-menu'
import { menuUser } from '@/components/menu-user'
import { useSession } from '@/components/use-session'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { signOut } from '@/lib/sign-out'

const THEMES = new Set<string>(['light', 'dark', 'system'])

/** The portal's account menu: profile, theme, language and sign out. Nothing until the session loads. */
export function AccountMenu(): React.JSX.Element | null {
  const t = useTranslations('Portal.account')
  const language = useTranslations('Language')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const session = useSession()
  const user = useMemo(() => (session ? menuUser(session) : null), [session])
  if (!user) return null
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale
  return (
    <UserMenu
      user={user}
      showTheme
      theme={theme && THEMES.has(theme) ? (theme as ThemePreference) : 'system'}
      onThemeChange={setTheme}
      items={[
        {
          label: t('profile'),
          icon: <UserRound size={16} />,
          onSelect: () => router.push('/settings'),
        },
        {
          label: language('switchToLabel'),
          icon: <Languages size={16} />,
          onSelect: () => router.replace(pathname, { locale: other }),
        },
      ]}
      onSignOut={signOut}
      labels={{
        account: t('label'),
        signOut: t('signOut'),
        signingOut: t('signingOut'),
        theme: t('theme'),
        themes: { light: t('themes.light'), dark: t('themes.dark'), system: t('themes.system') },
      }}
    />
  )
}
