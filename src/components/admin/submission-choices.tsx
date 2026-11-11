import type { ArrayFieldServerComponent, UIFieldServerComponent } from 'payload'
import { readableAnswers, readableChoices } from '@/forms/submission-view'
import { SubmissionChoiceCards } from './submission-choice-cards'

export const SubmissionChoices: ArrayFieldServerComponent = async ({ data, req }) => {
  return <SubmissionChoiceCards choices={await readableChoices(req, data.choices)} />
}

export const SubmissionAnswers: UIFieldServerComponent = async ({ data, req }) => {
  const answers = await readableAnswers(req, data?.form, data?.submissionData)
  if (!answers.length) return null
  return (
    <section aria-label="Answers" className="cilas-admin-stack">
      <h2>Answers</h2>
      <dl>
        {answers.map((answer) => (
          <div key={answer.id ?? answer.label}>
            <dt>
              <strong>{answer.label}</strong>
            </dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{answer.value || 'No answer'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function CoursesCell({ cellData }: { cellData?: string }) {
  return <span>{cellData || 'No course choices'}</span>
}
