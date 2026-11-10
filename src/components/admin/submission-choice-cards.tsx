'use client'

import { CURRENCY } from '@/lib/pricing'
import { CheckboxField, FieldPathContext } from '@payloadcms/ui'
import type { submissionChoices } from '@/forms/submission-view'

export function SubmissionChoiceCards({
  choices,
  path,
  decided,
}: {
  choices: Awaited<ReturnType<typeof submissionChoices>>
  path: string
  decided: boolean
}) {
  if (!choices.length) return null
  return (
    <section aria-label="Course choices" className="cilas-admin-stack">
      <h2>Course choices</h2>
      {choices.map((choice, i) => (
        <article
          key={choice.id ?? choice.course}
          style={{ border: '1px solid var(--theme-elevation-150)', padding: 16 }}
        >
          <h3>
            <a href={choice.href}>{choice.title}</a>
          </h3>
          <p>
            Contribution: {choice.amount == null ? 'Not specified' : `${choice.amount} ${CURRENCY}`}
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
          <FieldPathContext value={`${path}.${i}.accepted`}>
            <CheckboxField
              readOnly={decided}
              field={{
                name: 'accepted',
                type: 'checkbox',
                label: `Accept ${choice.title}`,
              }}
              path={`${path}.${i}.accepted`}
            />
          </FieldPathContext>
        </article>
      ))}
    </section>
  )
}
