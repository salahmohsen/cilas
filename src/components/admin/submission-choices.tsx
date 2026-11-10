import type { ArrayFieldServerComponent } from 'payload'
import { submissionChoices } from '@/forms/submission-view'
import { SubmissionChoiceCards } from './submission-choice-cards'

export const SubmissionChoices: ArrayFieldServerComponent = async ({ data, path, req }) => {
  const choices = await submissionChoices(req.payload, data.choices, req)
  return (
    <SubmissionChoiceCards choices={choices} path={path} decided={data.status === 'accepted'} />
  )
}

export function CoursesCell({ cellData }: { cellData?: string }) {
  return <span>{cellData || 'No course choices'}</span>
}
