'use client'

import { formatAmount } from '@/lib/pricing'
import type { submissionChoices } from '@/forms/submission-view'

export function SubmissionChoiceCards({
  choices,
}: {
  choices: Awaited<ReturnType<typeof submissionChoices>>
}) {
  if (!choices.length) return null
  return (
    <section aria-label="Course choices" className="cilas-admin-stack">
      <h2>Course choices</h2>
      {choices.map((choice) => (
        <article
          key={choice.id ?? choice.course}
          style={{ border: '1px solid var(--theme-elevation-150)', padding: 16 }}
        >
          <h3>
            <a href={choice.href}>{choice.title}</a>
          </h3>
          <p>
            Contribution:{' '}
            {choice.amount == null ? 'Not specified' : formatAmount(choice.amount, 'en')}
          </p>
          <p>Needs a reduction: {choice.need_reduction ? 'Yes' : 'No'}</p>
          <dl>
            {choice.answers?.map((answer) => (
              <div key={answer.id ?? answer.name}>
                <dt>
                  <strong>{answer.label || answer.name}</strong>
                </dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{answer.value || 'No answer'}</dd>
              </div>
            ))}
          </dl>
          <p>
            Decision: {choice.decision ?? 'pending'}
            {choice.decided_at
              ? ` on ${new Date(choice.decided_at).toLocaleDateString('en-GB')}`
              : ''}
          </p>
        </article>
      ))}
    </section>
  )
}
