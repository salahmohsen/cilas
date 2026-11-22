import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithIntl } from '../../../testing/intl.test-utils'
import { NeedList } from './need-list'
import type { NeedRow } from './sources'

afterEach(cleanup)

const row = (over: Partial<NeedRow> = {}) =>
  ({
    kind: 'review',
    verbKey: 'needs.review',
    href: '/admin/collections/articles/1',
    label: 'On water',
    count: 1,
    owners: [],
    collection: 'articles',
    ...over,
  }) satisfies NeedRow

describe('NeedList', () => {
  it('a row is one link named by its verb and label', () => {
    renderWithIntl(<NeedList rows={[row()]} group={false} />)
    const link = screen.getByRole('link', { name: /Review/ })
    expect(link).toHaveAttribute('href', '/admin/collections/articles/1')
    expect(link).toHaveAccessibleName('Review On water')
  })

  it('an admin row names the owners', () => {
    renderWithIntl(<NeedList rows={[row({ owners: ['Salma', 'Omar'] })]} group={false} />)
    expect(screen.getByRole('link')).toHaveAccessibleName('Review On water By Salma, Omar')
  })

  it('shows the total in the heading and one list item per row', () => {
    renderWithIntl(
      <NeedList
        rows={[
          row(),
          row({
            kind: 'applicants',
            verbKey: 'needs.applicants',
            label: null,
            count: 4,
            href: '/admin/applicants',
            collection: null,
          }),
        ]}
        group={false}
      />,
    )
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Needs you5')
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Decide on 4 applicants' })).toHaveAttribute(
      'href',
      '/admin/applicants',
    )
  })

  it('grouped rows sum count per kind and keep applicants apart', () => {
    renderWithIntl(
      <NeedList
        group
        rows={[
          row({ href: '/a/1' }),
          row({ href: '/a/2' }),
          row({ href: '/a/3', kind: 'edit_review', verbKey: 'needs.editReview' }),
          row({
            kind: 'applicants',
            verbKey: 'needs.applicants',
            label: null,
            count: 3,
            href: '/admin/applicants',
            collection: null,
          }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Review 2 items' })).toHaveAttribute(
      'href',
      '/admin/reviews',
    )
    expect(screen.getByRole('link', { name: 'Review 1 set of changes' })).toHaveAttribute(
      'href',
      '/admin/reviews',
    )
    expect(screen.getByRole('link', { name: 'Decide on 3 applicants' })).toHaveAttribute(
      'href',
      '/admin/applicants',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('a grouped changes_requested row with an article links to the Articles list', () => {
    renderWithIntl(
      <NeedList
        group
        rows={[
          row({
            kind: 'changes_requested',
            verbKey: 'needs.changesRequested',
            collection: 'courses',
            href: '/c/1',
          }),
          row({
            kind: 'changes_requested',
            verbKey: 'needs.changesRequested',
            collection: 'articles',
            href: '/c/2',
          }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Read 2 notes and edit' })).toHaveAttribute(
      'href',
      '/en/spaces/articles?show=needsYou',
    )
  })

  it('a grouped changes_requested row with only courses links to the Courses list', () => {
    renderWithIntl(
      <NeedList
        group
        rows={[
          row({
            kind: 'changes_requested',
            verbKey: 'needs.changesRequested',
            collection: 'courses',
            href: '/c/1',
          }),
        ]}
      />,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/spaces/courses?show=needsYou')
  })

  it('an untitled row says Untitled article or Untitled course', () => {
    renderWithIntl(
      <NeedList
        rows={[
          row({ label: null, href: '/u/1' }),
          row({ label: null, collection: 'courses', href: '/u/2' }),
        ]}
        group={false}
      />,
    )
    expect(screen.getByRole('link', { name: 'Review Untitled article' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review Untitled course' })).toBeTruthy()
  })

  it('writes Arabic digits in the total (ar)', () => {
    renderWithIntl(<NeedList rows={[row({ count: 3 })]} group={false} />, { locale: 'ar' })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('٣')
  })
})
