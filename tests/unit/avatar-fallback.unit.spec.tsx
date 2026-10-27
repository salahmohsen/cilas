import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import { CommentThread } from '@/components/arc/comment-thread/comment-thread'
import { UserMenu } from '@/components/arc/user-menu/user-menu'
import { AvatarUpload } from '@/components/image-upload/avatar-upload'
import messages from '../../messages/en.json'
import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { AvatarImage } from '@/components/person/avatar-image'
import { avatarFallback, personAvatarSeed } from '@/lib/avatar'

const seed = personAvatarSeed(42)
const fallback = avatarFallback(seed)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('local Blobatar fallback', () => {
  it('generates deterministic, distinct SVGs without embedding names or making requests', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(avatarFallback(personAvatarSeed('42'))).toBe(fallback)
    expect(avatarFallback(personAvatarSeed(43))).not.toBe(fallback)
    expect(fallback).toMatch(/^data:image\/svg\+xml,/)
    const svg = decodeURIComponent(fallback.slice(fallback.indexOf(',') + 1))
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('person:42')
    expect(svg).not.toMatch(/<script|<image|https?:\/\/(?!www.w3.org)/)
    expect(avatarFallback('')).toBe(avatarFallback('anonymous'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps a person’s identity independent of their displayed name and size', () => {
    const { container, rerender } = render(<Avatar name="A person" fallbackSeed={seed} size="sm" />)
    expect(container.querySelector('img')).toHaveAttribute('src', fallback)
    rerender(<Avatar name="شخص" fallbackSeed={seed} size="xl" status="online" />)
    expect(container.querySelector('img')).toHaveAttribute('src', fallback)
    expect(screen.getByRole('img', { name: 'شخص, online' })).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('span')).not.toHaveAttribute('fallbackSeed')
  })

  it('preserves uploaded photos, the loading transition, and the fallback on failure', () => {
    const { container, rerender } = render(
      <Avatar name="Person" src="/photo.jpg" fallbackSeed={seed} />,
    )
    const photo = container.querySelector('img[src="/photo.jpg"]')!
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(photo).toHaveAttribute('data-loading')
    fireEvent.load(photo)
    expect(photo).not.toHaveAttribute('data-loading')
    fireEvent.error(photo)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')).toHaveAttribute('src', fallback)
    rerender(<Avatar name="Person" src="/replacement.jpg" fallbackSeed={seed} />)
    expect(container.querySelector('img[src="/replacement.jpg"]')).toBeInTheDocument()
    rerender(<Avatar name="Person" fallbackSeed={seed} />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('leaves system and decorative initials alone without an explicit seed', () => {
    const { container } = render(<Avatar name="CILAS" />)
    expect(screen.getByRole('img', { name: 'CILAS' })).toHaveTextContent('C')
    expect(container.querySelector('img')).toBeNull()
  })

  it('passes stable seeds through grouped faces and keeps overflow behavior', () => {
    const { container } = render(
      <AvatarGroup
        members={[
          { id: 42, name: 'Same name', fallbackSeed: seed },
          { id: 43, name: 'Same name', fallbackSeed: personAvatarSeed(43) },
          { id: 44, name: 'Other', fallbackSeed: personAvatarSeed(44) },
        ]}
        max={2}
        label="Members"
      />,
    )
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', fallback)
    expect(images[1].getAttribute('src')).not.toBe(fallback)
    expect(screen.getByRole('img', { name: '1 more members' })).toBeInTheDocument()
  })

  it('recovers a failed portrait, clears srcSet, and accepts a new upload or removal', () => {
    const onError = vi.fn()
    const { container, rerender } = render(
      <AvatarImage
        src="/bad.jpg"
        srcSet="/bad@2.jpg 2x"
        fallbackSeed={seed}
        alt="Person"
        onError={onError}
        width={48}
        height={48}
      />,
    )
    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('src', '/bad.jpg')
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', fallback)
    expect(image).not.toHaveAttribute('srcSet')
    expect(image).toHaveAttribute('alt', 'Person')
    expect(image).toHaveAttribute('width', '48')
    expect(onError).toHaveBeenCalledOnce()
    rerender(<AvatarImage src="/good.jpg" fallbackSeed={seed} />)
    expect(image).toHaveAttribute('src', '/good.jpg')
    rerender(<AvatarImage fallbackSeed={seed} />)
    expect(image).toHaveAttribute('src', fallback)
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', fallback)
  })

  it('uses the same local portrait in account menus, profile upload controls, and comments', () => {
    const user = { name: 'Person', email: 'private@example.test', fallbackSeed: seed }
    const author = { id: '42', name: 'Person', fallbackSeed: seed }
    const surfaces = [
      <UserMenu key="menu" user={user} />,
      <NextIntlClientProvider key="upload" locale="en" messages={messages}>
        <AvatarUpload name="Person" fallbackSeed={seed} onUpload={async () => undefined} />
      </NextIntlClientProvider>,
      <CommentThread
        key="thread"
        currentUser={author}
        comments={[{ id: '1', author, body: 'Comment', createdAt: 'Now' }]}
      />,
    ]
    for (const surface of surfaces) {
      const container = document.createElement('div')
      container.innerHTML = renderToString(surface)
      const images = [...container.querySelectorAll('img')]
      expect(images.length).toBeGreaterThan(0)
      expect(images.every((image) => image.getAttribute('src') === fallback)).toBe(true)
      expect(images.every((image) => !image.getAttribute('src')?.includes('private'))).toBe(true)
    }
  })

  it.each(['light', 'dark'])('hydrates the same local image in %s mode', async (theme) => {
    const tree = (
      <div data-theme={theme}>
        <Avatar name="Person" fallbackSeed={seed} />
        <AvatarImage fallbackSeed={seed} />
      </div>
    )
    const html = renderToString(tree)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const recoverable = vi.fn()
    let root: ReturnType<typeof hydrateRoot>
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: recoverable })
    })
    expect(recoverable).not.toHaveBeenCalled()
    expect(
      [...container.querySelectorAll('img')].every((img) => img.getAttribute('src') === fallback),
    ).toBe(true)
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
