'use client'

import { Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

import { type ThemePreference, UserMenu } from '@/components/arc/user-menu/user-menu'
import { menuUser } from '@/components/menu-user'
import { useOtherLanguage } from '@/components/site-controls'
import { useSession } from '@/components/use-session'
import { useRouter } from '@/i18n/navigation'
import { useSignOut } from '@/lib/sign-out'

import { NAV_ICONS } from './nav-icons'
import { PROFILE } from './profile'

const THEMES = new Set<string>(['light', 'dark', 'system'])
const ProfileIcon = NAV_ICONS[PROFILE.icon]

/** The portal's account menu: profile, theme, language and sign out. Nothing until the session loads. */
export function AccountMenu(): React.JSX.Element | null {
  const t = useTranslations('Portal')
  const language = useTranslations('Language')
  const router = useRouter()
  const { other, href } = useOtherLanguage()
  const { theme, setTheme } = useTheme()
  const session = useSession()
  const signOut = useSignOut()
  const user = useMemo(() => (session ? menuUser(session) : null), [session])
  if (!user) return null
  return (
    <UserMenu
      user={user}
      showTheme
      theme={theme && THEMES.has(theme) ? (theme as ThemePreference) : 'system'}
      onThemeChange={setTheme}
      items={[
        {
          label: t(PROFILE.labelKey),
          icon: <ProfileIcon size={16} />,
          onSelect: () => router.push(PROFILE.href),
        },
        {
          label: language('switchToLabel'),
          lang: other,
          icon: <Languages size={16} />,
          onSelect: () => router.replace(href, { locale: other }),
        },
      ]}
      onSignOut={signOut}
      labels={{
        account: t('account.label'),
        signOut: t('account.signOut'),
        signingOut: t('account.signingOut'),
        theme: t('account.theme'),
        themes: {
          light: t('account.themes.light'),
          dark: t('account.themes.dark'),
          system: t('account.themes.system'),
        },
      }}
    />
  )
}
