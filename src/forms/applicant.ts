import type { Role } from '@/access'
import type { FormSubmission } from '@/payload-types'

export const rolesAfterAccept = (
  roles: Role[],
  kind: NonNullable<FormSubmission['target']>['relationTo'],
): Role[] => {
  if (kind === 'programmes') return roles.includes('member') ? roles : [...roles, 'member']
  const student = roles.includes('member') || roles.includes('non_degree_seeking')
  return student ? roles : [...roles, 'non_degree_seeking']
}

export const applicantOf = (
  answers: FormSubmission['submissionData'],
): { name: string; email: string } | { error: string } => {
  const answer = (field: string) => answers?.find((a) => a.field === field)?.value?.trim() ?? ''
  const name = answer('name')
  const email = answer('email').toLowerCase()
  if (!name) return { error: 'The submission has no "name" answer.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'The submission has no valid "email" answer.' }
  }
  return { name, email }
}
