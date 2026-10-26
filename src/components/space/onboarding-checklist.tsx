'use client'

import { useRef } from 'react'
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
import { openComments } from './intro-lock'

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
  // The message stays empty so the checklist announces its own translated one.
  if (result.status === 'error') throw new Error('')
}

/**
 * Spec §2: five first steps, from least to most effort (Circle's ordering
 * advice). Each action does the step where it stands; none gates the space.
 */
export function OnboardingChecklist({
  space,
  steps,
  pinnedId,
  introPost,
  gated,
  profileHref,
  hidden,
}: {
  space: number
  steps: Steps
  pinnedId: number | null
  /** The space's intro post: introducing yourself is a comment on it */
  introPost: number | null
  /** The member reads nothing else until that comment lands, which also ticks the step */
  gated: boolean
  profileHref: string
  hidden: boolean
}) {
  const t = useTranslations('SpaceChecklist')
  const router = useRouter()
  const mark = (step: keyof Steps, value = true) =>
    call(stepMarkAction, { space: String(space), step, value: String(value) })

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
        if (introPost == null) window.dispatchEvent(new Event(COMPOSE_EVENT))
        else openComments(introPost)
        if (!gated) await mark('introduced')
      },
    },
  ]
  const done = all.filter((s) => steps[s.id as keyof Steps]).map((s) => s.id)
  const saved = useRef(new Set(done))
  if (done.length === all.length) return null

  /**
   * A box ticked by hand is saved like a finished action, so the checklist
   * reads the same on the next visit and leaves once every step is done.
   * Accepting the notice cannot be undone from here; it stays accepted.
   */
  const persist = async (completed: string[]) => {
    const next = new Set(completed)
    const changes = all
      .map((s) => s.id as keyof Steps)
      .filter((id) => next.has(id) !== saved.current.has(id))
    saved.current = next
    for (const id of changes) {
      const on = next.has(id)
      if (id === 'saw_privacy') {
        if (on && !steps.saw_privacy) await call(consentAcceptAction)
      } else await mark(id, on)
    }
    if (changes.length) router.refresh()
  }

  return (
    <ArcChecklist
      title={t('title')}
      doneTitle={t('doneTitle')}
      steps={all}
      defaultCompleted={done}
      defaultHidden={hidden}
      onCompletedChange={(completed) => void persist(completed)}
      labels={{
        progress: (n, total) => t.rich('progress', { total, done: () => n }),
        hide: t('hide'),
        show: t('show'),
        completed: (count) => t.rich('completed', { count: () => count }),
        stepsToDo: t('stepsToDo'),
        completedSteps: t('completedSteps'),
        progressLabel: t('progressLabel'),
        progressText: (done, total) => t('progressText', { done, total }),
        allDone: (total) => t('allDone', { total }),
        stepDone: (title, done, total) => t('stepDone', { title, done, total }),
        stepUndone: (title, done, total) => t('stepUndone', { title, done, total }),
        failed: t('failed'),
      }}
      onHiddenChange={(next) => {
        document.cookie = `${CHECKLIST_COOKIE}=${next ? '1' : ''}; path=/; max-age=${next ? 31_536_000 : 0}; samesite=lax`
      }}
    />
  )
}
