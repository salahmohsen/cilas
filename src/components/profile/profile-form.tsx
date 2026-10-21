'use client'

import { useActionState, useRef, useState } from 'react'

import type { ProfileState } from '@/app/(frontend)/[locale]/profile/actions'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { bioBaseline, bioToSend } from '@/components/profile/bio'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { ProfileError, ProfileView } from '@/lib/profile'

export type ProfileMessages = Record<
  | 'public'
  | 'private'
  | 'nameEn'
  | 'nameAr'
  | 'bioEn'
  | 'bioAr'
  | 'website'
  | 'social'
  | 'platform'
  | 'url'
  | 'addLink'
  | 'removeLink'
  | 'photo'
  | 'photoHint'
  | 'save'
  | 'saved',
  string
> & { errors: Record<ProfileError, string> }

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
  // The editor's own rendering of each stored bio, found on first use: it needs the browser.
  const baselines = useRef<{ en?: string; ar?: string }>({})
  const bioFor = (locale: 'en' | 'ar', edited: string) => {
    const original = profile.bio[locale]
    baselines.current[locale] ??= bioBaseline(original)
    return bioToSend(original, edited, baselines.current[locale])
  }
  const [links, setLinks] = useState(profile.socialLinks)

  return (
    <form action={submit} className="grid gap-6">
      <p className="text-sm text-muted-foreground">{profile.visible ? m.public : m.private}</p>

      <Input label={m.nameEn} name="name_en" defaultValue={profile.name.en} required dir="ltr" />
      <Input label={m.nameAr} name="name_ar" defaultValue={profile.name.ar} dir="rtl" />

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

      <Input label={m.website} name="website" type="url" defaultValue={profile.website} dir="ltr" />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{m.social}</legend>
        {links.map((link, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              {m.platform}
              <select
                className="rounded-md border px-2 py-2"
                value={link.platform}
                onChange={(e) =>
                  setLinks(
                    links.map((l, j) =>
                      j === i ? { ...l, platform: e.target.value as typeof l.platform } : l,
                    ),
                  )
                }
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
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
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {m.save}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'saved'
            ? m.saved
            : state.status === 'error'
              ? m.errors[state.error]
              : ''}
        </p>
      </div>
    </form>
  )
}
