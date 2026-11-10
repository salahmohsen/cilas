'use client'

import { CAIRO } from '@/lib/cairo-day'

import { useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { Cycle } from '@/payload-types'
import { priceLabel } from '@/lib/pricing'
import { courseRegistration, type RegistrationMethod } from '@/lib/registration'

export function CourseSettings() {
  const values = useFormFields(([fields]) => ({
    cycle: fields.cycle?.value as number | null,
    course_type: fields.course_type?.value as string,
    method: fields['registration.method']?.value as RegistrationMethod | null,
    form: fields['registration.form']?.value as number | null,
    url: fields['registration.url']?.value as string | null,
    deadline: fields['registration.deadline']?.value as string | null,
    min: fields['pricing_override.min']?.value as number | null,
    max: fields['pricing_override.max']?.value as number | null,
  }))
  const [loaded, setLoaded] = useState<{ id: number; cycle?: Cycle; error?: boolean } | null>(null)
  useEffect(() => {
    if (!values.cycle) return
    const controller = new AbortController()
    const id = values.cycle
    fetch(`/api/cycles/${id}?depth=0`, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Cycle unavailable')
        const cycle: Cycle = await response.json()
        if (!controller.signal.aborted) setLoaded({ id, cycle })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ id, error: true })
      })
    return () => controller.abort()
  }, [values.cycle])

  if (!values.cycle)
    return (
      <p className="field-description">
        Choose a cycle to see inherited application settings and pricing.
      </p>
    )
  if (loaded?.id !== values.cycle) return <p role="status">Loading cycle settings…</p>
  if (!loaded.cycle)
    return (
      <p role="status">Could not load the cycle settings. Check the cycle before publishing.</p>
    )
  const cycle = loaded.cycle
  const {
    method,
    formId: form,
    url,
    deadline,
    price,
  } = courseRegistration(
    {
      course_type: values.course_type,
      registration: {
        method: values.method,
        form: values.form,
        url: values.url,
        deadline: values.deadline,
      },
      pricing_override: { min: values.min, max: values.max },
    },
    cycle,
  )
  const destination =
    method === 'form'
      ? form
        ? 'Site form selected'
        : 'Missing site form'
      : method === 'external'
        ? url || 'Missing external URL'
        : 'Closed'
  return (
    <aside
      style={{
        border: '1px solid var(--theme-elevation-150)',
        padding: '16px',
        marginBlockEnd: '20px',
      }}
      aria-label="Effective application settings"
    >
      <strong>Effective settings · {cycle.title}</strong>
      <p>
        Registration: {destination}
        {!values.method ? ' · inherited from cycle' : ''}
      </p>
      <p>
        Deadline:{' '}
        {deadline
          ? new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeZone: CAIRO,
            }).format(new Date(deadline))
          : 'No deadline'}
      </p>
      <p>
        Price: {priceLabel(price) ?? 'Not set'}
        {values.min == null ? ' · inherited from cycle' : ' · course override'}
      </p>
    </aside>
  )
}
