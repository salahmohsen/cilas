'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { OnboardingChecklist as ArcChecklist } from '@/components/arc/onboarding-checklist/onboarding-checklist'
import {
  consentAcceptAction,
  preferenceSetAction,
  stepMarkAction,
  type SpacesWriteState,
} from '@/app/(frontend)/[locale]/spaces/actions'

import { COMPOSE_EVENT } from './composer'

export type Steps = {
  saw_privacy: boolean
  introduced: boolean
  read_pinned: boolean
  checked_profile: boolean
  chose_digest: boolean
}

/** Read by the server render, so a hidden checklist stays hidden without a flash. */
export const CHECKLIST_COOKIE = 'spaces-checklist-hidden'

const call = async (
  action: (prev: SpacesWriteState, form: FormData) => Promise<SpacesWriteState>,
  fields: Record<string, string> = {},
) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  const result = await action({ status: 'ok' }, form)
  if (result.status === 'error') throw new Error(result.error)
}

/**
 * Spec §2: five first steps, from least to most effort (Circle's ordering
 * advice). Each action does the step where it stands; none gates the space.
 */
export function OnboardingChecklist({
  space,
  steps,
  pinnedId,
  profileHref,
  hidden,
}: {
  space: number
  steps: Steps
  pinnedId: number | null
  profileHref: string
  hidden: boolean
}) {
  const t = useTranslations('SpaceChecklist')
  const router = useRouter()
  const mark = (step: keyof Steps) => call(stepMarkAction, { space: String(space), step })

  const all = [
    {
      id: 'saw_privacy',
      title: t('accept'),
      description: t('acceptHelp'),
      actionLabel: t('acceptAction'),
      onAction: async () => {
        await call(consentAcceptAction)
        router.refresh()
      },
    },
    {
      id: 'chose_digest',
      title: t('digest'),
      description: t('digestHelp'),
      actionLabel: t('digestAction'),
      onAction: async () => {
        await call(preferenceSetAction, { digest: 'weekly' })
        router.refresh()
      },
    },
    {
      id: 'checked_profile',
      title: t('checkProfile'),
      description: t('profileHelp'),
      actionLabel: t('profileAction'),
      onAction: async () => {
        await mark('checked_profile')
        router.push(profileHref)
      },
    },
    ...(pinnedId != null
      ? [
          {
            id: 'read_pinned',
            title: t('readPinned'),
            description: t('pinnedHelp'),
            actionLabel: t('pinnedAction'),
            onAction: async () => {
              const target = document.getElementById(`post-${pinnedId}`)
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              target?.focus({ preventScroll: true })
              await mark('read_pinned')
            },
          },
        ]
      : []),
    {
      id: 'introduced',
      title: t('introduce'),
      description: t('introduceHelp'),
      actionLabel: t('introduceAction'),
      onAction: async () => {
        window.dispatchEvent(new Event(COMPOSE_EVENT))
        await mark('introduced')
      },
    },
  ]
  const done = all.filter((s) => steps[s.id as keyof Steps]).map((s) => s.id)
  if (done.length === all.length) return null

  return (
    <ArcChecklist
      title={t('title')}
      doneTitle={t('doneTitle')}
      steps={all}
      defaultCompleted={done}
      defaultHidden={hidden}
      onHiddenChange={(next) => {
        document.cookie = `${CHECKLIST_COOKIE}=${next ? '1' : ''}; path=/; max-age=${next ? 31_536_000 : 0}; samesite=lax`
      }}
    />
  )
}
