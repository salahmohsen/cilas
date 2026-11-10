'use client'

import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Check } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Badge } from '@/components/arc/badge/badge'
import { ElasticSlider } from '@/components/arc/elastic-slider/elastic-slider'
import { localDigits } from '@/lib/digits'
import { amountsOf, defaultAmountOf, formatAmount } from '@/lib/pricing'
import {
  amountKey,
  choiceField,
  reductionKey,
  selectedKey,
  type ApplicationContext,
} from '@/forms/application-choices'

import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { FileUpload, type FileUploadItem } from '@/components/arc/file-upload/file-upload'
import { Input } from '@/components/arc/input/input'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Select } from '@/components/arc/select/select'
import { Textarea } from '@/components/arc/textarea/textarea'
import { failureMessage, looksSent, useSpamCheck } from '@/components/forms/spam-check'
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

export function PayloadForm({
  form,
  notes = {},
  confirmation,
  back,
  lang,
  disabled = false,
  preview = false,
  target,
  application,
  analytics,
}: {
  form: Form
  notes?: Record<string, ReactNode>
  confirmation: ReactNode
  back?: { href: string; label: string }
  target?: { relationTo: 'programmes' | 'courses' | 'cycles'; value: number }
  application?: ApplicationContext
  analytics?: { kind: 'course' | 'programme'; id: string }
  /** The questions' language, when it is not the page's. */
  lang?: string
  /** The questions are shown to read, not to answer (applications closed). */
  disabled?: boolean
  preview?: boolean
}) {
  const t = useTranslations('Forms')
  const locale = useLocale()
  const blocks = form.fields ?? []
  const sharedQuestions = blocks.filter(isQuestion)
  const selectedCourses = (value: Values) =>
    application?.courses.filter(
      (c) =>
        !application.selectable || ((value[selectedKey] as string[]) ?? []).includes(String(c.id)),
    ) ?? []
  const questionsFor = (value: Values) => [
    ...sharedQuestions,
    ...selectedCourses(value).flatMap((c) =>
      c.questions.map((q) => ({ ...q, name: choiceField(c.id, q.name) }) as Question),
    ),
  ]
  const draftKey = `cilas-form-${form.id}`
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const top = useRef<HTMLDivElement>(null)
  const spam = useSpamCheck()
  const started = useRef(false)

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

  /** Choices are saved as option values; readers show their labels (answerText). */
  const saved = (q: Question, value: Answer): string => {
    if (isFiles(q)) return ''
    if (Array.isArray(value)) return (value as string[]).join(', ')
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value
  }

  const api = useForm({
    defaultValues: {
      ...Object.fromEntries(sharedQuestions.map((q) => [q.name, emptyFor(q)])),
      ...(application
        ? {
            [selectedKey]: application.initialCourse ? [String(application.initialCourse)] : [],
            ...Object.fromEntries(
              application.courses.flatMap((c) => [
                [amountKey(c.id), String(defaultAmountOf(c.contribution) ?? '')],
                [reductionKey(c.id), false],
              ]),
            ),
          }
        : {}),
    } as Values,
    onSubmit: async ({ value }) => {
      if (preview || disabled) return
      setFailed(null)
      const questions = questionsFor(value)
      const answers = sharedQuestions.map((q) => ({
        field: q.name,
        value: saved(q, value[q.name] ?? emptyFor(q)),
      }))
      const sent = {
        form: form.id,
        target,
        submissionData: answers,
        ...(application
          ? {
              choices: selectedCourses(value).map((c) => ({
                course: c.id,
                amount: value[amountKey(c.id)] === '' ? undefined : Number(value[amountKey(c.id)]),
                need_reduction: Boolean(value[reductionKey(c.id)]),
                answers: c.questions.map((q) => ({
                  name: q.name,
                  value: saved(
                    q as Question,
                    value[choiceField(c.id, q.name)] ?? emptyFor(q as Question),
                  ),
                })),
              })),
            }
          : {}),
      }
      const files = questions.flatMap((q) =>
        isFiles(q) ? goodFiles(value[q.name]).map((i) => [q.name, i.file] as const) : [],
      )
      const result = await spam.submit(sent, files)
      if (!looksSent(result)) {
        setFailed(failureMessage(result, t))
        return
      }
      clearDraft()
      if (analytics) track('apply_submitted', analytics)
      setSent(true)
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    onSubmitInvalid: ({ formApi }) => {
      const first = questionsFor(formApi.state.values).find(
        (q) => formApi.getFieldMeta(q.name)?.errors.length,
      )
      if (first) document.getElementById(fieldId(first.name))?.focus()
    },
  })

  const values = useSelector(api.store, (s) => s.values)
  const questions = questionsFor(values)
  const chosen = selectedCourses(values)
  const fileNames = questions
    .filter(isFiles)
    .map((q) => q.name)
    .join('\n')
  const givenNames = questions
    .filter((q) => q.name === 'email' || q.name === 'name')
    .map((q) => q.name)
    .join('\n')
  const skip = me ? [...givenNames.split('\n'), ...fileNames.split('\n')] : fileNames.split('\n')
  const { clear: clearDraft } = useDraft<Values>(draftKey, {
    enabled: !disabled && !preview,
    draft: sent
      ? null
      : Object.fromEntries(
          Object.entries(values).filter(([name]) => !skip.includes(name) && name !== ''),
        ),
    onRestore: (saved) => {
      const restored = { ...api.state.values, ...saved }
      const allowed = new Set(
        questionsFor(restored)
          .filter((q) => !isFiles(q))
          .map((q) => q.name),
      )
      if (application) {
        allowed.add(selectedKey)
        for (const c of application.courses) {
          allowed.add(amountKey(c.id))
          allowed.add(reductionKey(c.id))
        }
      }
      for (const [name, value] of Object.entries(saved))
        if (allowed.has(name)) api.setFieldValue(name, value, { dontUpdateMeta: true })
    },
  })

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

  const renderQuestion = (q: Question) => (
    <api.Field
      key={q.name}
      name={q.name}
      validators={{
        onBlur: ({ value }) => check(q, value ?? emptyFor(q)),
        onChange: ({ value }) => check(q, value ?? emptyFor(q)),
        onSubmit: ({ value }) => check(q, value ?? emptyFor(q)),
      }}
    >
      {(field) => <div className="payload-form-question">{render(q, field)}</div>}
    </api.Field>
  )
  const renderBlock = (block: Block, i: number) =>
    block.blockType === 'message' ? (
      <div className="payload-form-note" key={block.id ?? i}>
        {notes[block.id ?? ''] ?? null}
      </div>
    ) : isQuestion(block) ? (
      renderQuestion(block)
    ) : null
  const money = (amount: number) => (amount === 0 ? t('free') : formatAmount(amount, locale))

  return (
    <form
      className="payload-form"
      dir={lang ? (isRtl(lang) ? 'rtl' : 'ltr') : undefined}
      lang={lang}
      noValidate
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
        {application ? (
          <>
            {sharedQuestions
              .filter((q) => q.name === 'name' || q.name === 'email')
              .map(renderQuestion)}
            {application.selectable ? (
              <api.Field
                name={selectedKey}
                validators={{
                  onChange: ({ value }) =>
                    (value as string[]).length ? undefined : t('chooseCourse'),
                  onSubmit: ({ value }) =>
                    (value as string[]).length ? undefined : t('chooseCourse'),
                }}
              >
                {(field) => (
                  <fieldset className="payload-form-group">
                    <legend>{t('courses')}</legend>
                    <div className="payload-form-options">
                      {application.courses.map((c) => (
                        <Checkbox
                          key={c.id}
                          label={c.title}
                          checked={chosen.some((x) => x.id === c.id)}
                          onCheckedChange={(on) => {
                            const ids = field.state.value as string[]
                            if (!on) {
                              for (const q of c.questions)
                                api.deleteField(choiceField(c.id, q.name))
                              api.setFieldValue(
                                amountKey(c.id),
                                String(defaultAmountOf(c.contribution) ?? ''),
                              )
                              api.setFieldValue(reductionKey(c.id), false)
                            }
                            field.handleChange(
                              on ? [...ids, String(c.id)] : ids.filter((id) => id !== String(c.id)),
                            )
                          }}
                        />
                      ))}
                    </div>
                    {errorOf(field) ? (
                      <p className="payload-form-error" role="alert">
                        {errorOf(field)}
                      </p>
                    ) : null}
                  </fieldset>
                )}
              </api.Field>
            ) : null}
            {blocks
              .filter((b) => !isQuestion(b) || (b.name !== 'name' && b.name !== 'email'))
              .map(renderBlock)}
            {chosen.map((c) => {
              const amounts = amountsOf(c.contribution)
              return (
                <section className="grid min-w-0 gap-6" key={c.id} aria-label={c.title}>
                  <div>
                    <Badge>
                      <span className="whitespace-normal">{c.title}</span>
                    </Badge>
                  </div>
                  {c.questions.length ? <p>{t('extraQuestions')}</p> : null}
                  {c.questions.map((q) =>
                    renderQuestion({ ...q, name: choiceField(c.id, q.name) } as Question),
                  )}
                  {amounts.length > 1 ? (
                    <api.Field name={amountKey(c.id)}>
                      {(field) => (
                        <div className="overflow-x-clip">
                          <ElasticSlider
                            label={t('contribution')}
                            disabled={disabled}
                            min={0}
                            max={amounts.length - 1}
                            step={1}
                            value={Math.max(0, amounts.indexOf(Number(field.state.value)))}
                            marks={amounts.map((amount, i) => ({
                              value: i,
                              label: localDigits(amount, locale),
                            }))}
                            format={(index) => money(amounts[index]!)}
                            onValueChange={(index) => field.handleChange(String(amounts[index]))}
                          />
                        </div>
                      )}
                    </api.Field>
                  ) : amounts.length === 1 ? (
                    <p>
                      {t('contribution')}: {money(amounts[0]!)}
                    </p>
                  ) : null}
                  {c.contribution?.need_based_deductions ? (
                    <api.Field name={reductionKey(c.id)}>
                      {(field) => (
                        <Checkbox
                          label={t('needReduction')}
                          checked={Boolean(field.state.value)}
                          onCheckedChange={(on) => field.handleChange(on === true)}
                        />
                      )}
                    </api.Field>
                  ) : null}
                  {c.contribution?.note ? (
                    <p className="payload-form-description whitespace-pre-line">
                      {c.contribution.note}
                    </p>
                  ) : null}
                </section>
              )
            })}
          </>
        ) : (
          blocks.map(renderBlock)
        )}
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
                    <span className="payload-form-error">{failed}</span>
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
