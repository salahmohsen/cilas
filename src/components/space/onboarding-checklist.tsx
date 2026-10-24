'use client'

import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { Progress } from '@/components/arc/progress/progress'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { preferenceSetAction, stepMarkAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

type Steps = {
  saw_privacy: boolean
  introduced: boolean
  read_pinned: boolean
  checked_profile: boolean
  chose_digest: boolean
}

const HIDDEN_KEY = 'spaces-checklist-hidden'
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const hiddenNow = () => localStorage.getItem(HIDDEN_KEY) === '1'
const hide = () => {
  localStorage.setItem(HIDDEN_KEY, '1')
  listeners.forEach((fn) => fn())
}

/**
 * Spec §2: five first steps, each opening its own surface. It never gates the
 * space, and a member can hide it on this device.
 */
export function OnboardingChecklist({
  space,
  steps,
  digest,
  pinnedId,
  profileHref,
}: {
  space: number
  steps: Steps
  digest: 'daily' | 'weekly' | 'off' | null
  pinnedId: number | null
  profileHref: string
}) {
  const t = useTranslations('SpaceChecklist')
  const router = useRouter()
  // Shown on the server render; the stored choice applies after hydration.
  const hidden = useSyncExternalStore(subscribe, hiddenNow, () => false)
  const [choice, setChoice] = useState<string>(digest ?? 'weekly')
  const [, startMark] = useTransition()

  const shown = (Object.keys(steps) as (keyof Steps)[]).filter(
    (k) => k !== 'read_pinned' || pinnedId != null,
  )
  const done = shown.filter((k) => steps[k]).length
  if (hidden || done === shown.length) return null

  const mark = (step: keyof Steps) => {
    const form = new FormData()
    form.set('space', String(space))
    form.set('step', step)
    startMark(async () => {
      await stepMarkAction({ status: 'ok' }, form)
      router.refresh()
    })
  }

  const actions: Record<keyof Steps, [string, ReactNode]> = {
    saw_privacy: [
      t('accept'),
      <a key="a" href="#consent" className={styles.link}>
        {t('openNotice')}
      </a>,
    ],
    introduced: [
      t('introduce'),
      <a key="a" href="#composer" className={styles.link} onClick={() => mark('introduced')}>
        {t('openComposer')}
      </a>,
    ],
    read_pinned: [
      t('readPinned'),
      <a
        key="a"
        href={`#post-${pinnedId}`}
        className={styles.link}
        onClick={() => mark('read_pinned')}
      >
        {t('openPinned')}
      </a>,
    ],
    checked_profile: [
      t('checkProfile'),
      <Link
        key="a"
        href={profileHref}
        className={styles.link}
        onClick={() => mark('checked_profile')}
      >
        {t('openProfile')}
      </Link>,
    ],
    chose_digest: [t('digest'), null],
  }

  return (
    <section aria-labelledby="checklist-title" className={styles.group}>
      <div className={styles.groupHead}>
        <h2 id="checklist-title" className={styles.sectionTitle}>
          {t('title')}
        </h2>
        <Progress
          value={done}
          max={shown.length}
          label={t('progress', { done, total: shown.length })}
          showValue
        />
      </div>
      <ul className={styles.rows}>
        {shown.map((key) => (
          <li key={key} className={styles.row}>
            <span className={`${styles.rowMain} ${steps[key] ? styles.done : ''}`}>
              {steps[key] && <Check size={16} aria-label={t('done')} />}
              {actions[key][0]}
            </span>
            {!steps[key] && actions[key][1]}
          </li>
        ))}
      </ul>
      {!steps.chose_digest && (
        <div className={styles.groupBody}>
          <RadioGroup
            label={t('digestLabel')}
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: 'daily', label: t('daily') },
              { value: 'weekly', label: t('weekly') },
              { value: 'off', label: t('off') },
            ]}
          />
          <div>
            <ActionButton
              label={t('saveDigest')}
              pendingLabel={t('savingDigest')}
              successLabel={t('savedDigest')}
              onAction={async () => {
                const form = new FormData()
                form.set('digest', choice)
                const result = await preferenceSetAction({ status: 'ok' }, form)
                if (result.status === 'error') throw new Error(result.error)
                router.refresh()
              }}
            />
          </div>
        </div>
      )}
      <div className={styles.groupFoot}>
        <Button variant="ghost" size="sm" onClick={hide}>
          {t('hide')}
        </Button>
      </div>
    </section>
  )
}
