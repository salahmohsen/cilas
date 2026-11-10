'use client'

import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { FileUpload, type FileUploadItem } from '@/components/arc/file-upload/file-upload'
import { Input } from '@/components/arc/input/input'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Select } from '@/components/arc/select/select'
import { Textarea } from '@/components/arc/textarea/textarea'
import { useSpamCheck } from '@/components/forms/spam-check'
import { useDraft } from '@/components/use-draft'
import { useSession } from '@/components/use-session'
import { isRtl } from '@/i18n/routing'
import { Link } from '@/i18n/navigation'
import { track } from '@/lib/analytics/track'
import { acceptAttribute, acceptedLabel, maxBytes, maxCount } from '@/lib/form-files'
import type { Form, Media } from '@/payload-types'

type Block = NonNullable<Form['fields']>[number]
type Question = Exclude<Block, { blockType: 'message' }>
type Answer = string | string[] | boolean | FileUploadItem[]
type Values = Record<string, Answer>

const isQuestion = (b: Block): b is Question =>
  b.blockType !== 'message' && 'name' in b && Boolean(b.name)
const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const emptyFor = (q: Question): Answer =>
  q.blockType === 'checkboxGroup' || q.blockType === 'fileUpload'
    ? []
    : q.blockType === 'checkbox'
      ? false
      : ''
