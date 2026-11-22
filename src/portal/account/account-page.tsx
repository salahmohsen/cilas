import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import type { ComponentProps } from 'react'
import { Bell, KeyRound, UserRound } from 'lucide-react'

import { isAdminUser, personOf } from '@/access'
import { profileMessages } from '@/components/profile/load-messages'
import { ProfileForm } from '@/components/profile/profile-form'
import { NotificationsSection } from '@/components/settings/notifications-section'
import { PanelHeader } from '@/components/settings/settings-parts'
import { SettingsShell } from '@/components/settings/settings-shell'
import { ACCOUNT_GROUPS, type AccountGroup } from '@/lib/account-path'
import { switchesOf, readPreferences } from '@/lib/notification-preferences'
import { pushConfig } from '@/lib/push/config'
import { readProfile } from '@/lib/profile'
import { removeProfilePhotoAction, saveProfileAction } from '@/lib/profile-actions'
import { loadPrefs } from '@/lib/space-email-prefs'
import { mode, spacesSettings } from '@/lib/spaces'
import type { User } from '@/payload-types'

import styles from './account-page.module.css'
import { SignInSection } from './sign-in-section'

type Props = { user: User }
type Section = ComponentProps<typeof SettingsShell>['sections'][number]

/** The signed-in member's account: their profile, and how CILAS reaches them. */
export async function AccountPage({ user }: Props) {
  const t = await getTranslations('Settings')
  const tp = await getTranslations('Profile')
  const ta = await getTranslations('Portal.account')
  const payload = await getPayload({ config })
  const profile = await readProfile(payload, user)
  const messages = await profileMessages()
  const push = pushConfig()
  // The space email choices show only where spaces exist for this account.
  const spaceEmail =
    personOf(user) !== null && mode(await spacesSettings(payload)) !== 'off'
      ? await loadPrefs(payload, [user.id]).then((rows) => {
          const row = rows.get(user.id)
          return { stopped: row?.stopped ?? false, digest: row?.digest ?? 'weekly' }
        })
      : null

  const groups: Record<AccountGroup, Omit<Section, 'id'>> = {
    profile: {
      label: t('profile'),
      icon: <UserRound size={16} aria-hidden="true" />,
      content: (
        <>
          <PanelHeader title={t('profile')} intro={tp('intro')} />
          {profile ? (
            <ProfileForm
              profile={profile}
              messages={messages}
              action={saveProfileAction}
              removePhotoAction={removeProfilePhotoAction}
            />
          ) : (
            <p>{tp('noPerson')}</p>
          )}
        </>
      ),
    },
    'sign-in': {
      label: ta('signIn'),
      icon: <KeyRound size={16} aria-hidden="true" />,
      content: (
        <>
          <PanelHeader title={ta('signIn')} />
          <SignInSection email={user.email} />
        </>
      ),
    },
    notifications: {
      label: t('notifications'),
      icon: <Bell size={16} aria-hidden="true" />,
      content: (
        <>
          <PanelHeader title={t('notifications')} intro={t('notificationsIntro')} />
          <NotificationsSection
            initial={switchesOf(readPreferences(user.notification_preferences), isAdminUser(user))}
            pushPublicKey={push?.publicKey ?? null}
            spaceEmail={spaceEmail}
          />
        </>
      ),
    },
  }

  return (
    <div className={styles.page}>
      <SettingsShell
        title={t('title')}
        intro={t('intro')}
        navLabel={t('navLabel')}
        // Each group's content sits in an element with the group's id, so `#profile` names a real element.
        sections={ACCOUNT_GROUPS.map((id) => ({
          id,
          ...groups[id],
          content: <div id={id}>{groups[id].content}</div>,
        }))}
      />
    </div>
  )
}
