'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { removePushSubscriptionAction, savePushSubscriptionAction } from '@/lib/settings-actions'
import { Button } from '@/components/arc/button/button'
import { track } from '@/lib/analytics/track'
import {
  currentSubscription,
  deviceSupport,
  subscribeThisDevice,
  type DeviceSupport,
} from '@/lib/push/client'

import styles from './push-device.module.css'

type State =
  | { kind: 'checking' }
  | { kind: 'blocked' }
  | { kind: 'unsupported'; support: Exclude<DeviceSupport, 'ok'> }
  | { kind: 'off' }
  | { kind: 'on' }

/**
 * The "Enable on this device" control. The permission prompt opens only from
 * the tap on the button; the subscription is stored on the account, and
 * turning it off here removes both. On iOS the browser tab cannot receive
 * push, so there the control explains the Home Screen step instead.
 */
export function PushDevice({ publicKey }: { publicKey: string }) {
  const t = useTranslations('Settings')
  const locale = useLocale()
  const [state, setState] = useState<State>({ kind: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const find = async (): Promise<State> => {
      const support = deviceSupport()
      if (support !== 'ok') return { kind: 'unsupported', support }
      if (Notification.permission === 'denied') return { kind: 'blocked' }
      const subscription = await currentSubscription().catch(() => null)
      return subscription && Notification.permission === 'granted'
        ? { kind: 'on' }
        : { kind: 'off' }
    }
    void find().then((next) => live && setState(next))
    return () => {
      live = false
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    setError(null)
    const result = await subscribeThisDevice(publicKey)
    if (!result.ok) {
      if (result.reason === 'denied') setState({ kind: 'blocked' })
      else setError(t('deviceFailed'))
      setBusy(false)
      return
    }
    const saved = await savePushSubscriptionAction(result.subscription, locale).catch(() => null)
    if (saved?.ok) {
      track('push_enabled', {})
      setState({ kind: 'on' })
    } else setError(t('deviceFailed'))
    setBusy(false)
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState({ kind: 'off' })
    } catch {
      setError(t('deviceFailed'))
    }
    setBusy(false)
  }

  if (state.kind === 'checking' || state.kind === 'unsupported' || state.kind === 'blocked') {
    const text =
      state.kind === 'checking'
        ? t('deviceChecking')
        : state.kind === 'blocked'
          ? t('deviceDenied')
          : state.support === 'needs-home-screen'
            ? t('deviceIos')
            : t('deviceUnsupported')
    return (
      <div className={styles.device}>
        <p className={styles.note}>{text}</p>
      </div>
    )
  }

  return (
    <div className={styles.device}>
      <p className={styles.note}>{state.kind === 'on' ? t('deviceOn') : t('deviceOff')}</p>
      {state.kind === 'on' ? (
        <Button type="button" variant="secondary" loading={busy} onClick={() => void disable()}>
          {t('deviceDisable')}
        </Button>
      ) : (
        <Button type="button" loading={busy} onClick={() => void enable()}>
          {t('deviceEnable')}
        </Button>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
