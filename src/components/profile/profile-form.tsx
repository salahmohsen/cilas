'use client'

import { useRef, useState } from 'react'
import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

import type { PhotoState, ProfileState } from '@/app/(frontend)/[locale]/profile/actions'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { AvatarUpload } from '@/components/image-upload/avatar-upload'
import { sendWithProgress } from '@/components/image-upload/send'
import { RichField } from '@/components/rich-field'
import { bioBaseline, bioToSend } from '@/components/profile/bio'
import type { ProfileMessages } from '@/components/profile/messages'
import { Select } from '@/components/select'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { ProfileError, ProfileView } from '@/lib/profile'

import styles from './profile-form.module.css'

const platformLabel = (p: string) => (p === 'x' ? 'X' : p.charAt(0).toUpperCase() + p.slice(1))

/** The rule the server keeps (lib/profile): a web address starting with http:// or https://. */
const HTTP_URL = /^https?:\/\/\S+$/i
const NAME_MAX = 120
const LINKS_MAX = 8

export type { ProfileMessages }

type Link = ProfileView['socialLinks'][number]
type Values = { nameEn: string; nameAr: string; website: string; socialLinks: Link[] }

type Props = {
  profile: ProfileView
  messages: ProfileMessages
  action: (state: ProfileState, form: FormData) => Promise<ProfileState>
  removePhotoAction: () => Promise<PhotoState>
  /** After a save that worked, such as closing the drawer the form sits in. */
  onSaved?: () => void
}

/** Which field an error the server names belongs to; the others show beside Save. */
const SERVER_FIELD: Partial<Record<ProfileError, keyof Values>> = {
  name: 'nameEn',
  'name-ar': 'nameAr',
  website: 'website',
}

/**
 * The member's own profile. TanStack Form checks the fields on submit, then as
 * they change, and focuses the first one that needs fixing; the server checks
 * them again and its answer lands under the same field. The bios are edited
 * as Markdown with Arc's rich text editor; the server stores them as Lexical.
 */
