import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RichTextField } from '@/components/RichTextField'
import messages from '../../messages/en.json'
import arabicMessages from '../../messages/ar.json'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const documentOf = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
})
const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }],
})
const person = {
  id: 42,
  name: 'Public person',
  slug: 'public-person',
  visible: true,
  bio: documentOf([paragraph('A stored public bio.')]),
  photo: { id: 1, url: '/portrait.webp', alt: 'Public portrait', focalX: 20, focalY: 80 },
  website: 'https://example.com',
  social_links: [{ platform: 'instagram', url: 'https://instagram.com/example' }],
  email: 'private@example.com',
  enrollments: { docs: [{ title: 'Private enrollment' }] },
}
const profile = (value: unknown = person) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'personProfile', person: value },
})
const renderBody = (children: unknown[], plain = false, locale = 'en') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? arabicMessages : messages}
      formats={{
        number: {
          digits: { numberingSystem: locale === 'ar' ? 'arab' : 'latn', useGrouping: false },
        },
      }}
    >
      <RichTextField data={documentOf(children)} plain={plain} />
    </NextIntlClientProvider>,
  )

describe('person profile editor block', () => {
  it.each(['en', 'ar'])(
    'uses the Arc carousel on mobile in %s with manual navigation',
    (locale) => {
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }))
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      )
      const { container } = renderBody(
        [
          {
            type: 'block',
            version: 2,
            fields: {
              blockType: 'columns',
              columnCount: '2',
              ratio: 'equal',
              first: documentOf([profile()]),
              second: documentOf([
                profile({ ...person, id: 43, name: 'Second person', slug: 'second-person' }),
              ]),
            },
          },
        ],
        false,
        locale,
      )
      expect(container.querySelector('[aria-roledescription="carousel"]')).not.toBeNull()
      const slides = container.querySelectorAll('[aria-roledescription="slide"]')
      expect(slides).toHaveLength(2)
      expect(slides[0].firstElementChild).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      expect(slides[0]).not.toHaveAttribute('inert')
      const controls = (locale === 'ar' ? arabicMessages : messages).Home.controls
      fireEvent.click(screen.getByRole('button', { name: controls.next }))
      expect(slides[1]).not.toHaveAttribute('inert')
      expect(slides[0]).toHaveAttribute('inert')
      expect(screen.queryByRole('button', { name: controls.startRotation })).toBeNull()
      expect(screen.queryByRole('button', { name: controls.pauseRotation })).toBeNull()
    },
  )

  it('renders stored public fields, profile links, and the uploaded photo', () => {
    const { container } = renderBody([profile()])
    expect(screen.getByRole('heading', { name: person.name })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: person.name })).toHaveAttribute(
      'href',
      '/en/people/public-person',
    )
    expect(screen.getByText('A stored public bio.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute(
      'href',
      'https://example.com/',
    )
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/example',
    )
    expect(screen.getByAltText('Public portrait')).toHaveStyle({ objectPosition: '20% 80%' })
    expect(container.textContent).not.toContain('private@example.com')
    expect(container.textContent).not.toContain('Private enrollment')
  })

  it.each([null, 42, { ...person, visible: false }])(
    'omits missing, unpopulated, or hidden profiles',
    (value) => {
      const { container } = renderBody([profile(value)])
      expect(container.querySelector('article')).toBeNull()
      expect(container.textContent).not.toContain(person.name)
    },
  )

  it('renders four independently selected profiles inside columns', () => {
    const fields = Object.fromEntries(
      ['first', 'second', 'third', 'fourth'].map((name, index) => [
        name,
        documentOf([
          profile({
            ...person,
            id: index + 1,
            name: `Person ${index + 1}`,
            slug: `person-${index + 1}`,
          }),
        ]),
      ]),
    )
    const { container } = renderBody([
      {
        type: 'block',
        version: 2,
        fields: { blockType: 'columns', columnCount: '4', ratio: 'equal', ...fields },
      },
    ])
    expect(container.querySelector('[data-columns="4"]')?.children).toHaveLength(4)
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Person 1',
      'Person 2',
      'Person 3',
      'Person 4',
    ])
  })

  it('uses the local avatar fallback, omits unsafe links, and excludes cards in plain views', () => {
    const { container } = renderBody([
      profile({ ...person, photo: null, website: 'javascript:alert(1)', social_links: [] }),
    ])
    expect(container.querySelector('article > div:first-child svg')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Website' })).toBeNull()
    cleanup()
    expect(renderBody([profile()], true).container.querySelector('article')).toBeNull()
  })
})
