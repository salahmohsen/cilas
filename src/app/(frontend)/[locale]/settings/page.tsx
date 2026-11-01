import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { Bell, UserRound } from 'lucide-react'

import { isAdminUser } from '@/access'
import { profileMessages } from '@/components/profile/load-messages'
import { ProfileForm } from '@/components/profile/profile-form'
import { NotificationsSection } from '@/components/settings/notifications-section'
import { PanelHeader } from '@/components/settings/settings-parts'
import { SettingsShell } from '@/components/settings/settings-shell'
import { switchesOf, readPreferences } from '@/lib/notification-preferences'
import { pushConfig } from '@/lib/push/config'
import { readProfile } from '@/lib/profile'
import { currentReader } from '@/lib/reader'

import { removeProfilePhotoAction, saveProfileAction } from '../profile/actions'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** The signed-in member's settings: their profile, and how CILAS reaches them. */
export default async function SettingsPage({ params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`)

  const t = await getTranslations('Settings')
  const tp = await getTranslations('Profile')
  const profile = await readProfile(await getPayload({ config }), user)
  const messages = await profileMessages()
  const push = pushConfig()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <SettingsShell
        title={t('title')}
        intro={t('intro')}
        navLabel={t('navLabel')}
        sections={[
          {
            id: 'profile',
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
          {
            id: 'notifications',
            label: t('notifications'),
            icon: <Bell size={16} aria-hidden="true" />,
            content: (
              <>
                <PanelHeader title={t('notifications')} intro={t('notificationsIntro')} />
                <NotificationsSection
                  initial={switchesOf(
                    readPreferences(user.notification_preferences),
                    isAdminUser(user),
                  )}
                  pushPublicKey={push?.publicKey ?? null}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