export function ProfileForm({ profile, messages: m, action, removePhotoAction, onSaved }: Props) {
  const locale = useLocale()
  const router = useRouter()
  const root = useRef<HTMLFormElement>(null)
  const [bioEn, setBioEn] = useState(profile.bio.en)
  const [bioAr, setBioAr] = useState(profile.bio.ar)
  const [result, setResult] = useState<ProfileState>({ status: 'idle' })
  // The editor's own rendering of each stored bio, found on first use (it needs the
  // browser) and found again when the stored bio changes.
  const baselines = useRef<{ en?: [string, string]; ar?: [string, string] }>({})
  const bioFor = (lang: 'en' | 'ar', edited: string) => {
    const original = profile.bio[lang]
    let cached = baselines.current[lang]
    if (cached?.[0] !== original)
      cached = baselines.current[lang] = [original, bioBaseline(original)]
    return bioToSend(original, edited, cached[1])
  }

  const nameEnError = (value: string) =>
    !value.trim() ? m.errors.name : value.trim().length > NAME_MAX ? m.nameLong : undefined
  // The server refuses emptying an Arabic name once it is set.
  const nameArError = (value: string) =>
    profile.name.ar.trim() && !value.trim()
      ? m.errors['name-ar']
      : value.trim().length > NAME_MAX
        ? m.nameLong
        : undefined
  const websiteError = (value: string) =>
    value.trim() && !HTTP_URL.test(value.trim()) ? m.errors.website : undefined
  const linkError = (url: string) =>
    !url.trim() ? m.linkEmpty : !HTTP_URL.test(url.trim()) ? m.linkInvalid : undefined

  const check = (value: Values) => {
    const fields = Object.fromEntries(
      [
        ['nameEn', nameEnError(value.nameEn)] as const,
        ['nameAr', nameArError(value.nameAr)] as const,
        ['website', websiteError(value.website)] as const,
        ...value.socialLinks.map((l, i) => [`socialLinks[${i}].url`, linkError(l.url)] as const),
      ].filter(([, error]) => error),
    )
    return Object.keys(fields).length ? { fields } : undefined
  }

  const focusFirstError = () =>
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    )

  const form = useForm({
    defaultValues: {
      nameEn: profile.name.en,
      nameAr: profile.name.ar,
      website: profile.website,
      socialLinks: profile.socialLinks,
    } as Values,
    onSubmit: async ({ value }) => {
      const data = new FormData()
      data.set('name_en', value.nameEn)
      data.set('name_ar', value.nameAr)
      data.set('bio_en', bioEn)
      data.set('bio_ar', bioAr)
      data.set('website', value.website.trim())
      data.set(
        'socialLinks',
        JSON.stringify(value.socialLinks.map((l) => ({ ...l, url: l.url.trim() }))),
      )
      const next = await action({ status: 'idle' }, data).catch((): ProfileState => ({
        status: 'error',
        error: 'no-person',
      }))
      setResult(next)
      if (next.status === 'error') {
        const field = SERVER_FIELD[next.error]
        if (field)
          form.setFieldMeta(field, (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onServer: m.errors[next.error] },
          }))
        focusFirstError()
        return
      }
      router.refresh()
      onSaved?.()
    },
    // Every field at once, so Save names all that need fixing, and each rechecks as it changes.
    validators: { onChange: ({ value }) => check(value), onSubmit: ({ value }) => check(value) },
    onSubmitInvalid: focusFirstError,
  })

  const attempts = useSelector(form.store, (s) => s.submissionAttempts)
  const submitting = useSelector(form.store, (s) => s.isSubmitting)
  const errorOf = (field: AnyFieldApi) =>
    field.state.meta.isBlurred || attempts > 0
      ? (field.state.meta.errors.find(Boolean) as string | undefined)
      : undefined
  // A field the member changes drops the server's old verdict on it.
  const clearServer = (field: AnyFieldApi) => {
    if (field.state.meta.errorMap.onServer)
      field.setMeta((meta) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }))
  }
  const lineError =
    !submitting && result.status === 'error' && !SERVER_FIELD[result.error]
      ? m.errors[result.error]
      : undefined

  return (
    <form
      ref={root}
      noValidate
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        setResult({ status: 'idle' })
        void form.handleSubmit()
      }}
    >
      {/* The photo saves the moment it is cropped, on its own: the form's Save is for the words. */}
      <AvatarUpload
        name={(locale === 'ar' && profile.name.ar) || profile.name.en}
        src={profile.photo?.url}
        onUpload={async (image, { report, signal, original }) => {
          const data = new FormData()
          const type = image.type === 'image/png' ? 'png' : 'jpg'
          const name = `${original.name.replace(/\.[^.]+$/, '') || 'photo'}.${type}`
          data.set('photo', new File([image], name, { type: image.type }))
          const sent = await sendWithProgress<PhotoState>('/api/profile-photo', data, {
            onProgress: report,
            signal,
          }).catch((error: unknown) => {
            if (signal.aborted) throw error
            return { ok: false, error: 'photo' } as const
          })
          if (!sent.ok) throw new Error(m.errors[sent.error])
          // The header's avatar and the rest of the page read the new photo.
          router.refresh()
          return sent.url ?? undefined
        }}
        onRemove={async () => {
          const removed = await removePhotoAction()
          if (!removed.ok) throw new Error(m.errors[removed.error])
        }}
      />

      <p className={styles.note}>{profile.visible ? m.public : m.private}</p>

      <div className={styles.pair}>
        <form.Field name="nameEn">
          {(field) => (
            <Input
              label={m.nameEn}
              name="name_en"
              autoComplete="name"
              required
              dir="ltr"
              value={field.state.value}
              onChange={(e) => {
                clearServer(field)
                field.handleChange(e.target.value)
              }}
              onBlur={field.handleBlur}
              error={errorOf(field)}
            />
          )}
        </form.Field>
        <form.Field name="nameAr">
          {(field) => (
            <Input
              label={m.nameAr}
              name="name_ar"
              dir="rtl"
              value={field.state.value}
              onChange={(e) => {
                clearServer(field)
                field.handleChange(e.target.value)
              }}
              onBlur={field.handleBlur}
              error={errorOf(field)}
            />
          )}
        </form.Field>
      </div>

      <RichField
        label={m.bioEn}
        dir="ltr"
        defaultMarkdown={profile.bio.en}
        onChange={(value) => setBioEn(bioFor('en', value.markdown))}
      />
      <RichField
        label={m.bioAr}
        dir="rtl"
        defaultMarkdown={profile.bio.ar}
        onChange={(value) => setBioAr(bioFor('ar', value.markdown))}
      />

      <form.Field name="website">
        {(field) => (
          <Input
            label={m.website}
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            dir="ltr"
            value={field.state.value}
            onChange={(e) => {
              clearServer(field)
              field.handleChange(e.target.value)
            }}
            onBlur={field.handleBlur}
            error={errorOf(field)}
          />
        )}
      </form.Field>

      <form.Field name="socialLinks" mode="array">
        {(links) => (
          <fieldset className={styles.links}>
            <legend className={styles.legend}>{m.social}</legend>
            {links.state.value.map((link, i) => (
              <div key={i} className={styles.linkRow}>
                <form.Field name={`socialLinks[${i}].platform`}>
                  {(field) => (
                    <div className={styles.platform}>
                      <Select
                        label={m.platform}
                        value={field.state.value}
                        items={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: platformLabel(p) }))}
                        onValueChange={(value) => field.handleChange(value as Link['platform'])}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name={`socialLinks[${i}].url`}>
                  {(field) => (
                    <div className={styles.url}>
                      <Input
                        label={m.url}
                        type="url"
                        inputMode="url"
                        placeholder="https://"
                        dir="ltr"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        error={errorOf(field)}
                      />
                    </div>
                  )}
                </form.Field>
                <Tooltip content={m.removeLink}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={styles.remove}
                    aria-label={`${m.removeLink}: ${platformLabel(link.platform)}`}
                    onClick={() => links.removeValue(i)}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                </Tooltip>
              </div>
            ))}
            {links.state.value.length < LINKS_MAX && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => links.pushValue({ platform: 'instagram', url: '' })}
                >
                  <Plus size={16} aria-hidden="true" />
                  {m.addLink}
                </Button>
              </div>
            )}
          </fieldset>
        )}
      </form.Field>

      <div className={styles.foot}>
        <Button type="submit" loading={submitting}>
          {m.save}
        </Button>
        <p role="status" className={styles.saved}>
          {!submitting && result.status === 'saved' ? m.saved : ''}
        </p>
        {lineError && (
          <p role="alert" className={styles.lineError}>
            {lineError}
          </p>
        )}
      </div>
    </form>
  )
}
