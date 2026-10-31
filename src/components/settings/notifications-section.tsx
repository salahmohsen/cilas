'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'

import { savePreferencesAction } from '@/app/(frontend)/[locale]/settings/actions'
import { Switch } from '@/components/arc/switch/switch'
import { PushDevice } from '@/components/settings/push-device'
import { SettingsGroup, SettingsRow } from '@/components/settings/settings-parts'
import { useSettingsSection } from '@/components/settings/settings-shell'
import type { PreferenceChanges } from '@/lib/notification-preferences'

type Switches = { email: Record<string, boolean>; push: Record<string, boolean> }

type Props = {
  /** The stored switches for this account, one per listed kind. */
  initial: Switches
  /** The VAPID public key, or null when push is off: the device group is hidden then. */
  pushPublicKey: string | null
}

const CHANNELS = ['email', 'push'] as const

/** The switches that differ between two states, per channel, with their new value. */
const diff = (base: Switches, now: Switches): PreferenceChanges => {
  const changes: Record<string, Record<string, boolean>> = {}
  for (const channel of CHANNELS) {
    for (const [kind, on] of Object.entries(now[channel])) {
      if (base[channel][kind] !== on) (changes[channel] ??= {})[kind] = on
    }
  }
  return changes as PreferenceChanges
}

/**
 * One row per kind of notification, in two groups: email (only the kinds that
 * send email) and the devices. A flip waits for the settings page's Save,
 * which sends just the rows that changed.
 */
export function NotificationsSection({ initial, pushPublicKey }: Props) {
  const t = useTranslations('Settings')
  const base = useId()
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)

  const changes = diff(saved, values)
  const count = CHANNELS.reduce((sum, c) => sum + Object.keys(changes[c] ?? {}).length, 0)

  useSettingsSection('notifications', {
    count,
    discard: () => setValues(saved),
    save: async () => {
      const result = await savePreferencesAction(changes).catch(() => null)
      if (!result?.ok) return { ok: false, message: t('saveFailed') }
      setSaved(values)
      return { ok: true }
    },
  })

  const flip = (channel: 'email' | 'push', kind: string, on: boolean) =>
    setValues((prev) => ({ ...prev, [channel]: { ...prev[channel], [kind]: on } }))

  const rows = (channel: 'email' | 'push') =>
    Object.keys(values[channel]).map((kind) => {
      const id = `${base}-${channel}-${kind}`
      return (
        <SettingsRow
          key={kind}
          id={id}
          label={t(`kinds.${kind}.label`)}
          hint={t(`kinds.${kind}.hint`)}
        >
          <Switch
            checked={values[channel][kind]}
            onCheckedChange={(on) => flip(channel, kind, on)}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-hint`}
          />
        </SettingsRow>
      )
    })

  return (
    <div>
      {Object.keys(values.email).length > 0 ? (
        <SettingsGroup title={t('emailGroup')} hint={t('emailHint')}>
          {rows('email')}
        </SettingsGroup>
      ) : null}
      {pushPublicKey ? (
        <SettingsGroup
          title={t('deviceGroup')}
          hint={t('deviceHint')}
          lead={<PushDevice publicKey={pushPublicKey} />}
        >
          {rows('push')}
        </SettingsGroup>
      ) : null}
    </div>
  )
}
