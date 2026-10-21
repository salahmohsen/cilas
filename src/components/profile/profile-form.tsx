'use client'

import { startTransition, useActionState, useRef, useState } from 'react'

import type { ProfileState } from '@/app/(frontend)/[locale]/profile/actions'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { bioBaseline, bioToSend } from '@/components/profile/bio'
import type { ProfileMessages } from '@/components/profile/messages'
import { Select } from '@/components/select'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { ProfileError, ProfileView } from '@/lib/profile'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const platformLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

export type { ProfileMessages }

type Props = {
  profile: ProfileView
  messages: ProfileMessages
  action: (state: ProfileState, form: FormData) => Promise<ProfileState>
}

/**
 * The member's own profile. The bios are edited as Markdown with Arc's rich
 * text editor and sent in hidden fields; the server stores them as Lexical.
 */
export function ProfileForm({ profile, messages: m, action }: Props) {
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as ProfileState)
  const [bioEn, setBioEn] = useState(profile.bio.en)
  const [bioAr, setBioAr] = useState(profile.bio.ar)
  const [submits, setSubmits] = useState(0)
  const [photoTooBig, setPhotoTooBig] = useState(false)
  // The editor's own rendering of each stored bio, found on first use (it needs the
  // browser) and found again when the stored bio changes.
  const baselines = useRef<{ en?: [string, string]; ar?: [string, string] }>({})
  const bioFor = (locale: 'en' | 'ar', edited: string) => {
    const original = profile.bio[locale]
    let cached = baselines.current[locale]
    if (cached?.[0] !== original)
      cached = baselines.current[locale] = [original, bioBaseline(original)]
    return bioToSend(original, edited, cached[1])
  }
  const [links, setLinks] = useState(profile.socialLinks)
  // Errors that belong to one field show under it; the rest show beside the button.
  const fieldError = (error: ProfileError) =>
    state.status === 'error' && state.error === error ? m.errors[error] : undefined
  const photoError = photoTooBig ? m.errors.photo : fieldError('photo')
  const lineError =
    state.status === 'error' && !['name', 'name-ar', 'website', 'photo'].includes(state.error)
      ? m.errors[state.error]
      : undefined

  return (
    // No `action` on the form: React 19 would reset the fields to their stored values
    // when it finishes. The form needs the script anyway (the editors, the links).
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const photo = data.get('photo')
        const bad =
          photo instanceof File &&
          photo.size > 0 &&
          (photo.size > PHOTO_MAX_BYTES || !PHOTO_TYPES.includes(photo.type))
        setPhotoTooBig(bad)
        if (bad) return
        setSubmits((n) => n + 1)
        startTransition(() => submit(data))
      }}
    >
      <p className="text-sm text-muted-foreground">{profile.visible ? m.public : m.private}</p>

      <Input
        label={m.nameEn}
        name="name_en"
        defaultValue={profile.name.en}
        required
        dir="ltr"
        error={fieldError('name')}
      />
      <Input
        label={m.nameAr}
        name="name_ar"
        defaultValue={profile.name.ar}
        dir="rtl"
        error={fieldError('name-ar')}
      />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{m.bioEn}</legend>
        <div dir="ltr">
          <RichTextEditor
            aria-label={m.bioEn}
            defaultMarkdown={profile.bio.en}
            onChange={(value) => setBioEn(bioFor('en', value.markdown))}
          />
        </div>
        <input type="hidden" name="bio_en" value={bioEn} />
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{m.bioAr}</legend>
        <div dir="rtl">
          <RichTextEditor
            aria-label={m.bioAr}
            defaultMarkdown={profile.bio.ar}
            onChange={(value) => setBioAr(bioFor('ar', value.markdown))}
          />
        </div>
        <input type="hidden" name="bio_ar" value={bioAr} />
      </fieldset>

      <Input
        label={m.website}
        name="website"
        type="url"
        defaultValue={profile.website}
        dir="ltr"
        error={fieldError('website')}
      />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{m.social}</legend>
        {links.map((link, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-40">
              <Select
                label={m.platform}
                value={link.platform}
                items={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: platformLabel(p) }))}
                onValueChange={(value) =>
                  setLinks(
                    links.map((l, j) =>
                      j === i ? { ...l, platform: value as typeof l.platform } : l,
                    ),
                  )
                }
              />
            </div>
            <div className="min-w-60 flex-1">
              <Input
                label={m.url}
                type="url"
                dir="ltr"
                value={link.url}
                onChange={(e) =>
                  setLinks(links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label={`${m.removeLink}: ${platformLabel(link.platform)}`}
              onClick={() => setLinks(links.filter((_, j) => j !== i))}
            >
              {m.removeLink}
            </Button>
          </div>
        ))}
        {links.length < 8 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setLinks([...links, { platform: 'instagram', url: '' }])}
          >
            {m.addLink}
          </Button>
        )}
        <input type="hidden" name="socialLinks" value={JSON.stringify(links)} />
      </fieldset>

      <div className="grid gap-2">
        {profile.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- a member's own upload, any size
          <img
            src={profile.photo.url}
            alt={profile.photo.alt}
            className="size-24 rounded-full object-cover"
          />
        )}
        <Input
          label={m.photo}
          description={m.photoHint}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          error={photoError}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {m.save}
        </Button>
        {state.status === 'saved' && (
          <p key={submits} role="status" className="text-sm">
            {m.saved}
          </p>
        )}
        {lineError && (
          <p key={submits} role="alert" className="text-sm">
            {lineError}
          </p>
        )}
      </div>
    </form>
  )
}
