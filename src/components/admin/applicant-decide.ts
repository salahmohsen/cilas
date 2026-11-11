import { deriveStatus } from '@/forms/application-status'
import type { Applicant } from '@/forms/applicants'

export type Decision = 'accept' | 'reject'
export type DecisionResult = { emailFailed: boolean; decided: string }
type Choice = Applicant['choices'][number]

/** Sends one course's decision. Rejects with the server's reason, or `failed`. */
export async function sendDecision(
  application: number,
  course: number,
  action: Decision,
  failed: string,
): Promise<DecisionResult> {
  const response = await fetch(`/api/form-submissions/${application}/courses/${course}/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  const body = await response.json()
  if (!response.ok || body.ok !== true) throw new Error(body.error || failed)
  return { emailFailed: body.emailed === false, decided: body.decided }
}

/** The application as the server now has it: that course decided, the status derived again. */
export function withDecision(
  application: Applicant,
  course: number,
  action: Decision,
  decided: string,
): Applicant {
  const choices = application.choices.map((c): Choice =>
    c.course === course
      ? { ...c, decision: action === 'accept' ? 'accepted' : 'rejected', decided }
      : c,
  )
  const status = deriveStatus(choices.map((c) => ({ decision: c.decision, decided_at: c.decided })))
  return { ...application, choices, status: status.status, decided: status.decided_at }
}
