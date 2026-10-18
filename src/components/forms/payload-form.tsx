'use client'

import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'

import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Input } from '@/components/arc/input/input'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Textarea } from '@/components/arc/textarea/textarea'
import { useSpamCheck } from '@/components/forms/spam-check'
import { Link } from '@/i18n/navigation'
import type { Form, Media } from '@/payload-types'

type Block = NonNullable<Form['fields']>[number]
type Question = Exclude<Block, { blockType: 'message' }>
type Answer = string | string[] | boolean
type Values = Record<string, Answer>

const isQuestion = (b: Block): b is Question =>
  b.blockType !== 'message' && 'name' in b && Boolean(b.name)
const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const emptyFor = (q: Question): Answer =>
  q.blockType === 'checkboxGroup' ? [] : q.blockType === 'checkbox' ? false : ''
const optionsOf = (q: Question) => ('options' in q && q.options ? q.options : [])
const fieldId = (name: string) => `field-${name}`

// An address in help text, without the punctuation that ends its sentence.
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]])/g

/** Help text as written, its web addresses made into links that open in a new tab. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 ? (
          <a
            className="payload-form-link"
            href={part}
            key={i}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * A form built in the admin (Payload's form builder), answered here: each
 * question with its help text, essays with their image and a word count, and
 * the answers sent as a form submission. Mistakes show once a question is
 * left or a send is tried; sending with gaps moves to the first one. The
 * answers stay on the device until they are sent, so a long application
 * survives a closed tab.
 *
 * `notes` holds what the server rendered for the form's text blocks (by block
 * id) and `confirmation` the message shown once sent, closed by a link `back`.
 */
