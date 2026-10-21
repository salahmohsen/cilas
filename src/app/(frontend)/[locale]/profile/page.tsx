import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  PROFILE_ERROR_KEYS,
  PROFILE_MESSAGE_KEYS,
  type ProfileMessages,
} from '@/components/profile/messages'
import { ProfileForm } from '@/components/profile/profile-form'
import { readProfile } from '@/lib/profile'
import { currentReader } from '@/lib/reader'

import { saveProfileAction } from './actions'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Profile')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** The signed-in member's own profile (spec: Spaces, step 0). */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/profile`)}`)

  const t = await getTranslations('Profile')
  const profile = await readProfile(await getPayload({ config }), user)

  const pick = <K extends string>(keys: readonly K[], prefix = '') =>
    Object.fromEntries(
      keys.map((k) => [k, (t as (key: string) => string)(`${prefix}${k}`)]),
    ) as Record<K, string>
  const messages = {
    ...pick(PROFILE_MESSAGE_KEYS),
    errors: pick(PROFILE_ERROR_KEYS, 'errors.'),
  } satisfies ProfileMessages

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <header className="grid gap-2">
        <h1 className="text-3xl font-medium">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>
      {profile ? (
        <ProfileForm profile={profile} messages={messages} action={saveProfileAction} />
      ) : (
        <p>{t('noPerson')}</p>
      )}
    </div>
  )
}
