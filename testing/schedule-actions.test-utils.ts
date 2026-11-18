import type { ScheduleActions } from '@/components/space/schedule-actions'

type Calls = { [Name in keyof ScheduleActions]: Parameters<ScheduleActions[Name]>[] }

const unanswered = {
  loadCalendarItems: async () => ({ ok: false, error: { code: 'unauthenticated' } }),
  loadSessionEdit: async () => ({ ok: false, error: 'failed' }),
  loadSessionView: async () => ({ ok: false, error: 'failed' }),
  saveScheduleEdits: async () => ({ ok: false, error: { code: 'unauthenticated' } }),
  scheduleOffers: async () => [],
  publishOffer: async () => ({ status: 'ok' }),
} satisfies ScheduleActions

const names = Object.keys(unanswered) as (keyof ScheduleActions)[]

/**
 * The schedule screens' actions as the host passes them in a test: each call
 * is recorded in `calls`, then answered by `answers`, which a test may
 * replace. An action a test does not answer reports a refusal.
 */
export const scheduleActionsHost = (answers: Partial<ScheduleActions> = {}) => {
  const first = { ...unanswered, ...answers } as ScheduleActions
  const current = { ...first }
  const calls = Object.fromEntries(names.map((name) => [name, []])) as unknown as Calls
  const actions = Object.fromEntries(
    names.map((name) => [
      name,
      (...args: never[]) => {
        ;(calls[name] as unknown[]).push(args)
        return (current[name] as (...args: never[]) => unknown)(...args)
      },
    ]),
  ) as ScheduleActions
  return {
    actions,
    answers: current,
    calls,
    reset: () => {
      Object.assign(current, first)
      for (const name of names) calls[name].length = 0
    },
  }
}
