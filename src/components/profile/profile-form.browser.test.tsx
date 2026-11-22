import { cleanup, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../arc/foundation.css'
import '../../portal/theme/tokens.css'
import '../../app/(frontend)/styles.css'
import { menuUser } from '@/components/menu-user'
import type { ProfileMessages } from '@/components/profile/messages'
import { useSession } from '@/components/use-session'
import type { ProfileView } from '@/lib/profile'

import {
  BrowserNavigation,
  createBrowserRouter,
} from '../../../testing/browser-navigation.test-utils'
import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import { mockNetwork, nextImages } from '../../../testing/msw-browser.test-utils'
import { ProfileForm } from './profile-form'

const PIXEL = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
)

const BEFORE = '/media/before.png'
const AFTER = '/media/after.png'

const server = {
  photo: BEFORE as string | null,
  sessionReads: 0,
  upload: { ok: true, url: AFTER } as { ok: true; url: string } | { ok: false; error: string },
}

mockNetwork(
  nextImages(),
  http.get(
    '/media/:file',
    () => new HttpResponse(PIXEL, { headers: { 'content-type': 'image/png' } }),
  ),
  http.get('/api/users/me', () => {
    server.sessionReads++
    return HttpResponse.json({
      user: {
        id: 1,
        email: 'reader@example.org',
        person: { id: 7, name: 'Ada', photo: server.photo ? { url: server.photo } : null },
      },
    })
  }),
  http.post('/api/profile-photo', () => HttpResponse.json(server.upload)),
)

const en = messagesOf.en
const keys = [
  'public',
  'private',
  'nameEn',
  'nameAr',
  'bioEn',
  'bioAr',
  'bioReadOnly',
  'website',
  'social',
  'platform',
  'url',
  'addLink',
  'removeLink',
  'save',
  'saved',
  'nameLong',
  'linkEmpty',
  'linkInvalid',
] as const
const messages = {
  ...Object.fromEntries(keys.map((key) => [key, en.Profile[key]])),
  errors: en.Profile.errors,
} as ProfileMessages

const profile: ProfileView = {
  personId: 7,
  visible: true,
  name: { en: 'Ada', ar: '' },
  bio: { en: '', ar: '' },
  website: '',
  socialLinks: [],
  photo: { url: BEFORE, alt: '' },
}

function MenuAvatar() {
  const session = useSession()
  const src = session ? menuUser(session).avatarSrc : undefined
  // eslint-disable-next-line @next/next/no-img-element -- the test reads the menu avatar's source
  return src ? <img data-testid="menu-avatar" alt="" src={src} /> : <span data-testid="no-avatar" />
}

const removals = { count: 0 }

const mount = () => {
  const removePhotoAction = async () => {
    removals.count++
    return { ok: true as const, url: null }
  }
  render(
    <BrowserNavigation browser={createBrowserRouter()}>
      <IntlProvider locale="en">
        <MenuAvatar />
        <ProfileForm
          profile={profile}
          messages={messages}
          action={async () => ({ status: 'saved' })}
          removePhotoAction={removePhotoAction}
        />
      </IntlProvider>
    </BrowserNavigation>,
  )
}

const avatarSrc = () => screen.queryByTestId('menu-avatar')?.getAttribute('src') ?? null

const sendPhoto = async () => {
  const group = screen.getByRole('group', { name: en.ImageUpload.avatarLabel })
  const input = group.querySelector<HTMLInputElement>('input[type="file"]')!
  await userEvent.upload(input, new File([PIXEL], 'pixel.png', { type: 'image/png' }))
  await userEvent.click(await screen.findByRole('button', { name: en.ImageUpload.save }))
}

beforeEach(() => {
  server.photo = BEFORE
  server.sessionReads = 0
  removals.count = 0
  server.upload = { ok: true, url: AFTER }
})

afterEach(cleanup)

describe('ProfileForm and the account menu avatar', () => {
  it('a new photo reaches the menu avatar', async () => {
    mount()
    await expect.poll(avatarSrc).toBe(BEFORE)

    server.photo = AFTER
    await sendPhoto()
    await expect.poll(avatarSrc).toBe(AFTER)
  })

  it('a removed photo leaves the menu avatar', async () => {
    mount()
    await expect.poll(avatarSrc).toBe(BEFORE)

    server.photo = null
    await userEvent.click(await screen.findByRole('button', { name: en.ImageUpload.remove }))
    await expect.poll(() => screen.queryByTestId('no-avatar')).not.toBeNull()
    expect(removals.count).toBe(1)
  })

  it('a photo the server refuses leaves the menu avatar as it was', async () => {
    mount()
    await expect.poll(avatarSrc).toBe(BEFORE)
    const reads = server.sessionReads

    server.upload = { ok: false, error: 'photo' }
    server.photo = AFTER
    await sendPhoto()
    expect(await screen.findAllByText(en.Profile.errors.photo)).not.toHaveLength(0)
    expect(server.sessionReads).toBe(reads)
    expect(avatarSrc()).toBe(BEFORE)
  })
})
