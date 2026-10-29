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
import { AvatarFallback } from '@/components/person/avatar-fallback'
import { PeopleWheel } from '@/components/person/people-wheel'
import { personAvatarSeed } from '@/lib/avatar'
import { POSTER_COLORS } from '@/lib/poster-colors'

vi.mock('@/i18n/navigation', () => ({ Link: 'a' }))

const seed = personAvatarSeed(42)
// React assigns unique mask IDs to each SVG; the portrait geometry stays the same.
const portrait = (svg: Element | null) =>
  svg?.innerHTML.replace(/id="[^"]+"/g, 'id="mask"').replace(/url\(#[^)]+\)/g, 'url(#mask)')
const fallback = () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(<AvatarFallback seed={seed} />)
  return portrait(container.querySelector('svg'))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('local Beam fallback', () => {
  it('uses the registration poster palette through the built-in colors option', () => {
    const seen = new Set<string>()
    for (let id = 0; id < 20; id++) {
      const container = document.createElement('div')
      container.innerHTML = renderToString(<AvatarFallback seed={personAvatarSeed(id)} />)
      for (const rectangle of container.querySelectorAll('g[mask] > rect')) {
        const color = rectangle.getAttribute('fill')!
        expect(POSTER_COLORS).toContain(color)
        seen.add(color)
      }
    }
    expect(seen).toEqual(new Set(POSTER_COLORS))
  })

  it('generates deterministic, distinct SVGs without embedding names or making requests', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const svg = renderToString(<AvatarFallback seed={personAvatarSeed('42')} />)
    expect(svg).toBe(renderToString(<AvatarFallback seed={seed} />))
    expect(svg).not.toBe(renderToString(<AvatarFallback seed={personAvatarSeed(43)} />))
    expect(svg).toContain('<svg')
    // Beam's face uses a 36 × 36 canvas, with paths for its mouth and eyes.
    expect(svg).toContain('viewBox="0 0 36 36"')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('person:42')
    expect(svg).not.toMatch(/<script|<image|https?:\/\/(?!www.w3.org)/)
    expect(renderToString(<AvatarFallback seed="" />)).toBe(
      renderToString(<AvatarFallback seed="anonymous" />),
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps a person’s identity independent of their displayed name and size', () => {
    const { container, rerender } = render(<Avatar name="A person" fallbackSeed={seed} size="sm" />)
    expect(portrait(container.querySelector('svg'))).toBe(fallback())
    rerender(<Avatar name="شخص" fallbackSeed={seed} size="xl" status="online" />)
    expect(portrait(container.querySelector('svg'))).toBe(fallback())
    expect(screen.getByRole('img', { name: 'شخص, online' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
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
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(portrait(container.querySelector('svg'))).toBe(fallback())
    rerender(<Avatar name="Person" src="/replacement.jpg" fallbackSeed={seed} />)
    expect(container.querySelector('img[src="/replacement.jpg"]')).toBeInTheDocument()
    rerender(<Avatar name="Person" fallbackSeed={seed} />)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
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
    const images = container.querySelectorAll('svg')
    expect(images).toHaveLength(2)
    expect(portrait(images[0])).toBe(fallback())
    expect(portrait(images[1])).not.toBe(fallback())
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
    expect(container.querySelector('img')).toBeNull()
    expect(portrait(container.querySelector('svg'))).toBe(fallback())
    expect(container.querySelector('svg')).not.toHaveAttribute('srcSet')
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Person')
    expect(container.querySelector('svg')).toHaveAttribute('width', '48')
    expect(onError).toHaveBeenCalledOnce()
    rerender(<AvatarImage src="/good.jpg" fallbackSeed={seed} />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/good.jpg')
    rerender(<AvatarImage fallbackSeed={seed} />)
    expect(portrait(container.querySelector('svg'))).toBe(fallback())
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
      <NextIntlClientProvider key="wheel" locale="en" messages={messages}>
        <PeopleWheel
          namespace="Fellows"
          people={[{ id: 42, slug: 'person', name: 'Person', eyebrow: '', lines: [], bio: '' }]}
        />
      </NextIntlClientProvider>,
    ]
    for (const surface of surfaces) {
      const container = document.createElement('div')
      container.innerHTML = renderToString(surface)
      const images = [...container.querySelectorAll('svg[viewBox="0 0 36 36"]')]
      expect(images.length).toBeGreaterThan(0)
      expect(images.every((image) => portrait(image) === fallback())).toBe(true)
      expect(container.innerHTML).not.toContain('person:42')
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
      [...container.querySelectorAll('svg')].every((svg) => portrait(svg) === fallback()),
    ).toBe(true)
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