export function PayloadForm({
  form,
  notes = {},
  confirmation,
  back,
  lang,
  disabled = false,
}: {
  form: Form
  notes?: Record<string, ReactNode>
  confirmation: ReactNode
  back?: { href: string; label: string }
  /** The questions' language, when it is not the page's. */
  lang?: string
  /** The questions are shown to read, not to answer (applications closed). */
  disabled?: boolean
}) {
  const t = useTranslations('Forms')
  const blocks = form.fields ?? []
  const questions = blocks.filter(isQuestion)
  const draftKey = `cilas-form-${form.id}`
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  const spam = useSpamCheck()

  const check = (q: Question, value: Answer): string | undefined => {
    const empty = Array.isArray(value)
      ? value.length === 0
      : value === false || String(value).trim() === ''
    if (empty)
      return q.required
        ? q.blockType === 'checkboxGroup'
          ? t('pickOne')
          : t('required')
        : undefined
    if (q.blockType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
      return t('email')
    if (q.blockType === 'textarea' && q.minWords) {
      const count = wordsIn(String(value))
      if (count < q.minWords) return t('tooShort', { min: q.minWords, count })
    }
    return undefined
  }

  // Answers as the admin reads them: the chosen options' labels, not their values.
  const readable = (q: Question, value: Answer): string => {
    const label = (v: string) => optionsOf(q).find((o) => o.value === v)?.label ?? v
    if (Array.isArray(value)) return value.map(label).join(', ')
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return q.blockType === 'radio' ? label(value) : value
  }

  const api = useForm({
    defaultValues: Object.fromEntries(questions.map((q) => [q.name, emptyFor(q)])) as Values,
    onSubmit: async ({ value }) => {
      setFailed(false)
      const res = spam.isBot()
        ? new Response(null)
        : await spam
            .headers()
            .then((headers) =>
              fetch('/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({
                  form: form.id,
                  submissionData: questions.map((q) => ({
                    field: q.name,
                    value: readable(q, value[q.name] ?? emptyFor(q)),
                  })),
                }),
              }),
            )
            .catch(() => null)
      spam.reset()
      if (!res?.ok) {
        setFailed(true)
        return
      }
      try {
        localStorage.removeItem(draftKey)
      } catch {}
      setSent(true)
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    onSubmitInvalid: ({ formApi }) => {
      const first = questions.find((q) => formApi.getFieldMeta(q.name)?.errors.length)
      if (first) document.getElementById(fieldId(first.name))?.focus()
    },
  })

  // The draft: restored once, then kept as the answers change.
  useEffect(() => {
    if (disabled) return
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as Values | null
      if (saved)
        for (const q of questions)
          if (q.name in saved) api.setFieldValue(q.name, saved[q.name]!, { dontUpdateMeta: true })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const values = useSelector(api.store, (s) => s.values)
  useEffect(() => {
    if (disabled || sent) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values))
      } catch {}
    }, 500)
    return () => clearTimeout(id)
  }, [values, draftKey, disabled, sent])

  const attempts = useSelector(api.store, (s) => s.submissionAttempts)
  const errorOf = (field: AnyFieldApi) =>
    field.state.meta.isBlurred || attempts > 0
      ? (field.state.meta.errors[0] as string | undefined)
      : undefined

  if (sent) {
    return (
      <section
        aria-labelledby="payload-form-sent"
        className="payload-form-sent"
        ref={top}
        role="status"
      >
        <span aria-hidden className="payload-form-sent-mark">
          <Check size={20} strokeWidth={2} />
        </span>
        <h2 id="payload-form-sent">{t('sent')}</h2>
        {confirmation}
        {back ? (
          <Link className="bridge-link" href={back.href}>
            {back.label}
          </Link>
        ) : null}
      </section>
    )
  }

  const label = (q: Question) => `${q.label ?? q.name}${q.required ? '' : ` (${t('optional')})`}`

  const render = (q: Question, field: AnyFieldApi) => {
    const error = errorOf(field)
    const description = ('description' in q && q.description) || undefined
    switch (q.blockType) {
      case 'textarea': {
        const image = typeof q.image === 'object' && q.image ? (q.image as Media) : null
        const count = wordsIn(String(field.state.value ?? ''))
        const lead =
          description || image?.url ? (
            <>
              {description ? (
                <p className="whitespace-pre-line">
                  <Linked text={description} />
                </p>
              ) : null}
              {image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={image.alt ?? ''}
                  className="payload-form-image"
                  loading="lazy"
                  src={image.url}
                />
              ) : null}
            </>
          ) : undefined
        return (
          <>
            <Textarea
              error={error}
              lead={lead}
              id={fieldId(q.name)}
              label={label(q)}
              name={q.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required={Boolean(q.required)}
              rows={q.minWords ? 10 : 5}
              value={String(field.state.value ?? '')}
            />
            {q.minWords ? (
              <p
                aria-live="polite"
                className="payload-form-count"
                data-short={count < q.minWords || undefined}
              >
                {t('words', { count, min: q.minWords })}
              </p>
            ) : null}
          </>
        )
      }
      case 'radio':
        return (
          <RadioGroup
            description={description ? <Linked text={description} /> : undefined}
            error={error}
            label={label(q)}
            name={q.name}
            onBlur={field.handleBlur}
            onValueChange={(v) => field.handleChange(v)}
            options={optionsOf(q).map((o) => ({ value: o.value, label: o.label }))}
            required={Boolean(q.required)}
            value={String(field.state.value ?? '')}
          />
        )
      case 'checkboxGroup': {
        const chosen = (field.state.value as string[]) ?? []
        return (
          <fieldset
            aria-describedby={error ? `${fieldId(q.name)}-error` : undefined}
            aria-invalid={error ? true : undefined}
            className="payload-form-group"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) field.handleBlur()
            }}
          >
            <legend>{label(q)}</legend>
            {description ? (
              <p className="payload-form-description">
                <Linked text={description} />
              </p>
            ) : null}
            <div className="payload-form-options">
              {optionsOf(q).map((o, i) => (
                <Checkbox
                  checked={chosen.includes(o.value)}
                  id={i === 0 ? fieldId(q.name) : undefined}
                  key={o.value}
                  label={o.label}
                  onCheckedChange={(on) =>
                    field.handleChange(
                      on ? [...chosen, o.value] : chosen.filter((v) => v !== o.value),
                    )
                  }
                />
              ))}
            </div>
            {error ? (
              <p className="payload-form-error" id={`${fieldId(q.name)}-error`} role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        )
      }
      case 'checkbox':
        return (
          <Checkbox
            checked={Boolean(field.state.value)}
            description={error ?? description}
            id={fieldId(q.name)}
            label={label(q)}
            onCheckedChange={(on) => field.handleChange(on === true)}
          />
        )
      default:
        return (
          <Input
            error={error}
            lead={
              description ? (
                <p>
                  <Linked text={description} />
                </p>
              ) : undefined
            }
            id={fieldId(q.name)}
            inputMode={
              q.blockType === 'number' ? 'decimal' : q.blockType === 'email' ? 'email' : undefined
            }
            label={label(q)}
            name={q.name}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            required={Boolean(q.required)}
            type={q.blockType === 'email' ? 'email' : 'text'}
            value={String(field.state.value ?? '')}
          />
        )
    }
  }

  return (
    <form
      className="payload-form"
      dir={lang ? (lang === 'ar' ? 'rtl' : 'ltr') : undefined}
      lang={lang}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        api.handleSubmit()
      }}
    >
      <div ref={top} />
      <fieldset className="payload-form-questions" disabled={disabled}>
        {blocks.map((block, i) => {
          if (block.blockType === 'message') {
            return (
              <div className="payload-form-note" key={block.id ?? i}>
                {notes[block.id ?? ''] ?? null}
              </div>
            )
          }
          if (!isQuestion(block)) return null
          const q = block
          return (
            <api.Field
              key={q.id ?? q.name}
              name={q.name}
              validators={{
                onBlur: ({ value }) => check(q, value),
                onChange: ({ value }) => check(q, value),
                onSubmit: ({ value }) => check(q, value),
              }}
            >
              {(field) => <div className="payload-form-question">{render(q, field)}</div>}
            </api.Field>
          )
        })}
      </fieldset>

      {disabled ? null : spam.fields}
      {disabled ? null : (
        <api.Subscribe
          selector={(s) =>
            [s.isSubmitting, s.submissionAttempts, s.errors.length, s.fieldMeta] as const
          }
        >
          {([submitting, tried, , meta]) => {
            const gaps = Object.values(meta ?? {}).filter((m) => m?.errors?.length).length
            return (
              <div className="payload-form-actions">
                <button
                  className="course-apply payload-form-submit"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? t('sending') : (form.submitButtonLabel ?? t('submit'))}
                </button>
                <p aria-live="polite" className="payload-form-status">
                  {failed ? (
                    <span className="payload-form-error">{t('failed')}</span>
                  ) : tried > 0 && gaps > 0 ? (
                    <span className="payload-form-error">{t('fix', { count: gaps })}</span>
                  ) : (
                    t('draft')
                  )}
                </p>
              </div>
            )
          }}
        </api.Subscribe>
      )}
    </form>
  )
}
