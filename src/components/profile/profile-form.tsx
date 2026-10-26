'use client'

import { startTransition, useActionState, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

import type { PhotoState, ProfileState } from '@/app/(frontend)/[locale]/profile/actions'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { AvatarUpload } from '@/components/image-upload/avatar-upload'
import { sendWithProgress } from '@/components/image-upload/send'
import { RichField } from '@/components/rich-field'
import { bioBaseline, bioToSend } from '@/components/profile/bio'
import type { ProfileMessages } from '@/components/profile/messages'
import { Select } from '@/components/select'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { ProfileError, ProfileView } from '@/lib/profile'

const platformLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

export type { ProfileMessages }

type Props = {
  profile: ProfileView
  messages: ProfileMessages
  action: (state: ProfileState, form: FormData) => Promise<ProfileState>
  removePhotoAction: () => Promise<PhotoState>
}

/**
 * The member's own profile. The bios are edited as Markdown with Arc's rich
 * text editor and sent in hidden fields; the server stores them as Lexical.
 */
export function ProfileForm({ profile, messages: m, action, removePhotoAction }: Props) {
  const locale = useLocale()
  const router = useRouter()
  const [state, submit, pending] = useActionState(action, { status: 'idle' } as ProfileState)
  const [bioEn, setBioEn] = useState(profile.bio.en)
  const [bioAr, setBioAr] = useState(profile.bio.ar)
  const [submits, setSubmits] = useState(0)
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
  const lineError =
    !pending &&
    state.status === 'error' &&
    !['name', 'name-ar', 'website', 'photo'].includes(state.error)
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
        setSubmits((n) => n + 1)
        startTransition(() => submit(data))
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
          const result = await sendWithProgress<PhotoState>('/api/profile-photo', data, {
            onProgress: report,
            signal,
          }).catch((error: unknown) => {
            if (signal.aborted) throw error
            return { ok: false, error: 'photo' } as const
          })
          if (!result.ok) throw new Error(m.errors[result.error])
          // The header's avatar and the rest of the page read the new photo.
          router.refresh()
          return result.url ?? undefined
        }}
        onRemove={async () => {
          const result = await removePhotoAction()
          if (!result.ok) throw new Error(m.errors[result.error])
        }}
      />

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

      <RichField
        label={m.bioEn}
        dir="ltr"
        defaultMarkdown={profile.bio.en}
        onChange={(value) => setBioEn(bioFor('en', value.markdown))}
      />
      <input type="hidden" name="bio_en" value={bioEn} />
      <RichField
        label={m.bioAr}
        dir="rtl"
        defaultMarkdown={profile.bio.ar}
        onChange={(value) => setBioAr(bioFor('ar', value.markdown))}
      />
      <input type="hidden" name="bio_ar" value={bioAr} />

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

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {m.save}
        </Button>
        {!pending && state.status === 'saved' && (
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
