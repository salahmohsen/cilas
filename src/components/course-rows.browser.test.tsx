import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../components/arc/foundation.css'
import '../app/(frontend)/styles.css'
import type { StudyRow } from '@/api/study-index'
import { CourseRows } from '@/components/course-rows'
import { IntlProvider } from '../../testing/intl.test-utils'

afterEach(cleanup)

const row = (id: number, image: string) =>
  ({
    id,
    href: `/en/study/course-${id}`,
    title: `Course ${id}`,
    description: 'A course',
    image,
    imageAlt: '',
    type: { value: 'core', label: 'Core' },
  }) satisfies StudyRow

const coverRequests = () =>
  performance
    .getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/_next/image') && entry.name.includes('cover-'))

describe('course row covers', () => {
  it('fetches a cover only once its row opens', async () => {
    const { container } = render(
      <IntlProvider>
        <CourseRows
          rows={[row(1, '/assets/cover-1.webp'), row(2, '/assets/cover-2.webp')]}
          start={1}
        />
      </IntlProvider>,
    )
    const covers = Array.from(container.querySelectorAll<HTMLElement>('.course-row-cover'))
    expect(covers).toHaveLength(2)
    expect(covers.map((cover) => getComputedStyle(cover).display)).toEqual(['none', 'none'])
    expect(container.querySelectorAll('.course-row-cover img[loading="lazy"]')).toHaveLength(2)

    await userEvent.hover(container.querySelectorAll<HTMLElement>('.course-row')[0]!)
    await expect.poll(() => getComputedStyle(covers[0]!).display).toBe('block')
    expect(getComputedStyle(covers[1]!).display).toBe('none')
    await expect.poll(() => coverRequests().length).toBeGreaterThan(0)
    expect(coverRequests().every((entry) => entry.name.includes('cover-1'))).toBe(true)
  })
})
