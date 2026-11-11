import { deriveStatus, type ChoiceDecision } from '@/forms/application-status'
import type { Applicant } from '@/forms/applicants'

export type Decision = 'accept' | 'reject' | 'reopen' | 'resend'
export type DecisionResult = { emailFailed: boolean; decided: string | null }
type Choice = Applicant['choices'][number]

/** What the admin decides on: one course of an application, or a programme application as a whole (`course` null). */
export type Entry = {
  key: string
  course: number | null
  title: string
  cover: Choice['cover']
  decision: ChoiceDecision
  decided: string | null
  emailFailed: boolean
}

export const entriesOf = (a: Applicant): Entry[] =>
  a.programme
    ? [{ key: 'programme', course: null, ...a.programme }]
    : a.choices.map((c) => ({
        key: String(c.course),
        course: c.course,
        title: c.title,
        cover: c.cover,
        decision: c.decision,
        decided: c.decided,
        emailFailed: c.emailFailed,
      }))

/** Sends one decision. Rejects with the server's reason, or `failed`. */
export async function sendDecision(
  application: number,
  course: number | null,
  action: Decision,
  failed: string,
): Promise<DecisionResult> {
  const base = `/api/form-submissions/${application}`
  const response = await fetch(`${base}${course === null ? '' : `/courses/${course}`}/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  const body = await response.json()
  if (!response.ok || body.ok !== true) throw new Error(body.error || failed)
  return { emailFailed: body.emailed === false, decided: body.decided ?? null }
}

const decisionOf = { accept: 'accepted', reject: 'rejected', reopen: 'pending' } as const

/** The application as the server now has it: that decision made, the status derived again. */
export function withDecision(
  application: Applicant,
  course: number | null,
  action: Decision,
  result: DecisionResult,
): Applicant {
  const change = (c: { decision: ChoiceDecision; decided: string | null; emailFailed: boolean }) =>
    action === 'resend'
      ? { ...c, emailFailed: result.emailFailed }
      : {
          ...c,
          decision: decisionOf[action],
          decided: action === 'reopen' ? null : result.decided,
          emailFailed: result.emailFailed,
        }
  if (course === null && application.programme) {
    const programme = { ...application.programme, ...change(application.programme) }
    const status = programme.decision === 'pending' ? 'new' : programme.decision
    return { ...application, programme, status, decided: programme.decided }
  }
  const choices = application.choices.map((c) => (c.course === course ? { ...c, ...change(c) } : c))
  const derived = deriveStatus(
    choices.map((c) => ({ decision: c.decision, decided_at: c.decided })),
  )
  return { ...application, choices, status: derived.status, decided: derived.decided_at }
}
