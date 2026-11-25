import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LiveRegion } from '@/portal/feedback/announce'

import { renderWithIntl } from '../../../testing/intl.test-utils'
import { NeedList } from './need-list'
import type { NeedRow, NeedSource } from './sources'

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

const result = (rows: NeedRow[], failed: NeedSource[] = []) => ({ rows, failed })

describe('NeedList', () => {
  it('a row is one link named by its verb and label', () => {
    renderWithIntl(<NeedList result={result([row()])} group={false} />)
    const link = screen.getByRole('link', { name: /Review/ })
    expect(link).toHaveAttribute('href', '/admin/collections/articles/1')
    expect(link).toHaveAccessibleName('Review On water')
  })

  it('an admin row names the owners', () => {
    renderWithIntl(<NeedList result={result([row({ owners: ['Salma', 'Omar'] })])} group={false} />)
    expect(screen.getByRole('link')).toHaveAccessibleName('Review On water By Salma and Omar')
  })

  it('the second line of a grouped row names two items and two people, then counts the rest', () => {
    renderWithIntl(
      <NeedList
        group
        result={result(
          ['On water', 'On salt', 'On sand', 'On stone'].map((label, index) =>
            row({ label, href: `/a/${index}`, owners: [['Salma', 'Omar', 'Hana'][index % 3]!] }),
          ),
        )}
      />,
    )
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Review 4 items On water, On salt, and 2 more By Salma, Omar, and 1 more',
    )
  })

  it('the applicants row names the courses that wait', () => {
    renderWithIntl(
      <NeedList
        group={false}
        result={result([
          row({
            kind: 'applicants',
            verbKey: 'needs.applicants',
            label: null,
            count: 3,
            href: '/admin/applicants',
            collection: null,
            courses: ['Seeing the Unseen', 'Egypt vs Masr'],
          }),
        ])}
      />,
    )
    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Decide on 3 applicants Seeing the Unseen and Egypt vs Masr',
    )
  })

  it('writes the second line in Arabic with the Arabic list words', () => {
    renderWithIntl(
      <NeedList
        group={false}
        result={result([row({ label: 'عن الماء', owners: ['سلمى', 'عمر'] })])}
      />,
      { locale: 'ar' },
    )
    expect(screen.getByRole('link')).toHaveAccessibleName('مراجعة عن الماء من سلمى وعمر')
  })

  it('shows the total in the heading and one list item per row', () => {
    renderWithIntl(
      <NeedList
        result={result([
          row(),
          row({
            kind: 'applicants',
            verbKey: 'needs.applicants',
            label: null,
            count: 4,
            href: '/admin/applicants',
            collection: null,
          }),
        ])}
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

  it.each([true, false])('keeps the heading on failure (surviving rows: %s)', async (survives) => {
    const shell = renderWithIntl(<LiveRegion />)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    renderWithIntl(
      <NeedList
        result={result(
          survives ? [row()] : [],
          survives ? ['applicants'] : ['applicants', 'reviewQueue'],
        )}
        group={false}
      />,
    )
    expect(screen.getByRole('heading', { name: /^Needs you$/ })).toBeVisible()
    await waitFor(() => expect(region).toHaveTextContent('Some tasks could not load.'))
    expect(screen.getAllByRole('status')).toEqual([region])
    shell.unmount()
    expect(screen.queryByText('Nothing needs you now.')).toBeNull()
    expect(screen.queryAllByRole('link', { name: 'Review On water' })).toHaveLength(
      survives ? 1 : 0,
    )
  })

  it('grouped rows sum count per kind and keep applicants apart', () => {
    renderWithIntl(
      <NeedList
        group
        result={result([
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
        ])}
      />,
    )
    expect(screen.getByRole('link', { name: /^Review 2 items / })).toHaveAttribute(
      'href',
      '/admin/reviews',
    )
    expect(screen.getByRole('link', { name: /^Review 1 set of changes / })).toHaveAttribute(
      'href',
      '/admin/reviews',
    )
    expect(screen.getByRole('link', { name: 'Decide on 3 applicants' })).toHaveAttribute(
      'href',
      '/admin/applicants',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('groups requested changes into links with the count for each collection', () => {
    renderWithIntl(
      <NeedList
        group
        result={result([
          row({
            kind: 'changes_requested',
            verbKey: 'needs.changesRequested',
            collection: 'courses',
            href: '/c/1',
          }),
          ...['/a/1', '/a/2'].map((href) =>
            row({ kind: 'changes_requested', verbKey: 'needs.changesRequested', href }),
          ),
        ])}
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /^Read 2 notes and edit Articles / })).toHaveAttribute(
      'href',
      '/en/spaces/articles?show=needsYou',
    )
    expect(screen.getByRole('link', { name: /^Read 1 note and edit Courses / })).toHaveAttribute(
      'href',
      '/en/spaces/courses?show=needsYou',
    )
  })

  it('a grouped changes_requested row with only courses links to the Courses list', () => {
    renderWithIntl(
      <NeedList
        group
        result={result([
          row({
            kind: 'changes_requested',
            verbKey: 'needs.changesRequested',
            collection: 'courses',
            href: '/c/1',
          }),
        ])}
      />,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/spaces/courses?show=needsYou')
  })

  it('an untitled row says Untitled article or Untitled course', () => {
    renderWithIntl(
      <NeedList
        result={result([
          row({ label: null, href: '/u/1' }),
          row({ label: null, collection: 'courses', href: '/u/2' }),
        ])}
        group={false}
      />,
    )
    expect(screen.getByRole('link', { name: 'Review Untitled article' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review Untitled course' })).toBeTruthy()
  })

  it('writes Arabic digits in the total (ar)', () => {
    renderWithIntl(<NeedList result={result([row({ count: 3 })])} group={false} />, {
      locale: 'ar',
    })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('٣')
  })
})
