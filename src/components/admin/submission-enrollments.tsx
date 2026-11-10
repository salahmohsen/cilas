'use client'

import { useField } from '@payloadcms/ui'

export function SubmissionEnrollments({ path }: { path: string }) {
  const { value } = useField<
    { course: number; title: string; enrollment: number; created: boolean }[]
  >({ path })
  if (!value?.length) return null
  return (
    <section aria-label="Enrollment results">
      <h3>Enrollments</h3>
      <ul>
        {value.map((item) => (
          <li key={item.course}>
            <a href={`/admin/collections/enrollments/${item.enrollment}`}>{item.title}</a>:{' '}
            {item.created ? 'Created' : 'Already existed'}
          </li>
        ))}
      </ul>
    </section>
  )
}
