'use client'

import Image from 'next/image'
import type { useTranslations } from 'next-intl'
import { RichTextField } from '@/components/RichTextField'
import { PhoneInput } from '@/components/arc/phone-input/phone-input'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { FileUpload, type FileUploadItem } from '@/components/arc/file-upload/file-upload'
import { Input } from '@/components/arc/input/input'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Select } from '@/components/arc/select/select'
import { Textarea } from '@/components/arc/textarea/textarea'
import { acceptAttribute, acceptedLabel, maxBytes, maxCount } from '@/lib/form-files'
import type { Form, Media } from '@/payload-types'

export type Block = NonNullable<Form['fields']>[number]
export type Question = Exclude<Block, { blockType: 'message' }>
export type Answer = string | string[] | boolean | FileUploadItem[]
export const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
export const fieldId = (name: string) => `field-${name}`
const optionsOf = (q: Question) => ('options' in q && q.options ? q.options : [])

export function PayloadQuestion({
  q,
  field,
  error,
  label,
  t,
  locked = false,
}: {
  q: Question
  field: {
    state: { value: Answer | undefined }
    handleChange: (value: Answer) => void
    handleBlur: () => void
  }
  error?: string
  label: (q: Question) => string
  locked?: boolean
  t: ReturnType<typeof useTranslations<'Forms'>>
}) {
  const description =
    'description' in q && q.description ? (
      <RichTextField
        data={q.description}
        plain
        className="article-prose payload-form-description"
      />
    ) : undefined
  switch (q.blockType) {
    case 'phone':
      return (
        <>
          <PhoneInput
            id={fieldId(q.name)}
            label={label(q)}
            defaultCountry={q.defaultCountry ?? 'EG'}
            value={String(field.state.value ?? '')}
            onValueChange={(value) => field.handleChange(value)}
            onBlur={field.handleBlur}
            required={Boolean(q.required)}
            error={error}
            aria-describedby={description ? `${fieldId(q.name)}-description` : undefined}
          />
          {description ? <div id={`${fieldId(q.name)}-description`}>{description}</div> : null}
        </>
      )
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
            description={
              <>
                {description}
                <span>{help}</span>
              </>
            }
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
            {description ? <div>{description}</div> : null}
            {image?.url ? (
              <Image
                width={image.width || 800}
                height={image.height || 600}
                sizes="auto, min(34rem, calc(100vw - 2rem))"
                style={{ height: 'auto' }}
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
          description={description}
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
          aria-describedby={
            [
              description ? `${fieldId(q.name)}-description` : '',
              error ? `${fieldId(q.name)}-error` : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-invalid={error ? true : undefined}
          className="payload-form-group"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) field.handleBlur()
          }}
        >
          <legend>{label(q)}</legend>
          {description ? <div id={`${fieldId(q.name)}-description`}>{description}</div> : null}
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
          description={
            <>
              {description}
              {error ? <span role="alert">{error}</span> : null}
            </>
          }
          id={fieldId(q.name)}
          label={label(q)}
          onCheckedChange={(on) => field.handleChange(on === true)}
        />
      )
    default:
      return (
        <Input
          disabled={locked}
          error={error}
          lead={description ? <div>{description}</div> : undefined}
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
