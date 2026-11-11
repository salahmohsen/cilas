'use client'

import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Check, Flower2, Sprout } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { isValidPhoneNumber, PHONE_NUMBER_ERROR } from '@/lib/phone'
import { ElasticSlider } from '@/components/arc/elastic-slider/elastic-slider'
import { localDigits } from '@/lib/digits'
import { focalPointStyle } from '@/lib/media-image'
import { amountsOf, defaultAmountOf, formatAmount } from '@/lib/pricing'
import {
  amountKey,
  choiceField,
  reductionKey,
  selectedKey,
  type ApplicationContext,
} from '@/forms/application-choices'

import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { type FileUploadItem } from '@/components/arc/file-upload/file-upload'
import { failureMessage, looksSent, useSpamCheck } from '@/components/forms/spam-check'
import { useDraft } from '@/components/use-draft'
import { useSession } from '@/components/use-session'
import { isRtl } from '@/i18n/routing'
import { Link } from '@/i18n/navigation'
import { track } from '@/lib/analytics/track'
import type { Form } from '@/payload-types'

import {
  PayloadQuestion,
  wordsIn,
  fieldId,
  type Block,
  type Question,
  type Answer,
} from './payload-question'
type Values = Record<string, Answer>

const isQuestion = (b: Block): b is Question =>
  b.blockType !== 'message' && 'name' in b && Boolean(b.name)
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
    if (q.blockType === 'phone' && !isValidPhoneNumber(String(value))) return PHONE_NUMBER_ERROR
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
        <h2 id="payload-form-sent" className="payload-form-sent-title">
          <span aria-hidden className="payload-form-sent-mark">
            <Check size={18} strokeWidth={2} />
          </span>
          {t('sent')}
        </h2>
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

  const render = (q: Question, field: AnyFieldApi) => (
    <PayloadQuestion
      q={q}
      field={field}
      error={errorOf(field)}
      label={label}
      t={t}
      locked={locked(q)}
    />
  )

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
                <section
                  className="apply-course-card"
                  key={c.id}
                  aria-labelledby={`apply-course-${c.id}`}
                >
                  <header className="apply-course-cover" data-image={c.cover ? '' : undefined}>
                    {c.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.cover.src}
                        alt=""
                        loading="lazy"
                        style={focalPointStyle(c.cover)}
                      />
                    ) : null}
                    <h2 id={`apply-course-${c.id}`}>{c.title}</h2>
                  </header>
                  <div className="apply-course-body">
                    {c.questions.map((q) =>
                      renderQuestion({ ...q, name: choiceField(c.id, q.name) } as Question),
                    )}
                    {amounts.length > 1 ? (
                      <api.Field name={amountKey(c.id)}>
                        {(field) => (
                          <div className="apply-course-slider">
                            <ElasticSlider
                              startIcon={<Sprout size={18} aria-hidden />}
                              endIcon={<Flower2 size={18} aria-hidden />}
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
                  </div>
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
