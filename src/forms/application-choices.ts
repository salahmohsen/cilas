import type { Contribution } from '@/lib/pricing'
import type { Course } from '@/payload-types'

export type CourseOption = {
  id: number
  title: string
  questions: NonNullable<Course['applicant_questions']>
  contribution: Contribution | null
}

export type ApplicationContext = {
  courses: CourseOption[]
  initialCourse?: number
  selectable: boolean
}

export const selectedKey = '$courses'
export { choiceFileField as courseField } from '@/forms/application-input'
export const amountKey = (id: number) => `$amount:${id}`
export const reductionKey = (id: number) => `$reduction:${id}`
