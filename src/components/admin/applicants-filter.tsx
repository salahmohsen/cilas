'use client'

import { Button, ReactSelect } from '@payloadcms/ui'
import { useState } from 'react'

export function ApplicantsFilter({
  courses,
  selected,
  all,
  label,
  submit,
}: {
  courses: { id: number; title: string; count: number }[]
  selected: number | null
  all: string
  label: string
  submit: string
}) {
  const options = [
    { label: all, value: '' },
    ...courses.map((course) => ({
      label: `${course.title} (${course.count})`,
      value: String(course.id),
    })),
  ]
  const [value, setValue] = useState(String(selected ?? ''))
  return (
    <form action="/admin/applicants" className="cilas-applicants-filter">
      <div>
        <label htmlFor="applicants-course">{label}</label>
        <ReactSelect
          inputId="applicants-course"
          options={options}
          value={options.find((o) => o.value === value)}
          onChange={(option) => {
            if (!Array.isArray(option)) setValue(String(option.value))
          }}
        />
        <input type="hidden" name="course" value={value} />
      </div>
      <Button type="submit" buttonStyle="secondary">
        {submit}
      </Button>
    </form>
  )
}