const isFiles = (q: Question) => q.blockType === 'fileUpload'
const goodFiles = (value: Answer | undefined) =>
  Array.isArray(value)
    ? (value as FileUploadItem[]).filter((i) => typeof i === 'object' && !i.error)
    : []
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
  preview = false,
  target,
  analytics,
}: {
  form: Form
  notes?: Record<string, ReactNode>
  confirmation: ReactNode
  back?: { href: string; label: string }
  /** What the applicant applies to; admins accept the submission into it. */
  target?: { relationTo: 'programmes' | 'courses'; value: number }
  /** What the counters call this application: a course or programme and its public slug. */
  analytics?: { kind: 'course' | 'programme'; id: string }
  /** The questions' language, when it is not the page's. */
  lang?: string
  /** The questions are shown to read, not to answer (applications closed). */
  disabled?: boolean
  preview?: boolean
}) {
  const t = useTranslations('Forms')
  const blocks = form.fields ?? []
  const questions = blocks.filter(isQuestion)
  const draftKey = `cilas-form-${form.id}`
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  const spam = useSpamCheck()
  const started = useRef(false)

  /**
   * Who is signed in, so their name and email fill the two default questions
   * and lock them. The ask comes back only with a session cookie, like the
   * site header's account menu.
   */
  const session = useSession()
  const sessionName = typeof session?.person === 'object' ? (session.person?.name ?? null) : null
  const me = useMemo(
    () => (!disabled && session?.email ? { name: sessionName, email: session.email } : null),
    [disabled, session?.email, sessionName],
  )
  const locked = (q: Question) =>
    Boolean(me) && (q.name === 'email' || (q.name === 'name' && Boolean(me?.name)))

  const check = (q: Question, value: Answer): string | undefined => {
    if (isFiles(q)) {
      const items = (value as FileUploadItem[]) ?? []
      if (items.some((i) => i.error)) return t('fileInvalid')
      return q.required && !items.length ? t('required') : undefined
    }
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
    if (isFiles(q)) return ''
    if (Array.isArray(value)) return (value as string[]).map(label).join(', ')
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return q.blockType === 'radio' || q.blockType === 'select' ? label(value) : value
  }

  const api = useForm({
    defaultValues: Object.fromEntries(questions.map((q) => [q.name, emptyFor(q)])) as Values,
    onSubmit: async ({ value }) => {
      if (preview || disabled) return
      setFailed(false)
      const sent = {
        form: form.id,
        target,
        submissionData: questions.map((q) => ({
          field: q.name,
          value: readable(q, value[q.name] ?? emptyFor(q)),
        })),
      }
      // With files, answers and files go in one request: the spam check's
      // token passes once (src/forms/submit-with-files.ts).
      const files = questions.flatMap((q) =>
        isFiles(q) ? goodFiles(value[q.name]).map((i) => [q.name, i.file] as const) : [],
      )
      const res = await spam.submit(sent, files).catch(() => undefined)
      if (res === undefined || (res !== null && !res.ok)) {
        setFailed(true)
        return
      }
      clearDraft()
      if (analytics) track('apply_submitted', analytics)
      setSent(true)
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    onSubmitInvalid: ({ formApi }) => {
      const first = questions.find((q) => formApi.getFieldMeta(q.name)?.errors.length)
      if (first) document.getElementById(fieldId(first.name))?.focus()
    },
  })

  const values = useSelector(api.store, (s) => s.values)
  // As one string, so the effect below sees it change only when the questions do.
  const fileNames = questions
    .filter(isFiles)
    .map((q) => q.name)
    .join('\n')
  /** The default questions an account holds, as one string for the effects. */
  const givenNames = questions
    .filter((q) => q.name === 'email' || q.name === 'name')
    .map((q) => q.name)
    .join('\n')
  // Files cannot be kept on the device; the rest of the answers are, except
  // what a signed-in account holds (its identity, not a draft).
  const skip = me ? [...givenNames.split('\n'), ...fileNames.split('\n')] : fileNames.split('\n')
  const { clear: clearDraft } = useDraft<Values>(draftKey, {
    enabled: !disabled && !preview,
    draft: sent
      ? null
      : Object.fromEntries(
          Object.entries(values).filter(([name]) => !skip.includes(name) && name !== ''),
        ),
    onRestore: (saved) => {
      for (const q of questions)
        if (q.name in saved && !isFiles(q))
          api.setFieldValue(q.name, saved[q.name]!, { dontUpdateMeta: true })
    },
  })

  // When the identity arrives it wins over any draft: the account's answers
  // are set and nothing of theirs sits in the draft on a shared device.
  useEffect(() => {
    if (me) {
      if (givenNames.includes('email')) api.setFieldValue('email', me.email)
      if (me.name && givenNames.includes('name')) api.setFieldValue('name', me.name)
    }
  }, [me, api, givenNames])

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
      case 'fileUpload': {
        const items = (field.state.value as FileUploadItem[]) ?? []
        const help = t('fileHelp', {
          kinds: acceptedLabel(q),
          size: Math.round(maxBytes(q) / 1048576),
        })
        return (
          <div id={fieldId(q.name)} tabIndex={-1}>
            <FileUpload
              accept={acceptAttribute(q)}
              description={description ? `${description} ${help}` : help}
              label={label(q)}
              maxSize={maxBytes(q)}
              multiple={maxCount(q) > 1}
              onChange={(next) => {
                field.handleChange(next.slice(-maxCount(q)))
                field.handleBlur()
              }}
              value={items}
            />
            {error ? (
              <p className="payload-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )
      }
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
      case 'select': {
        return (
          <div id={fieldId(q.name)} tabIndex={-1}>
            <Select
              description={description ?? undefined}
              label={label(q)}
              onValueChange={(v) => field.handleChange(v)}
              options={optionsOf(q).map((o) => ({ value: o.value, label: o.label }))}
              placeholder={q.placeholder || undefined}
              value={String(field.state.value ?? '')}
            />
            {error ? (
              <p className="payload-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
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
            disabled={locked(q)}
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
      dir={lang ? (isRtl(lang) ? 'rtl' : 'ltr') : undefined}
      lang={lang}
      noValidate
      // The first time someone enters a field: they have started. Nothing they type is sent.
      onFocusCapture={() => {
        if (!analytics || disabled || preview || started.current) return
        started.current = true
        track('apply_started', analytics)
      }}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!preview && !disabled) api.handleSubmit()
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

      {disabled || preview ? null : spam.fields}
      {preview ? (
        <div className="payload-form-actions">
          <button className="course-apply payload-form-submit" disabled type="submit">
            {form.submitButtonLabel ?? t('submit')}
          </button>
          <p className="payload-form-status">{t('preview')}</p>
        </div>
      ) : disabled ? null : (
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
