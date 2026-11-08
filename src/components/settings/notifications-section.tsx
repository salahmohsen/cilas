'use client'

import { useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { savePreferencesAction, saveSpaceEmailAction } from '@/lib/settings-actions'
import { Switch } from '@/components/switch'
import { PushDevice } from '@/components/settings/push-device'
import { SettingsGroup, SettingsRow } from '@/components/settings/settings-parts'
import { useSettingsSection } from '@/components/settings/settings-shell'
import type { PreferenceChanges } from '@/lib/notification-preferences'

type Switches = { email: Record<string, boolean>; push: Record<string, boolean> }

/** The account's space email choices: the stop-all switch and the digest frequency. */
export type SpaceEmail = { stopped: boolean; digest: 'daily' | 'weekly' | 'off' }

type Props = {
  /** The stored switches for this account, one per listed kind. */
  initial: Switches
  /** The VAPID public key, or null when push is off: the device group is hidden then. */
  pushPublicKey: string | null
  /** The space email choices, or null when the Spaces switch is off or the account has no person. */
  spaceEmail: SpaceEmail | null
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
export function NotificationsSection({ initial, pushPublicKey, spaceEmail }: Props) {
  const t = useTranslations('Settings')
  const locale = useLocale()
  const base = useId()
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [spaceSaved, setSpaceSaved] = useState(spaceEmail)
  const [space, setSpace] = useState(spaceEmail)

  const changes = diff(saved, values)
  const spaceChanges: Partial<SpaceEmail> = {}
  if (space && spaceSaved) {
    if (space.stopped !== spaceSaved.stopped) spaceChanges.stopped = space.stopped
    if (space.digest !== spaceSaved.digest) spaceChanges.digest = space.digest
  }
  const count =
    CHANNELS.reduce((sum, c) => sum + Object.keys(changes[c] ?? {}).length, 0) +
    Object.keys(spaceChanges).length

  useSettingsSection('notifications', {
    count,
    discard: () => {
      setValues(saved)
      setSpace(spaceSaved)
    },
    save: async () => {
      const result = await savePreferencesAction(changes).catch(() => null)
      if (!result?.ok) return { ok: false, message: t('saveFailed') }
      setSaved(values)
      if (Object.keys(spaceChanges).length) {
        const spaced = await saveSpaceEmailAction(spaceChanges, locale).catch(() => null)
        if (!spaced?.ok) return { ok: false, message: t('saveFailed') }
        setSpaceSaved(space)
      }
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

  const spaceId = `${base}-space`

  return (
    <div>
      {space ? (
        <SettingsGroup title={t('spaceGroup')} hint={t('spaceHint')}>
          <SettingsRow
            id={`${spaceId}-email`}
            label={t('spaceEmailLabel')}
            hint={t('spaceEmailHint')}
          >
            <Switch
              checked={!space.stopped}
              onCheckedChange={(on) => setSpace({ ...space, stopped: !on })}
              aria-labelledby={`${spaceId}-email-label`}
              aria-describedby={`${spaceId}-email-hint`}
            />
          </SettingsRow>
          <SettingsRow
            id={`${spaceId}-digest`}
            label={t('spaceDigestLabel')}
            hint={t('spaceDigestHint')}
            stacked
          >
            <RadioGroup
              label={t('spaceDigestLabel')}
              labelHidden
              disabled={space.stopped}
              value={space.digest}
              onValueChange={(digest) =>
                setSpace({ ...space, digest: digest as SpaceEmail['digest'] })
              }
              options={[
                { value: 'daily', label: t('spaceDaily') },
                { value: 'weekly', label: t('spaceWeekly') },
                { value: 'off', label: t('spaceDigestOff') },
              ]}
            />
          </SettingsRow>
        </SettingsGroup>
      ) : null}
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
